use anyhow::Result;
use chrono::{Datelike, NaiveDate};
use duckdb::Connection;
use std::collections::HashMap;
use std::path::Path;

use crate::domain::carbon_intensity;
use crate::types::{DuckPoint, FuelEntry, GenHistoryPoint, GridTrendPoint, HeatmapCell};

fn conn() -> Result<Connection> {
    Ok(Connection::open_in_memory()?)
}

fn gen_glob(data_dir: &Path) -> String {
    format!("{}/gen/*.parquet", data_dir.display())
}

// ── Shared row fetch ───────────────────────────────────────────────────────

/// Fetch (period, fuel, mw) rows from the gen Parquet glob, filtered to `ba`
/// and an optional period range [start_prefix, end_prefix].
fn fetch_rows(
    data_dir:     &Path,
    ba:           Option<&str>,
    period_start: Option<&str>,
    period_end:   Option<&str>,
) -> Result<Vec<(String, String, f64)>> {
    let glob = gen_glob(data_dir);

    let mut clauses: Vec<String> = Vec::new();
    if ba.is_some()           { clauses.push("ba = ?".into()); }
    if period_start.is_some() { clauses.push("period >= ?".into()); }
    if period_end.is_some()   { clauses.push("period <= ?".into()); }

    let where_clause = if clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", clauses.join(" AND "))
    };

    let sql = format!(
        "SELECT period, fuel, SUM(mw) AS mw \
         FROM read_parquet('{glob}') \
         {where_clause} \
         GROUP BY period, fuel"
    );

    let db = conn()?;
    let mut stmt = db.prepare(&sql)?;

    let mut params: Vec<Box<dyn duckdb::ToSql>> = Vec::new();
    if let Some(v) = ba           { params.push(Box::new(v.to_string())); }
    if let Some(v) = period_start { params.push(Box::new(v.to_string())); }
    if let Some(v) = period_end   { params.push(Box::new(v.to_string())); }

    let param_refs: Vec<&dyn duckdb::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, f64>(2)?,
        ))
    })?
    .collect::<duckdb::Result<Vec<_>>>()?;

    Ok(rows)
}

fn into_period_map(rows: Vec<(String, String, f64)>) -> HashMap<String, HashMap<String, f64>> {
    let mut map: HashMap<String, HashMap<String, f64>> = HashMap::new();
    for (period, fuel, mw) in rows {
        if mw <= 0.0 { continue; }
        *map.entry(period).or_default().entry(fuel).or_insert(0.0) += mw;
    }
    map
}

// ── Public query functions ─────────────────────────────────────────────────

pub(crate) fn query_range(
    data_dir: &Path,
    ba:       &str,
    start:    NaiveDate,
    end:      NaiveDate,
) -> Result<(Vec<GenHistoryPoint>, Vec<DuckPoint>)> {
    let start_str = start.format("%Y-%m-%d").to_string();
    let end_str   = format!("{}T23", end.format("%Y-%m-%d"));

    let rows = fetch_rows(data_dir, Some(ba), Some(&start_str), Some(&end_str))?;
    if rows.is_empty() { return Ok((vec![], vec![])); }

    let map = into_period_map(rows);
    let mut history = Vec::new();
    let mut duck    = Vec::new();

    for (period, fuel_map) in &map {
        let total_mw: f64 = fuel_map.values().sum();
        let mut fuels: Vec<FuelEntry> = fuel_map.iter()
            .map(|(f, &mw)| FuelEntry { fuel: f.clone(), mw })
            .collect();
        fuels.sort_by(|a, b| b.mw.partial_cmp(&a.mw).unwrap_or(std::cmp::Ordering::Equal));

        history.push(GenHistoryPoint { period: period.clone(), fuels: fuels.clone(), total_mw });

        let get = |k: &str| *fuel_map.get(k).unwrap_or(&0.0);
        duck.push(DuckPoint {
            period:      period.clone(),
            total_mw,
            solar_mw:    get("solar"),
            wind_mw:     get("wind"),
            net_load_mw: (total_mw - get("solar") - get("wind")).max(0.0),
            nuclear_mw:  get("nuclear"),
            gas_mw:      get("gas"),
            coal_mw:     get("coal"),
            hydro_mw:    get("hydro"),
            intensity:   carbon_intensity(&fuels),
        });
    }

    history.sort_by(|a, b| a.period.cmp(&b.period));
    duck.sort_by(|a, b| a.period.cmp(&b.period));
    Ok((history, duck))
}

pub(crate) fn query_heatmap(data_dir: &Path, ba: &str, days: u32) -> Result<Vec<HeatmapCell>> {
    let end   = chrono::Utc::now().date_naive();
    let start = end - chrono::Duration::days(days as i64);

    let start_str = start.format("%Y-%m-%d").to_string();
    let end_str   = format!("{}T23", end.format("%Y-%m-%d"));

    let rows = fetch_rows(data_dir, Some(ba), Some(&start_str), Some(&end_str))?;
    if rows.is_empty() { return Ok(vec![]); }

    let map = into_period_map(rows);
    let mut sums:   HashMap<(u8, u8), f64> = HashMap::new();
    let mut counts: HashMap<(u8, u8), u32> = HashMap::new();

    for (period, fuel_map) in &map {
        let fuels: Vec<FuelEntry> = fuel_map.iter()
            .map(|(f, &mw)| FuelEntry { fuel: f.clone(), mw })
            .collect();
        let intensity = carbon_intensity(&fuels);

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
            HeatmapCell { hour, dow, intensity: sum / count as f64, sample_count: count }
        })
        .collect();
    cells.sort_by_key(|c| (c.dow, c.hour));
    Ok(cells)
}

pub(crate) fn query_trends(
    data_dir:    &Path,
    ba:          Option<&str>,
    granularity: &str,
) -> Result<Vec<GridTrendPoint>> {
    let rows = fetch_rows(data_dir, ba, None, None)?;
    if rows.is_empty() { return Ok(vec![]); }

    let mut buckets: HashMap<String, HashMap<String, f64>> = HashMap::new();
    for (period, fuel, mw) in rows {
        if mw <= 0.0 { continue; }
        let bucket = truncate_period(&period, granularity);
        *buckets.entry(bucket).or_default().entry(fuel).or_insert(0.0) += mw;
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
            clean_pct:        if total_mw > 0.0 { clean_mw     / total_mw * 100.0 } else { 0.0 },
            carbon_intensity: carbon_intensity(&fuels),
            total_mw,
        }
    }).collect();

    points.sort_by(|a, b| a.period.cmp(&b.period));
    Ok(points)
}

// ── Period truncation ──────────────────────────────────────────────────────

fn truncate_period(period: &str, granularity: &str) -> String {
    let date_str = period.get(..10).unwrap_or(period);
    match granularity {
        "day"  => date_str.to_string(),
        "week" => NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
            .map(|d| {
                let days_from_mon = d.weekday().num_days_from_monday();
                (d - chrono::Duration::days(days_from_mon as i64)).to_string()
            })
            .unwrap_or_else(|_| date_str.to_string()),
        _ => period.get(..7).unwrap_or(date_str).to_string(),
    }
}
