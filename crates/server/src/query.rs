use anyhow::Result;
use chrono::{Datelike, NaiveDate, Timelike};
use duckdb::Connection;
use std::collections::HashMap;
use std::path::Path;

use crate::domain::{carbon_intensity, AGGREGATE_RESPONDENTS};
use crate::labels::ba_timezone;
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
    if ba.is_some() {
        // An explicit request is honoured as-is: a rollup queried on its own
        // double-counts nothing.
        clauses.push("ba = ?".into());
    } else {
        // Grid-wide: the historical Parquet still holds the rollup rows EIA
        // reported, so they must be excluded before summing across BAs.
        let list = AGGREGATE_RESPONDENTS.iter()
            .map(|c| format!("'{c}'"))
            .collect::<Vec<_>>()
            .join(", ");
        clauses.push(format!("ba NOT IN ({list})"));
    }
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
    let tz  = ba_timezone(ba);
    let mut sums:   HashMap<(u8, u8), f64> = HashMap::new();
    let mut counts: HashMap<(u8, u8), u32> = HashMap::new();

    for (period, fuel_map) in &map {
        let fuels: Vec<FuelEntry> = fuel_map.iter()
            .map(|(f, &mw)| FuelEntry { fuel: f.clone(), mw })
            .collect();
        let intensity = carbon_intensity(&fuels);

        // "Carbon intensity at 6pm" only means anything on the BA's own clock,
        // so shift the UTC period into local time before bucketing.
        let Some((hour, dow)) = local_hour_dow(period, tz) else { continue };

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

// ── Local-time bucketing ───────────────────────────────────────────────────

/// Convert an EIA UTC period (`"YYYY-MM-DDTHH"`) into `(hour, weekday)` on the
/// given timezone's clock, where weekday is 0 = Monday. Returns `None` if the
/// period is malformed.
fn local_hour_dow(period: &str, tz: chrono_tz::Tz) -> Option<(u8, u8)> {
    use chrono::TimeZone;

    let naive = chrono::NaiveDateTime::parse_from_str(
        &format!("{period}:00:00"), "%Y-%m-%dT%H:%M:%S",
    ).ok()?;
    let local = chrono::Utc.from_utc_datetime(&naive).with_timezone(&tz);

    Some((
        local.hour() as u8,
        local.weekday().num_days_from_monday() as u8,
    ))
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::labels::ba_timezone;

    // ── Local-hour bucketing ──────────────────────────────────────────────

    #[test]
    fn utc_period_shifts_into_ba_local_time() {
        // 2026-03-01T00 UTC is 4pm on Feb 28 in California — the regression
        // that put CISO solar generation at "midnight".
        let (hour, dow) = local_hour_dow("2026-03-01T00", ba_timezone("CISO")).unwrap();
        assert_eq!(hour, 16);
        assert_eq!(dow, 5, "Feb 28 2026 is a Saturday");
    }

    #[test]
    fn ciso_solar_peak_lands_in_the_afternoon() {
        // CISO solar peaks around 20:00 UTC; that must read as ~1pm local,
        // not 8pm.
        let (hour, _) = local_hour_dow("2026-07-15T20", ba_timezone("CISO")).unwrap();
        assert_eq!(hour, 13);
    }

    #[test]
    fn bucketing_follows_dst() {
        // Same UTC hour, six months apart: Pacific shifts, Arizona does not.
        let (winter, _) = local_hour_dow("2026-01-15T20", ba_timezone("CISO")).unwrap();
        let (summer, _) = local_hour_dow("2026-07-15T20", ba_timezone("CISO")).unwrap();
        assert_eq!((winter, summer), (12, 13));

        let (az_w, _) = local_hour_dow("2026-01-15T20", ba_timezone("AZPS")).unwrap();
        let (az_s, _) = local_hour_dow("2026-07-15T20", ba_timezone("AZPS")).unwrap();
        assert_eq!((az_w, az_s), (13, 13));
    }

    #[test]
    fn eastern_ba_crosses_the_date_boundary_backwards() {
        // 04:00 UTC Monday is 11pm Sunday in New York.
        let (hour, dow) = local_hour_dow("2026-03-02T04", ba_timezone("NYIS")).unwrap();
        assert_eq!(hour, 23);
        assert_eq!(dow, 6, "Sunday");
    }

    #[test]
    fn unmapped_ba_stays_on_utc() {
        let (hour, _) = local_hour_dow("2026-07-15T20", ba_timezone("NOPE")).unwrap();
        assert_eq!(hour, 20);
    }

    #[test]
    fn malformed_period_is_skipped_not_bucketed_as_midnight() {
        assert!(local_hour_dow("garbage", ba_timezone("CISO")).is_none());
        assert!(local_hour_dow("2026-13-45T99", ba_timezone("CISO")).is_none());
    }

    // ── Period truncation ─────────────────────────────────────────────────

    #[test]
    fn truncation_buckets_by_granularity() {
        assert_eq!(truncate_period("2026-04-07T14", "day"),   "2026-04-07");
        assert_eq!(truncate_period("2026-04-07T14", "month"), "2026-04");
        // 2026-04-07 is a Tuesday → week starts Monday the 6th.
        assert_eq!(truncate_period("2026-04-07T14", "week"),  "2026-04-06");
    }
}
