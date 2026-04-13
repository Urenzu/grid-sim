use anyhow::Result;
use chrono::{Datelike, NaiveDate};
use polars::prelude::*;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::domain::carbon_intensity;
use crate::types::{DuckPoint, FuelEntry, GenHistoryPoint, GridTrendPoint, HeatmapCell};

// ── File discovery ─────────────────────────────────────────────────────────

fn parquet_files_for_range(dir: &Path, start: NaiveDate, end: NaiveDate) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut d = start;
    loop {
        let p = dir.join(format!("{d}.parquet"));
        if p.exists() { files.push(p); }
        match d.succ_opt() {
            Some(next) if next <= end => d = next,
            _ => break,
        }
    }
    files
}

fn all_parquet_files(dir: &Path) -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map_or(false, |n| n.ends_with(".parquet") && !n.ends_with(".tmp.parquet"))
        })
        .collect();
    files.sort();
    files
}

// ── Core scan ──────────────────────────────────────────────────────────────

struct Row {
    period: String,
    fuel:   String,
    mw:     f64,
}

/// Scan `files`, filter to `ba`, group by (period, fuel), sum mw.
fn scan_gen_ba(files: &[PathBuf], ba: &str) -> Result<Vec<Row>> {
    if files.is_empty() { return Ok(vec![]); }

    let frames: PolarsResult<Vec<LazyFrame>> = files.iter()
        .map(|p| LazyFrame::scan_parquet(p, ScanArgsParquet::default()))
        .collect();
    let frames = frames?;

    let combined = if frames.len() == 1 {
        frames.into_iter().next().unwrap()
    } else {
        concat(frames, UnionArgs::default())?
    };

    let df = combined
        .filter(col("ba").eq(lit(ba.to_string())))
        .select([col("period"), col("fuel"), col("mw")])
        .group_by([col("period"), col("fuel")])
        .agg([col("mw").sum().alias("mw")])
        .collect()?;

    let period_ca = df["period"].str()?;
    let fuel_ca   = df["fuel"].str()?;
    let mw_ca     = df["mw"].f64()?;

    let rows = period_ca.into_iter()
        .zip(fuel_ca.into_iter())
        .zip(mw_ca.into_iter())
        .filter_map(|((p, f), m)| {
            Some(Row {
                period: p?.to_string(),
                fuel:   f?.to_string(),
                mw:     m?,
            })
        })
        .collect();

    Ok(rows)
}

fn rows_into_period_map(rows: Vec<Row>) -> HashMap<String, HashMap<String, f64>> {
    let mut map: HashMap<String, HashMap<String, f64>> = HashMap::new();
    for r in rows {
        if r.mw <= 0.0 { continue; }
        *map.entry(r.period).or_default().entry(r.fuel).or_insert(0.0) += r.mw;
    }
    map
}

// ── Public query functions ─────────────────────────────────────────────────

/// Return hourly history + duck-curve points for `ba` within `[start, end]`.
pub(crate) fn query_range(
    data_dir: &Path,
    ba:       &str,
    start:    NaiveDate,
    end:      NaiveDate,
) -> Result<(Vec<GenHistoryPoint>, Vec<DuckPoint>)> {
    let files = parquet_files_for_range(&data_dir.join("gen"), start, end);
    if files.is_empty() { return Ok((vec![], vec![])); }

    let map = rows_into_period_map(scan_gen_ba(&files, ba)?);

    let mut history: Vec<GenHistoryPoint> = Vec::new();
    let mut duck:    Vec<DuckPoint>       = Vec::new();

    for (period, fuel_map) in &map {
        let total_mw: f64 = fuel_map.values().sum();
        let mut fuels: Vec<FuelEntry> = fuel_map.iter()
            .map(|(f, &mw)| FuelEntry { fuel: f.clone(), mw })
            .collect();
        fuels.sort_by(|a, b| b.mw.partial_cmp(&a.mw).unwrap_or(std::cmp::Ordering::Equal));

        history.push(GenHistoryPoint { period: period.clone(), fuels: fuels.clone(), total_mw });

        let get = |k: &str| *fuel_map.get(k).unwrap_or(&0.0);
        let solar_mw   = get("solar");
        let wind_mw    = get("wind");
        let nuclear_mw = get("nuclear");
        let gas_mw     = get("gas");
        let coal_mw    = get("coal");
        let hydro_mw   = get("hydro");
        duck.push(DuckPoint {
            period:      period.clone(),
            total_mw,
            solar_mw,
            wind_mw,
            net_load_mw: (total_mw - solar_mw - wind_mw).max(0.0),
            nuclear_mw,
            gas_mw,
            coal_mw,
            hydro_mw,
            intensity:   carbon_intensity(&fuels),
        });
    }

    history.sort_by(|a, b| a.period.cmp(&b.period));
    duck.sort_by(|a, b| a.period.cmp(&b.period));
    Ok((history, duck))
}

/// Build a 24 × 7 (hour × day-of-week) carbon intensity heatmap for `ba`.
/// `days` controls how many days back to look (defaults to 30).
pub(crate) fn query_heatmap(data_dir: &Path, ba: &str, days: u32) -> Result<Vec<HeatmapCell>> {
    let end   = chrono::Utc::now().date_naive();
    let start = end - chrono::Duration::days(days as i64);
    let files = parquet_files_for_range(&data_dir.join("gen"), start, end);
    if files.is_empty() { return Ok(vec![]); }

    let map = rows_into_period_map(scan_gen_ba(&files, ba)?);

    // Accumulate (intensity_sum, count) per (hour, dow) bucket
    let mut sums:   HashMap<(u8, u8), f64> = HashMap::new();
    let mut counts: HashMap<(u8, u8), u32> = HashMap::new();

    for (period, fuel_map) in &map {
        let fuels: Vec<FuelEntry> = fuel_map.iter()
            .map(|(f, &mw)| FuelEntry { fuel: f.clone(), mw })
            .collect();
        let intensity = carbon_intensity(&fuels);

        // period: "2024-01-15T14"
        let hour = period.get(11..13)
            .and_then(|s| s.parse::<u8>().ok())
            .unwrap_or(0);
        let dow = period.get(..10)
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
            .map(|d| d.weekday().num_days_from_monday() as u8)
            .unwrap_or(0);

        let key = (hour, dow);
        *sums.entry(key).or_insert(0.0)   += intensity;
        *counts.entry(key).or_insert(0)   += 1;
    }

    let mut cells: Vec<HeatmapCell> = sums.into_iter()
        .map(|((hour, dow), sum)| {
            let count = *counts.get(&(hour, dow)).unwrap_or(&1);
            HeatmapCell {
                hour,
                dow,
                intensity:    sum / count as f64,
                sample_count: count,
            }
        })
        .collect();
    cells.sort_by_key(|c| (c.dow, c.hour));
    Ok(cells)
}

/// Time-bucketed (day / week / month) grid-wide or per-BA trend series.
pub(crate) fn query_trends(
    data_dir:    &Path,
    ba:          Option<&str>,
    granularity: &str,
) -> Result<Vec<GridTrendPoint>> {
    let files = all_parquet_files(&data_dir.join("gen"));
    if files.is_empty() { return Ok(vec![]); }

    let frames: PolarsResult<Vec<LazyFrame>> = files.iter()
        .map(|p| LazyFrame::scan_parquet(p, ScanArgsParquet::default()))
        .collect();
    let frames = frames?;
    let mut lf = if frames.len() == 1 {
        frames.into_iter().next().unwrap()
    } else {
        concat(frames, UnionArgs::default())?
    };

    if let Some(ba_str) = ba {
        lf = lf.filter(col("ba").eq(lit(ba_str.to_string())));
    }

    let df = lf
        .select([col("period"), col("fuel"), col("mw")])
        .group_by([col("period"), col("fuel")])
        .agg([col("mw").sum().alias("mw")])
        .collect()?;

    let period_ca = df["period"].str()?;
    let fuel_ca   = df["fuel"].str()?;
    let mw_ca     = df["mw"].f64()?;

    // Bucket by truncated period key
    let mut buckets: HashMap<String, HashMap<String, f64>> = HashMap::new();
    for ((p_opt, f_opt), m_opt) in period_ca.into_iter()
        .zip(fuel_ca.into_iter())
        .zip(mw_ca.into_iter())
    {
        let (p, f, m) = match (p_opt, f_opt, m_opt) {
            (Some(p), Some(f), Some(m)) if m > 0.0 => (p, f, m),
            _ => continue,
        };
        let bucket = truncate_period(p, granularity);
        *buckets.entry(bucket).or_default()
            .entry(f.to_string()).or_insert(0.0) += m;
    }

    let mut points: Vec<GridTrendPoint> = buckets.into_iter().map(|(period, fuel_map)| {
        let total_mw: f64 = fuel_map.values().sum();
        let fuels: Vec<FuelEntry> = fuel_map.iter()
            .map(|(f, &mw)| FuelEntry { fuel: f.clone(), mw })
            .collect();
        let get = |k: &str| *fuel_map.get(k).unwrap_or(&0.0);
        let renewable_mw = get("solar") + get("wind") + get("hydro");
        let clean_mw     = renewable_mw + get("nuclear");
        GridTrendPoint {
            period,
            renewable_pct:    if total_mw > 0.0 { renewable_mw / total_mw * 100.0 } else { 0.0 },
            clean_pct:        if total_mw > 0.0 { clean_mw    / total_mw * 100.0 } else { 0.0 },
            carbon_intensity: carbon_intensity(&fuels),
            total_mw,
        }
    }).collect();

    points.sort_by(|a, b| a.period.cmp(&b.period));
    Ok(points)
}

// ── Period truncation ──────────────────────────────────────────────────────

fn truncate_period(period: &str, granularity: &str) -> String {
    // period format: "2024-01-15T14"
    let date_str = period.get(..10).unwrap_or(period);
    match granularity {
        "day" => date_str.to_string(),
        "week" => NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
            .map(|d| {
                let days_from_mon = d.weekday().num_days_from_monday();
                (d - chrono::Duration::days(days_from_mon as i64)).to_string()
            })
            .unwrap_or_else(|_| date_str.to_string()),
        // "month" or default
        _ => period.get(..7).unwrap_or(date_str).to_string(),
    }
}
