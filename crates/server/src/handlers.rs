use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use axum::{extract::{Query, State}, http::StatusCode, response::Json};
use chrono::Utc;

use crate::analytics::compute_ba_analytics;
use crate::domain::{carbon_intensity, normalize_fuel};
use crate::eia::{fetch_demand, fetch_generation, fetch_history, fetch_interchange};
use crate::parquet::{
    gap_fill_day, latest_local_date, write_demand_snapshot, write_gen_snapshot,
    write_interchange_snapshot,
};
use crate::types::{
    AnalyticsResponse, AppState, BaCarbonData, BaGenData, CompareParams, DuckPoint, FuelEntry,
    GenHistoryPoint, GraphData, HistoryParams,
};

// ── HTTP handlers ──────────────────────────────────────────────────────────

pub(crate) async fn health_handler() -> &'static str { "ok" }

pub(crate) async fn generation_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<BaGenData>>, StatusCode> {
    fetch_generation(&state).await.map(Json)
        .map_err(|e| { tracing::error!("gen: {e:#}"); StatusCode::BAD_GATEWAY })
}

pub(crate) async fn carbon_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<BaCarbonData>>, StatusCode> {
    let gen = fetch_generation(&state).await
        .map_err(|e| { tracing::error!("carbon gen: {e:#}"); StatusCode::BAD_GATEWAY })?;
    let result = gen.iter().map(|ba| BaCarbonData {
        ba:        ba.ba.clone(),
        intensity: carbon_intensity(&ba.fuels),
        total_mw:  ba.total_mw,
    }).collect();
    Ok(Json(result))
}

pub(crate) async fn history_handler(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HistoryParams>,
) -> Result<Json<Vec<GenHistoryPoint>>, StatusCode> {
    let hours     = params.hours.unwrap_or(48).min(168);
    let cache_key = format!("{}:{}", params.ba, hours);
    let state2    = Arc::clone(&state);
    let ba        = params.ba.clone();

    let cached = state.history_cache
        .try_get_with(cache_key, async move {
            let records = fetch_history(&state2, &ba, hours).await?;
            let mut period_map: HashMap<String, HashMap<String, f64>> = HashMap::new();
            for r in &records {
                if let Some(mw) = r.value {
                    if mw <= 0.0 { continue; }
                    let fuel = normalize_fuel(&r.fueltype).to_string();
                    *period_map.entry(r.period.clone()).or_default()
                        .entry(fuel).or_insert(0.0) += mw;
                }
            }
            let mut result: Vec<GenHistoryPoint> = period_map.into_iter().map(|(period, fuel_map)| {
                let total_mw: f64 = fuel_map.values().sum();
                let mut fuels: Vec<FuelEntry> = fuel_map.into_iter()
                    .map(|(fuel, mw)| FuelEntry { fuel, mw })
                    .collect();
                fuels.sort_by(|a, b| b.mw.partial_cmp(&a.mw).unwrap_or(std::cmp::Ordering::Equal));
                GenHistoryPoint { period, fuels, total_mw }
            }).collect();
            result.sort_by(|a, b| a.period.cmp(&b.period));
            Ok::<_, anyhow::Error>(Arc::new(serde_json::to_value(&result)?))
        })
        .await
        .map_err(|e| { tracing::error!("history {}: {e:#}", params.ba); StatusCode::BAD_GATEWAY })?;

    let data = serde_json::from_value::<Vec<GenHistoryPoint>>((*cached).clone())
        .map_err(|e| { tracing::error!("history deser: {e}"); StatusCode::INTERNAL_SERVER_ERROR })?;
    Ok(Json(data))
}

pub(crate) async fn duck_curve_handler(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HistoryParams>,
) -> Result<Json<Vec<DuckPoint>>, StatusCode> {
    let hours     = params.hours.unwrap_or(48).min(168);
    let cache_key = format!("duck:{}:{}", params.ba, hours);
    let state2    = Arc::clone(&state);
    let ba        = params.ba.clone();

    let cached = state.history_cache
        .try_get_with(cache_key, async move {
            let records = fetch_history(&state2, &ba, hours).await?;
            let mut period_map: HashMap<String, HashMap<String, f64>> = HashMap::new();
            for r in &records {
                if let Some(mw) = r.value {
                    if mw <= 0.0 { continue; }
                    let fuel = normalize_fuel(&r.fueltype).to_string();
                    *period_map.entry(r.period.clone()).or_default()
                        .entry(fuel).or_insert(0.0) += mw;
                }
            }
            let mut result: Vec<DuckPoint> = period_map.into_iter().map(|(period, fuel_map)| {
                let solar_mw   = *fuel_map.get("solar").unwrap_or(&0.0);
                let wind_mw    = *fuel_map.get("wind").unwrap_or(&0.0);
                let nuclear_mw = *fuel_map.get("nuclear").unwrap_or(&0.0);
                let gas_mw     = *fuel_map.get("gas").unwrap_or(&0.0);
                let coal_mw    = *fuel_map.get("coal").unwrap_or(&0.0);
                let hydro_mw   = *fuel_map.get("hydro").unwrap_or(&0.0);
                let total_mw: f64 = fuel_map.values().sum();
                let net_load_mw   = (total_mw - solar_mw - wind_mw).max(0.0);
                let fuels: Vec<FuelEntry> = fuel_map.iter()
                    .map(|(fuel, &mw)| FuelEntry { fuel: fuel.clone(), mw })
                    .collect();
                let intensity = carbon_intensity(&fuels);
                DuckPoint { period, total_mw, solar_mw, wind_mw, net_load_mw,
                            nuclear_mw, gas_mw, coal_mw, hydro_mw, intensity }
            }).collect();
            result.sort_by(|a, b| a.period.cmp(&b.period));
            Ok::<_, anyhow::Error>(Arc::new(serde_json::to_value(&result)?))
        })
        .await
        .map_err(|e| { tracing::error!("duck {}: {e:#}", params.ba); StatusCode::BAD_GATEWAY })?;

    let data = serde_json::from_value::<Vec<DuckPoint>>((*cached).clone())
        .map_err(|e| { tracing::error!("duck deser: {e}"); StatusCode::INTERNAL_SERVER_ERROR })?;
    Ok(Json(data))
}

pub(crate) async fn interchange_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<GraphData>, StatusCode> {
    fetch_interchange(&state).await.map(Json)
        .map_err(|e| { tracing::error!("interchange: {e:#}"); StatusCode::BAD_GATEWAY })
}

pub(crate) async fn analytics_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<AnalyticsResponse>, StatusCode> {
    let gen = fetch_generation(&state).await
        .map_err(|e| { tracing::error!("analytics gen: {e:#}"); StatusCode::BAD_GATEWAY })?;
    compute_ba_analytics(&gen)
        .map(Json)
        .map_err(|e| { tracing::error!("analytics compute: {e:#}"); StatusCode::INTERNAL_SERVER_ERROR })
}

pub(crate) async fn compare_handler(
    State(state): State<Arc<AppState>>,
    Query(params): Query<CompareParams>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let requested: std::collections::HashSet<&str> =
        params.bas.split(',').map(str::trim).collect();
    let gen = fetch_generation(&state).await
        .map_err(|e| { tracing::error!("compare gen: {e:#}"); StatusCode::BAD_GATEWAY })?;
    let result = compute_ba_analytics(&gen)
        .map_err(|e| { tracing::error!("compare compute: {e:#}"); StatusCode::INTERNAL_SERVER_ERROR })?;

    let g = &result.grid;
    let entries: Vec<serde_json::Value> = result.rankings.iter()
        .filter(|r| requested.contains(r.ba.as_str()))
        .map(|r| serde_json::json!({
            "ba":                   r.ba,
            "label":                r.label,
            "totalMw":              r.total_mw,
            "carbonIntensity":      r.carbon_intensity,
            "renewablePct":         r.renewable_pct,
            "cleanPct":             r.clean_pct,
            "dominantFuel":         r.dominant_fuel,
            "fuels":                r.fuels,
            "deltaCarbonIntensity": r.carbon_intensity - g.carbon_intensity,
            "deltaRenewablePct":    r.renewable_pct    - g.renewable_pct,
            "deltaCleanPct":        r.clean_pct        - g.clean_pct,
        }))
        .collect();
    Ok(Json(serde_json::json!({ "entries": entries, "grid": g })))
}

// ── Smart data task ────────────────────────────────────────────────────────
//
// On startup:
//   1. Scan data/gen/ for the most recent local date.
//   2. If a gap exists between that date and yesterday, fill it via the
//      range-fetch functions (same logic as the backfill binary).
//
// Steady state:
//   3. Poll every 10 minutes. Compare returned EIA period against last seen.
//   4. Only write Parquet when a genuinely new period arrives (~once/hour).

pub(crate) async fn smart_data_task(state: Arc<AppState>) {
    let data_dir = state.data_dir.clone();
    let today     = Utc::now().date_naive();
    let yesterday = today - chrono::Duration::days(1);

    // ── Phase 1: gap-fill ─────────────────────────────────────────────────
    match latest_local_date(&data_dir) {
        None => {
            tracing::info!("no local Parquet found — accumulating from today");
        }
        Some(latest) if latest < yesterday => {
            let gap = (yesterday - latest).num_days();
            tracing::info!("gap-fill: {} day(s) missing (from {} to {})", gap,
                latest + chrono::Duration::days(1), yesterday);
            let mut d = latest + chrono::Duration::days(1);
            while d <= yesterday {
                match gap_fill_day(&state, d).await {
                    Ok(_)  => tracing::info!("gap-fill: {} done", d),
                    Err(e) => tracing::warn!("gap-fill: {} failed: {e:#}", d),
                }
                d += chrono::Duration::days(1);
            }
            tracing::info!("gap-fill complete");
        }
        Some(latest) => {
            tracing::info!("up to date, latest local date: {}", latest);
        }
    }

    // ── Phase 2: steady-state polling ─────────────────────────────────────
    // Warm caches immediately so the first API request is instant.
    if let Err(e) = fetch_generation(&state).await  { tracing::warn!("init gen: {e:#}"); }
    if let Err(e) = fetch_interchange(&state).await { tracing::warn!("init interchange: {e:#}"); }
    if let Err(e) = fetch_demand(&state).await      { tracing::warn!("init demand: {e:#}"); }

    let mut last_seen_period = String::new();
    let mut interval = tokio::time::interval(Duration::from_secs(10 * 60));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        interval.tick().await;

        let gen = match fetch_generation(&state).await {
            Ok(g)  => g,
            Err(e) => { tracing::warn!("poll gen: {e:#}"); continue; }
        };
        if let Err(e) = fetch_interchange(&state).await { tracing::warn!("poll interchange: {e:#}"); }
        if let Err(e) = fetch_demand(&state).await      { tracing::warn!("poll demand: {e:#}"); }

        // Max period across all BAs in this snapshot
        let current_period = gen.iter().map(|b| b.period.as_str()).max()
            .unwrap_or("").to_string();

        if current_period.is_empty() || current_period == last_seen_period {
            tracing::debug!("poll: period unchanged ({}), no write", current_period);
            continue;
        }

        tracing::info!("poll: new period {} — writing Parquet", current_period);
        last_seen_period = current_period;
        let today = Utc::now().date_naive();

        if let Err(e) = write_gen_snapshot(&data_dir, today, &gen) {
            tracing::warn!("gen write: {e:#}");
        }
        {
            let cache = state.interchange_cache.read().await;
            if let Some(c) = &*cache {
                if let Err(e) = write_interchange_snapshot(&data_dir, today, &c.raw) {
                    tracing::warn!("interchange write: {e:#}");
                }
            }
        }
        {
            let cache = state.demand_cache.read().await;
            if let Some(c) = &*cache {
                if let Err(e) = write_demand_snapshot(&data_dir, today, &c.data) {
                    tracing::warn!("demand write: {e:#}");
                }
            }
        }
    }
}
