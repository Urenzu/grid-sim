use anyhow::{Context, Result};
use chrono::{Duration, NaiveDate};
use polars::prelude::*;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration as StdDuration;

const PAGE_SIZE: usize = 5000;
/// Sleep between paginated requests — keeps us polite with the EIA API.
const PAGE_SLEEP_MS: u64 = 100;

// ── CLI args ──────────────────────────────────────────────────────────────

struct Args {
    eia_key:  String,
    data_dir: PathBuf,
    start:    NaiveDate,
    end:      NaiveDate,
    /// Re-fetch and overwrite files that already exist.
    force:    bool,
}

fn parse_args() -> Result<Args> {
    let args: Vec<String> = std::env::args().collect();
    let get = |flag: &str| -> Option<String> {
        args.iter()
            .position(|a| a == flag)
            .and_then(|i| args.get(i + 1))
            .cloned()
    };

    let eia_key = get("--eia-key")
        .or_else(|| std::env::var("EIA_API_KEY").ok())
        .context("EIA_API_KEY not set — pass --eia-key KEY or set EIA_API_KEY in env")?;

    let data_dir = get("--data-dir")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("./data"));

    // Default start: first date EIA Form 930 has data
    let start = get("--start")
        .map(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d"))
        .transpose()
        .context("--start must be YYYY-MM-DD")?
        .unwrap_or_else(|| NaiveDate::from_ymd_opt(2018, 7, 1).unwrap());

    // Default end: yesterday (today's file is handled by the live server)
    let end_default = chrono::Utc::now().date_naive() - Duration::days(1);
    let end = get("--end")
        .map(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d"))
        .transpose()
        .context("--end must be YYYY-MM-DD")?
        .unwrap_or(end_default);

    let force = args.contains(&"--force".to_string());

    Ok(Args { eia_key, data_dir, start, end, force })
}

// ── EIA response types ────────────────────────────────────────────────────

#[derive(Deserialize)]
struct EiaEnvelope {
    response: EiaPage,
}

#[derive(Deserialize)]
struct EiaPage {
    data: Vec<serde_json::Value>,
}

/// EIA sometimes returns numbers as JSON strings — handle both.
fn as_f64(v: &serde_json::Value) -> Option<f64> {
    match v {
        serde_json::Value::Number(n) => n.as_f64(),
        serde_json::Value::String(s) => s.parse().ok(),
        _ => None,
    }
}

fn as_str(v: &serde_json::Value) -> Option<&str> {
    v.as_str()
}

// ── HTTP helpers ──────────────────────────────────────────────────────────

/// Fetch a single page from the EIA API, retrying on transient errors.
fn fetch_page(
    client: &reqwest::blocking::Client,
    url: &str,
) -> Result<Vec<serde_json::Value>> {
    const MAX_RETRIES: u32 = 5;
    let mut delay_ms = 2_000u64;

    for attempt in 0..=MAX_RETRIES {
        let result = (|| -> Result<Vec<serde_json::Value>> {
            let resp: EiaEnvelope = client
                .get(url)
                .send()
                .with_context(|| format!("GET {url}"))?
                .json()
                .context("JSON decode")?;
            Ok(resp.response.data)
        })();

        match result {
            Ok(data) => return Ok(data),
            Err(e) if attempt < MAX_RETRIES => {
                eprintln!("\n  [retry {}/{MAX_RETRIES} in {delay_ms}ms] {e:#}", attempt + 1);
                thread::sleep(StdDuration::from_millis(delay_ms));
                delay_ms = (delay_ms * 2).min(30_000);
            }
            Err(e) => return Err(e),
        }
    }
    unreachable!()
}

/// Paginate through all records for a base URL (no length/offset params yet).
fn fetch_all(
    client: &reqwest::blocking::Client,
    base_url: &str,
) -> Result<Vec<serde_json::Value>> {
    let mut all = Vec::new();
    let mut offset = 0usize;

    loop {
        let url = format!("{base_url}&length={PAGE_SIZE}&offset={offset}");
        let page = fetch_page(client, &url)?;
        let n = page.len();
        all.extend(page);

        if n < PAGE_SIZE {
            break; // Last page — fewer records than requested
        }

        offset += PAGE_SIZE;
        thread::sleep(StdDuration::from_millis(PAGE_SLEEP_MS));
    }

    Ok(all)
}

// ── Fuel normalization (mirrors server) ───────────────────────────────────

fn normalize_fuel(code: &str) -> &'static str {
    match code {
        "SUN"                                          => "solar",
        "WND"                                          => "wind",
        "NUC"                                          => "nuclear",
        "WAT"                                          => "hydro",
        "COL" | "BIT" | "SUB" | "LIG" | "ANT" | "RC" => "coal",
        "NG"  | "OG"  | "BFG" | "LFG" | "PC"         => "gas",
        _                                              => "other",
    }
}

// ── Parquet write (atomic temp-then-rename) ───────────────────────────────

fn write_parquet(dir: &Path, date: NaiveDate, mut df: DataFrame) -> Result<()> {
    std::fs::create_dir_all(dir)?;
    let final_path = dir.join(format!("{date}.parquet"));
    let tmp_path   = dir.join(format!("{date}.tmp.parquet"));
    let mut file = std::fs::File::create(&tmp_path)?;
    ParquetWriter::new(&mut file)
        .with_compression(ParquetCompression::Snappy)
        .finish(&mut df)?;
    std::fs::rename(&tmp_path, &final_path)?;
    Ok(())
}

// ── Gen: /rto/fuel-type-data/ ─────────────────────────────────────────────
//
// Schema: period String, ba String, fuel String, mw Float64

fn backfill_gen(
    client:   &reqwest::blocking::Client,
    eia_key:  &str,
    data_dir: &Path,
    date:     NaiveDate,
) -> Result<usize> {
    let base = format!(
        "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/\
         ?api_key={eia_key}\
         &frequency=hourly\
         &data[]=value\
         &start={date}T00&end={date}T23\
         &sort[0][column]=period&sort[0][direction]=asc"
    );

    let records = fetch_all(client, &base)?;
    if records.is_empty() {
        return Ok(0);
    }

    let mut periods: Vec<String> = Vec::with_capacity(records.len());
    let mut bas:     Vec<String> = Vec::with_capacity(records.len());
    let mut fuels:   Vec<String> = Vec::with_capacity(records.len());
    let mut mws:     Vec<f64>    = Vec::with_capacity(records.len());

    for r in &records {
        let Some(period) = as_str(&r["period"])     .map(|s| s.to_string()) else { continue };
        let Some(ba)     = as_str(&r["respondent"]) .map(|s| s.to_string()) else { continue };
        let Some(ft)     = as_str(&r["fueltype"])                            else { continue };
        let Some(mw)     = as_f64(&r["value"])                               else { continue };
        if mw <= 0.0 { continue; }

        periods.push(period);
        bas.push(ba);
        fuels.push(normalize_fuel(ft).to_string());
        mws.push(mw);
    }

    let rows = mws.len();
    if rows == 0 { return Ok(0); }

    let df = DataFrame::new(vec![
        Series::new("period".into(), periods.as_slice()),
        Series::new("ba".into(),     bas.as_slice()),
        Series::new("fuel".into(),   fuels.as_slice()),
        Series::new("mw".into(),     mws.as_slice()),
    ])?;

    write_parquet(&data_dir.join("gen"), date, df)?;
    Ok(rows)
}

// ── Interchange: /rto/interchange-data/ ───────────────────────────────────
//
// Schema: period String, from_ba String, to_ba String, mw Float64
// mw is the raw reported value (positive = flow from→to for that record)

fn backfill_interchange(
    client:   &reqwest::blocking::Client,
    eia_key:  &str,
    data_dir: &Path,
    date:     NaiveDate,
) -> Result<usize> {
    let base = format!(
        "https://api.eia.gov/v2/electricity/rto/interchange-data/data/\
         ?api_key={eia_key}\
         &frequency=hourly\
         &data[]=value\
         &start={date}T00&end={date}T23\
         &sort[0][column]=period&sort[0][direction]=asc"
    );

    let records = fetch_all(client, &base)?;
    if records.is_empty() {
        return Ok(0);
    }

    let mut periods:  Vec<String> = Vec::with_capacity(records.len());
    let mut from_bas: Vec<String> = Vec::with_capacity(records.len());
    let mut to_bas:   Vec<String> = Vec::with_capacity(records.len());
    let mut mws:      Vec<f64>    = Vec::with_capacity(records.len());

    for r in &records {
        let Some(period)  = as_str(&r["period"]) .map(|s| s.to_string()) else { continue };
        let Some(from_ba) = as_str(&r["fromba"]) .map(|s| s.to_string()) else { continue };
        let Some(to_ba)   = as_str(&r["toba"])   .map(|s| s.to_string()) else { continue };
        let Some(mw)      = as_f64(&r["value"])                           else { continue };

        periods.push(period);
        from_bas.push(from_ba);
        to_bas.push(to_ba);
        mws.push(mw);
    }

    let rows = mws.len();
    if rows == 0 { return Ok(0); }

    let df = DataFrame::new(vec![
        Series::new("period".into(),  periods.as_slice()),
        Series::new("from_ba".into(), from_bas.as_slice()),
        Series::new("to_ba".into(),   to_bas.as_slice()),
        Series::new("mw".into(),      mws.as_slice()),
    ])?;

    write_parquet(&data_dir.join("interchange"), date, df)?;
    Ok(rows)
}

// ── Demand: /rto/region-data/ ─────────────────────────────────────────────
//
// Schema: period String, ba String, demand_mw Float64
// Filtered to type=D (metered demand) only.

fn backfill_demand(
    client:   &reqwest::blocking::Client,
    eia_key:  &str,
    data_dir: &Path,
    date:     NaiveDate,
) -> Result<usize> {
    let base = format!(
        "https://api.eia.gov/v2/electricity/rto/region-data/data/\
         ?api_key={eia_key}\
         &frequency=hourly\
         &data[]=value\
         &facets[type][]=D\
         &start={date}T00&end={date}T23\
         &sort[0][column]=period&sort[0][direction]=asc"
    );

    let records = fetch_all(client, &base)?;
    if records.is_empty() {
        return Ok(0);
    }

    let mut periods:    Vec<String> = Vec::with_capacity(records.len());
    let mut bas:        Vec<String> = Vec::with_capacity(records.len());
    let mut demand_mws: Vec<f64>    = Vec::with_capacity(records.len());

    for r in &records {
        let Some(period) = as_str(&r["period"])     .map(|s| s.to_string()) else { continue };
        let Some(ba)     = as_str(&r["respondent"]) .map(|s| s.to_string()) else { continue };
        let Some(mw)     = as_f64(&r["value"])                               else { continue };
        if mw <= 0.0 { continue; }

        periods.push(period);
        bas.push(ba);
        demand_mws.push(mw);
    }

    let rows = demand_mws.len();
    if rows == 0 { return Ok(0); }

    let df = DataFrame::new(vec![
        Series::new("period".into(),    periods.as_slice()),
        Series::new("ba".into(),        bas.as_slice()),
        Series::new("demand_mw".into(), demand_mws.as_slice()),
    ])?;

    write_parquet(&data_dir.join("demand"), date, df)?;
    Ok(rows)
}

// ── Main ──────────────────────────────────────────────────────────────────

fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let args = parse_args()?;

    let client = reqwest::blocking::Client::builder()
        .timeout(StdDuration::from_secs(30))
        .build()?;

    // Remove any orphaned .tmp.parquet files from a previous interrupted run
    for sub in &["gen", "interchange", "demand"] {
        let dir = args.data_dir.join(sub);
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.file_name()
                    .and_then(|n| n.to_str())
                    .map_or(false, |n| n.ends_with(".tmp.parquet"))
                {
                    eprintln!("removing orphan: {}", path.display());
                    let _ = std::fs::remove_file(&path);
                }
            }
        }
    }

    let total_days = (args.end - args.start).num_days() + 1;
    eprintln!(
        "backfilling {} days  ({} → {})  data-dir: {}",
        total_days,
        args.start,
        args.end,
        args.data_dir.display()
    );
    eprintln!("(interrupt with Ctrl-C at any time — resumable, skips existing files)");
    eprintln!();

    let mut date      = args.start;
    let mut day_n     = 0i64;
    let mut skipped   = 0i64;
    let mut failed: Vec<(NaiveDate, String)> = Vec::new();

    while date <= args.end {
        day_n += 1;

        let gen_path  = args.data_dir.join("gen")         .join(format!("{date}.parquet"));
        let int_path  = args.data_dir.join("interchange") .join(format!("{date}.parquet"));
        let dem_path  = args.data_dir.join("demand")      .join(format!("{date}.parquet"));
        let all_exist = gen_path.exists() && int_path.exists() && dem_path.exists();

        if all_exist && !args.force {
            skipped += 1;
            date += Duration::days(1);
            continue;
        }

        eprint!("[{day_n}/{total_days}] {date}  gen=");

        let mut day_failed = false;

        match backfill_gen(&client, &args.eia_key, &args.data_dir, date) {
            Ok(n)  => eprint!("{n}"),
            Err(e) => { eprint!("ERR"); failed.push((date, format!("gen: {e:#}"))); day_failed = true; }
        }
        eprint!("  int=");

        match backfill_interchange(&client, &args.eia_key, &args.data_dir, date) {
            Ok(n)  => eprint!("{n}"),
            Err(e) => { eprint!("ERR"); if !day_failed { failed.push((date, format!("interchange: {e:#}"))); day_failed = true; } }
        }
        eprint!("  dem=");

        match backfill_demand(&client, &args.eia_key, &args.data_dir, date) {
            Ok(n)  => eprintln!("{n}"),
            Err(e) => { eprintln!("ERR"); if !day_failed { failed.push((date, format!("demand: {e:#}"))); } }
        }

        date += Duration::days(1);
    }

    eprintln!();
    eprintln!("done. processed={} skipped={} failed={}", day_n - skipped - failed.len() as i64, skipped, failed.len());

    if !failed.is_empty() {
        eprintln!("\nfailed dates (re-run with --start/--end to retry these, or use --force):");
        for (d, reason) in &failed {
            eprintln!("  {d}  {reason}");
        }
    }
    Ok(())
}
