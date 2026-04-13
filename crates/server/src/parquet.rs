use anyhow::Result;
use chrono::NaiveDate;
use polars::prelude::*;
use std::path::Path;
use std::time::Duration;

use crate::domain::normalize_fuel;
use crate::eia::{fetch_demand_range, fetch_gen_range, fetch_interchange_range};
use crate::types::{
    AppState, BaGenData, DemandEntry, EiaRecord, FuelTypeRecord, InterchangeRaw, RegionRecord,
};

// ── Parquet helpers ────────────────────────────────────────────────────────

/// Remove any orphaned .tmp.parquet files left by a previous interrupted run.
pub(crate) fn cleanup_tmp_parquet(data_dir: &Path) {
    for sub in &["gen", "interchange", "demand"] {
        let dir = data_dir.join(sub);
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.file_name()
                    .and_then(|n| n.to_str())
                    .map_or(false, |n| n.ends_with(".tmp.parquet"))
                {
                    tracing::warn!("removing orphan: {}", path.display());
                    let _ = std::fs::remove_file(&path);
                }
            }
        }
    }
}

/// Find the most recent complete gen Parquet file we have locally.
pub(crate) fn latest_local_date(data_dir: &Path) -> Option<NaiveDate> {
    let gen_dir = data_dir.join("gen");
    let mut latest: Option<NaiveDate> = None;
    if let Ok(entries) = std::fs::read_dir(&gen_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !name.ends_with(".parquet") || name.ends_with(".tmp.parquet") { continue; }
            if let Some(date_str) = name.strip_suffix(".parquet") {
                if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                    if latest.map_or(true, |l| date > l) { latest = Some(date); }
                }
            }
        }
    }
    latest
}

/// Read existing Parquet for `date` (if any), append `new_df`, deduplicate on
/// `key_cols` (keeping last = newest wins), then atomic write via tmp rename.
fn append_to_daily_parquet(
    dir:      &Path,
    date:     NaiveDate,
    new_df:   DataFrame,
    key_cols: Vec<String>,
) -> Result<()> {
    std::fs::create_dir_all(dir)?;
    let final_path = dir.join(format!("{date}.parquet"));
    let tmp_path   = dir.join(format!("{date}.tmp.parquet"));

    let mut merged = if final_path.exists() {
        let file     = std::fs::File::open(&final_path)?;
        let existing = ParquetReader::new(file).finish()?;
        let combined = existing.vstack(&new_df)?;
        combined.lazy()
            .unique(Some(key_cols), UniqueKeepStrategy::Last)
            .collect()?
    } else {
        new_df
    };

    let mut file = std::fs::File::create(&tmp_path)?;
    ParquetWriter::new(&mut file)
        .with_compression(ParquetCompression::Snappy)
        .finish(&mut merged)?;
    std::fs::rename(&tmp_path, &final_path)?;
    Ok(())
}

// ── Snapshot Parquet writers (steady-state, one period at a time) ──────────

pub(crate) fn write_gen_snapshot(data_dir: &Path, date: NaiveDate, gen: &[BaGenData]) -> Result<()> {
    let mut periods: Vec<String> = Vec::new();
    let mut bas:     Vec<String> = Vec::new();
    let mut fuels:   Vec<String> = Vec::new();
    let mut mws:     Vec<f64>    = Vec::new();

    for ba in gen {
        if ba.period.is_empty() { continue; }
        for f in &ba.fuels {
            periods.push(ba.period.clone());
            bas.push(ba.ba.clone());
            fuels.push(f.fuel.clone());
            mws.push(f.mw);
        }
    }
    if mws.is_empty() { return Ok(()); }

    let df = DataFrame::new(vec![
        Series::new("period".into(), periods.as_slice()),
        Series::new("ba".into(),     bas.as_slice()),
        Series::new("fuel".into(),   fuels.as_slice()),
        Series::new("mw".into(),     mws.as_slice()),
    ])?;
    append_to_daily_parquet(
        &data_dir.join("gen"), date, df,
        vec!["period".into(), "ba".into(), "fuel".into()],
    )
}

pub(crate) fn write_interchange_snapshot(data_dir: &Path, date: NaiveDate, raw: &[InterchangeRaw]) -> Result<()> {
    if raw.is_empty() { return Ok(()); }

    let periods:  Vec<&str> = raw.iter().map(|r| r.period.as_str()).collect();
    let from_bas: Vec<&str> = raw.iter().map(|r| r.from_ba.as_str()).collect();
    let to_bas:   Vec<&str> = raw.iter().map(|r| r.to_ba.as_str()).collect();
    let mws:      Vec<f64>  = raw.iter().map(|r| r.mw).collect();

    let df = DataFrame::new(vec![
        Series::new("period".into(),  periods.as_slice()),
        Series::new("from_ba".into(), from_bas.as_slice()),
        Series::new("to_ba".into(),   to_bas.as_slice()),
        Series::new("mw".into(),      mws.as_slice()),
    ])?;
    append_to_daily_parquet(
        &data_dir.join("interchange"), date, df,
        vec!["period".into(), "from_ba".into(), "to_ba".into()],
    )
}

pub(crate) fn write_demand_snapshot(data_dir: &Path, date: NaiveDate, demand: &[DemandEntry]) -> Result<()> {
    if demand.is_empty() { return Ok(()); }

    let periods:    Vec<&str> = demand.iter().map(|d| d.period.as_str()).collect();
    let bas:        Vec<&str> = demand.iter().map(|d| d.ba.as_str()).collect();
    let demand_mws: Vec<f64>  = demand.iter().map(|d| d.demand_mw).collect();

    let df = DataFrame::new(vec![
        Series::new("period".into(),    periods.as_slice()),
        Series::new("ba".into(),        bas.as_slice()),
        Series::new("demand_mw".into(), demand_mws.as_slice()),
    ])?;
    append_to_daily_parquet(
        &data_dir.join("demand"), date, df,
        vec!["period".into(), "ba".into()],
    )
}

// ── Gap-fill Parquet writers (full-day raw records from range fetches) ─────

pub(crate) fn write_gen_from_records(data_dir: &Path, date: NaiveDate, records: &[FuelTypeRecord]) -> Result<()> {
    let mut periods: Vec<String> = Vec::new();
    let mut bas:     Vec<String> = Vec::new();
    let mut fuels:   Vec<String> = Vec::new();
    let mut mws:     Vec<f64>    = Vec::new();

    for r in records {
        let mw = match r.value { Some(v) if v > 0.0 => v, _ => continue };
        periods.push(r.period.clone());
        bas.push(r.respondent.clone());
        fuels.push(normalize_fuel(&r.fueltype).to_string());
        mws.push(mw);
    }
    if mws.is_empty() { return Ok(()); }

    let df = DataFrame::new(vec![
        Series::new("period".into(), periods.as_slice()),
        Series::new("ba".into(),     bas.as_slice()),
        Series::new("fuel".into(),   fuels.as_slice()),
        Series::new("mw".into(),     mws.as_slice()),
    ])?;
    append_to_daily_parquet(
        &data_dir.join("gen"), date, df,
        vec!["period".into(), "ba".into(), "fuel".into()],
    )
}

pub(crate) fn write_interchange_from_records(data_dir: &Path, date: NaiveDate, records: &[EiaRecord]) -> Result<()> {
    let mut periods:  Vec<String> = Vec::new();
    let mut from_bas: Vec<String> = Vec::new();
    let mut to_bas:   Vec<String> = Vec::new();
    let mut mws:      Vec<f64>    = Vec::new();

    for r in records {
        let mw = match r.value { Some(v) => v, None => continue };
        periods.push(r.period.clone());
        from_bas.push(r.from_ba.clone());
        to_bas.push(r.to_ba.clone());
        mws.push(mw);
    }
    if mws.is_empty() { return Ok(()); }

    let df = DataFrame::new(vec![
        Series::new("period".into(),  periods.as_slice()),
        Series::new("from_ba".into(), from_bas.as_slice()),
        Series::new("to_ba".into(),   to_bas.as_slice()),
        Series::new("mw".into(),      mws.as_slice()),
    ])?;
    append_to_daily_parquet(
        &data_dir.join("interchange"), date, df,
        vec!["period".into(), "from_ba".into(), "to_ba".into()],
    )
}

pub(crate) fn write_demand_from_records(data_dir: &Path, date: NaiveDate, records: &[RegionRecord]) -> Result<()> {
    let mut periods:    Vec<String> = Vec::new();
    let mut bas:        Vec<String> = Vec::new();
    let mut demand_mws: Vec<f64>    = Vec::new();

    for r in records {
        let mw = match r.value { Some(v) if v > 0.0 => v, _ => continue };
        periods.push(r.period.clone());
        bas.push(r.respondent.clone());
        demand_mws.push(mw);
    }
    if demand_mws.is_empty() { return Ok(()); }

    let df = DataFrame::new(vec![
        Series::new("period".into(),    periods.as_slice()),
        Series::new("ba".into(),        bas.as_slice()),
        Series::new("demand_mw".into(), demand_mws.as_slice()),
    ])?;
    append_to_daily_parquet(
        &data_dir.join("demand"), date, df,
        vec!["period".into(), "ba".into()],
    )
}

// ── Gap-fill: fill one missing day across all three tables ─────────────────

pub(crate) async fn gap_fill_day(state: &AppState, date: NaiveDate) -> Result<()> {
    let data_dir = &state.data_dir;

    let gen_path = data_dir.join("gen").join(format!("{date}.parquet"));
    if !gen_path.exists() {
        let records = fetch_gen_range(state, date).await?;
        write_gen_from_records(data_dir, date, &records)?;
    }

    tokio::time::sleep(Duration::from_millis(200)).await;

    let int_path = data_dir.join("interchange").join(format!("{date}.parquet"));
    if !int_path.exists() {
        let records = fetch_interchange_range(state, date).await?;
        write_interchange_from_records(data_dir, date, &records)?;
    }

    tokio::time::sleep(Duration::from_millis(200)).await;

    let dem_path = data_dir.join("demand").join(format!("{date}.parquet"));
    if !dem_path.exists() {
        let records = fetch_demand_range(state, date).await?;
        write_demand_from_records(data_dir, date, &records)?;
    }

    Ok(())
}
