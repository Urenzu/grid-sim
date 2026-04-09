use anyhow::Result;
use axum::{extract::{Query, State}, http::StatusCode, response::Json, routing::get, Router};
use chrono::Utc;
use moka::future::Cache;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;

/// EIA sometimes returns numeric values as JSON strings (e.g. "918" instead of 918).
fn deserialize_opt_f64<'de, D>(d: D) -> Result<Option<f64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::Error;
    let v: Option<serde_json::Value> = Option::deserialize(d)?;
    match v {
        None | Some(serde_json::Value::Null) => Ok(None),
        Some(serde_json::Value::Number(n))   => Ok(n.as_f64()),
        Some(serde_json::Value::String(s))   => s.parse::<f64>().map(Some)
            .map_err(|_| D::Error::custom(format!("invalid numeric string: {s}"))),
        Some(other) => Err(D::Error::custom(format!("expected number or string, got {other}"))),
    }
}

#[derive(Clone)]
struct AppState {
    eia_key:           String,
    http:              reqwest::Client,
    gen_cache:         Arc<RwLock<Option<CachedGen>>>,
    interchange_cache: Arc<RwLock<Option<CachedInterchange>>>,
    /// Keyed by "ba:hours" or "duck:ba:hours". TTL + eviction managed by moka.
    history_cache:     Cache<String, Arc<serde_json::Value>>,
}

struct CachedGen {
    data:       Vec<BaGenData>,
    fetched_at: Instant,
}

struct CachedInterchange {
    data:       GraphData,
    fetched_at: Instant,
}

// ── EIA interchange response ──────────────────────────────────────────────
#[derive(Deserialize)]
struct EiaResponse {
    response: EiaData,
}

#[derive(Deserialize)]
struct EiaData {
    data: Vec<EiaRecord>,
}

// ── EIA fuel-type-data response ───────────────────────────────────────────
#[derive(Deserialize)]
struct EiaFuelResponse {
    response: EiaFuelData,
}

#[derive(Deserialize)]
struct EiaFuelData {
    data: Vec<FuelTypeRecord>,
}

#[derive(Deserialize)]
struct FuelTypeRecord {
    respondent: String,
    fueltype:   String,
    #[serde(deserialize_with = "deserialize_opt_f64")]
    value:      Option<f64>,
    period:     String,
}

// ── Generation output ─────────────────────────────────────────────────────
#[derive(Serialize, Clone)]
pub struct BaGenData {
    ba:             String,
    #[serde(rename = "totalMw")]
    total_mw:       f64,
    #[serde(rename = "dominantFuel")]
    dominant_fuel:  String,
    fuels:          Vec<FuelEntry>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FuelEntry {
    fuel: String,
    mw:   f64,
}

// ── Carbon output ─────────────────────────────────────────────────────────
#[derive(Serialize, Clone)]
pub struct BaCarbonData {
    ba:        String,
    intensity: f64,
    #[serde(rename = "totalMw")]
    total_mw:  f64,
}

// ── History output ────────────────────────────────────────────────────────
#[derive(Serialize, Deserialize, Clone)]
pub struct GenHistoryPoint {
    period:  String,
    fuels:   Vec<FuelEntry>,
    #[serde(rename = "totalMw")]
    total_mw: f64,
}

// ── Duck curve output ─────────────────────────────────────────────────────
#[derive(Serialize, Deserialize, Clone)]
pub struct DuckPoint {
    period:    String,
    #[serde(rename = "totalMw")]
    total_mw:  f64,
    #[serde(rename = "solarMw")]
    solar_mw:  f64,
    #[serde(rename = "windMw")]
    wind_mw:   f64,
    #[serde(rename = "netLoadMw")]
    net_load_mw: f64,
    #[serde(rename = "nuclearMw")]
    nuclear_mw: f64,
    #[serde(rename = "gasMw")]
    gas_mw:    f64,
    #[serde(rename = "coalMw")]
    coal_mw:   f64,
    #[serde(rename = "hydroMw")]
    hydro_mw:  f64,
    intensity: f64,
}

#[derive(Deserialize)]
struct EiaRecord {
    #[serde(rename = "fromba")]
    from_ba: String,
    #[serde(rename = "toba")]
    to_ba: String,
    #[serde(deserialize_with = "deserialize_opt_f64")]
    value: Option<f64>,
    period: String,
}

// What we send to the frontend
#[derive(Serialize, Clone)]
pub struct GraphData {
    nodes: Vec<Node>,
    links: Vec<Link>,
    period: String,
}

#[derive(Serialize, Clone)]
pub struct Node {
    id: String,
    label: String,
}

#[derive(Serialize, Clone)]
pub struct Link {
    source: String,
    target: String,
    /// MW — positive means net flow source→target
    value: f64,
}

// ── Query params ──────────────────────────────────────────────────────────
#[derive(Deserialize)]
struct HistoryParams {
    ba:    String,
    hours: Option<u32>,
}

// All known balancing authorities — used as a label lookup only.
const BA_LABELS: &[(&str, &str)] = &[
    // Western Interconnection
    ("CISO", "California ISO"),
    ("BPAT", "Bonneville Power Admin"),
    ("PACW", "PacifiCorp West"),
    ("PACE", "PacifiCorp East"),
    ("IPCO", "Idaho Power"),
    ("NEVP", "NV Energy"),
    ("AZPS", "Arizona Public Service"),
    ("SRP",  "Salt River Project"),
    ("WACM", "WAPA Colorado"),
    ("PSCO", "Xcel Energy Colorado"),
    ("AVA",  "Avista Corporation"),
    ("DOPD", "Douglas County PUD"),
    ("GCPD", "Grant County PUD"),
    ("CHPD", "Chelan County PUD"),
    ("TPWR", "City of Tacoma"),
    ("SCL",  "Seattle City Light"),
    ("PSEI", "Puget Sound Energy"),
    ("PGE",  "Portland General Electric"),
    ("PNM",  "Public Service NM"),
    ("EPE",  "El Paso Electric"),
    ("TEPC", "Tucson Electric Power"),
    ("IID",  "Imperial Irrigation District"),
    ("LDWP", "LA Dept of Water & Power"),
    ("BANC", "Balancing Auth of N. California"),
    ("TIDC", "Turlock Irrigation District"),
    ("NWMT", "Northwestern Energy MT"),
    ("GWA",  "NaturEner Wind Watch MT"),
    ("WALC", "WAPA Desert Southwest"),
    ("DEAA", "Arlington Valley LLC"),
    ("HGMA", "Harquahala Generating"),
    // Texas
    ("ERCO", "ERCOT (Texas)"),
    // Eastern Interconnection
    ("MISO", "Midcontinent ISO"),
    ("PJM",  "PJM Interconnection"),
    ("SWPP", "Southwest Power Pool"),
    ("TVA",  "Tennessee Valley Authority"),
    ("SOCO", "Southern Company"),
    ("DUK",  "Duke Energy"),
    ("CPLE", "Duke Energy Progress East"),
    ("CPLW", "Duke Energy Progress West"),
    ("SC",   "Santee Cooper"),
    ("SCEG", "Dominion Energy SC"),
    ("FPL",  "Florida Power & Light"),
    ("FPC",  "Duke Energy Florida"),
    ("TEC",  "Tampa Electric"),
    ("FMPP", "FL Municipal Power Pool"),
    ("GVL",  "Gainesville Regional Utilities"),
    ("HST",  "City of Homestead FL"),
    ("JEA",  "Jacksonville Electric Auth"),
    ("TAL",  "City of Tallahassee FL"),
    ("SEPA", "Southeastern Power Admin"),
    ("LGEE", "LG&E and KU Energy"),
    ("AECI", "Associated Electric Coop"),
    ("OVEC", "Ohio Valley Electric Corp"),
    ("EDE",  "Empire District Electric"),
    ("SPA",  "Southwestern Power Admin"),
    ("WAUW", "WAPA Upper Great Plains"),
    ("BHBA", "Black Hills Energy"),
    ("WWA",  "NaturEner Rim Rock MT"),
    ("SEC",  "Seminole Electric"),
    ("NYIS", "New York ISO"),
    ("ISNE", "ISO New England"),
    // Canada / Mexico
    ("HQT",  "Hydro-Québec"),
    ("IESO", "Ontario IESO"),
    ("MHEB", "Manitoba Hydro"),
    ("NBSO", "NB System Operator"),
    ("AESO", "Alberta Electric System"),
    ("BCHA", "BC Hydro"),
    ("CEN",  "CFE Mexico"),
    ("CFE",  "CFE Mexico"),
];

fn normalize_fuel(code: &str) -> &'static str {
    match code {
        "SUN"                              => "solar",
        "WND"                              => "wind",
        "NUC"                              => "nuclear",
        "WAT"                              => "hydro",
        "COL" | "BIT" | "SUB" | "LIG" | "ANT" | "RC" => "coal",
        "NG"  | "OG"  | "BFG" | "LFG" | "PC"          => "gas",
        _                                  => "other",
    }
}

fn emission_factor(fuel: &str) -> f64 {
    match fuel {
        "coal"    => 1001.0,
        "gas"     => 443.0,
        "nuclear" | "wind" | "solar" | "hydro" => 0.0,
        _         => 500.0,
    }
}

fn carbon_intensity(fuels: &[FuelEntry]) -> f64 {
    let total: f64 = fuels.iter().map(|f| f.mw).sum();
    if total <= 0.0 { return 0.0; }
    fuels.iter().map(|f| f.mw * emission_factor(&f.fuel)).sum::<f64>() / total
}

fn eia_period(hours_ago: u32) -> String {
    let dt = Utc::now() - chrono::Duration::hours(hours_ago as i64);
    dt.format("%Y-%m-%dT%H").to_string()
}

async fn fetch_generation(state: &AppState) -> Result<Vec<BaGenData>> {
    // Return cached data if fresh (< 5 minutes old)
    {
        let cache = state.gen_cache.read().await;
        if let Some(c) = &*cache {
            if c.fetched_at.elapsed() < Duration::from_secs(5 * 60) {
                return Ok(c.data.clone());
            }
        }
    }

    let url = format!(
        "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/\
         ?api_key={}\
         &frequency=hourly\
         &data[]=value\
         &sort[0][column]=period\
         &sort[0][direction]=desc\
         &length=8000",
        state.eia_key
    );

    let resp: EiaFuelResponse = state.http.get(&url).send().await?.json().await?;
    let records = resp.response.data;

    // Each BA may have a different reporting lag — find the most recent period per BA
    let mut ba_latest: HashMap<String, String> = HashMap::new();
    for r in &records {
        let entry = ba_latest.entry(r.respondent.clone()).or_insert_with(|| r.period.clone());
        if r.period > *entry { *entry = r.period.clone(); }
    }
    let latest: Vec<&FuelTypeRecord> = records.iter()
        .filter(|r| ba_latest.get(&r.respondent).map_or(false, |p| *p == r.period))
        .collect();

    // Aggregate: BA → fuel → total MW
    let mut ba_map: HashMap<String, HashMap<String, f64>> = HashMap::new();
    for r in &latest {
        if let Some(mw) = r.value {
            if mw <= 0.0 { continue; }
            let fuel = normalize_fuel(&r.fueltype).to_string();
            *ba_map.entry(r.respondent.clone()).or_default()
                .entry(fuel).or_insert(0.0) += mw;
        }
    }

    let mut result: Vec<BaGenData> = ba_map.into_iter().map(|(ba, fuel_map)| {
        let total_mw: f64 = fuel_map.values().sum();
        let dominant_fuel = fuel_map.iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(f, _)| f.clone())
            .unwrap_or_else(|| "other".to_string());
        let mut fuels: Vec<FuelEntry> = fuel_map.into_iter()
            .map(|(fuel, mw)| FuelEntry { fuel, mw })
            .collect();
        fuels.sort_by(|a, b| b.mw.partial_cmp(&a.mw).unwrap_or(std::cmp::Ordering::Equal));
        BaGenData { ba, total_mw, dominant_fuel, fuels }
    }).collect();
    result.sort_by(|a, b| b.total_mw.partial_cmp(&a.total_mw).unwrap_or(std::cmp::Ordering::Equal));

    let mut cache = state.gen_cache.write().await;
    *cache = Some(CachedGen { data: result.clone(), fetched_at: Instant::now() });

    Ok(result)
}

async fn fetch_history(state: &AppState, ba: &str, hours: u32) -> Result<Vec<FuelTypeRecord>> {
    let start = eia_period(hours);
    let end   = eia_period(0);

    let url = format!(
        "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/\
         ?api_key={}\
         &frequency=hourly\
         &data[]=value\
         &facets[respondent][]={}\
         &start={}\
         &end={}\
         &sort[0][column]=period\
         &sort[0][direction]=asc\
         &length={}",
        state.eia_key,
        ba,
        start,
        end,
        hours * 10, // up to 10 fuel types per hour
    );

    let resp: EiaFuelResponse = state.http.get(&url).send().await?.json().await?;
    Ok(resp.response.data)
}

async fn generation_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<BaGenData>>, StatusCode> {
    fetch_generation(&state)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("EIA generation fetch failed: {e:#}");
            StatusCode::BAD_GATEWAY
        })
}

async fn carbon_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<BaCarbonData>>, StatusCode> {
    let gen = fetch_generation(&state).await.map_err(|e| {
        tracing::error!("EIA generation fetch failed: {e:#}");
        StatusCode::BAD_GATEWAY
    })?;

    let result: Vec<BaCarbonData> = gen.iter().map(|ba| {
        BaCarbonData {
            ba:        ba.ba.clone(),
            intensity: carbon_intensity(&ba.fuels),
            total_mw:  ba.total_mw,
        }
    }).collect();

    Ok(Json(result))
}

async fn history_handler(
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
        .map_err(|e| { tracing::error!("EIA history fetch failed for {}: {e:#}", params.ba); StatusCode::BAD_GATEWAY })?;

    let data = serde_json::from_value::<Vec<GenHistoryPoint>>((*cached).clone())
        .map_err(|e| { tracing::error!("history deserialize failed: {e}"); StatusCode::INTERNAL_SERVER_ERROR })?;
    Ok(Json(data))
}

async fn duck_curve_handler(
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
                let net_load_mw = (total_mw - solar_mw - wind_mw).max(0.0);
                let fuels: Vec<FuelEntry> = fuel_map.iter()
                    .map(|(fuel, &mw)| FuelEntry { fuel: fuel.clone(), mw })
                    .collect();
                let intensity = carbon_intensity(&fuels);
                DuckPoint { period, total_mw, solar_mw, wind_mw, net_load_mw, nuclear_mw, gas_mw, coal_mw, hydro_mw, intensity }
            }).collect();
            result.sort_by(|a, b| a.period.cmp(&b.period));
            Ok::<_, anyhow::Error>(Arc::new(serde_json::to_value(&result)?))
        })
        .await
        .map_err(|e| { tracing::error!("EIA duck-curve fetch failed for {}: {e:#}", params.ba); StatusCode::BAD_GATEWAY })?;

    let data = serde_json::from_value::<Vec<DuckPoint>>((*cached).clone())
        .map_err(|e| { tracing::error!("duck deserialize failed: {e}"); StatusCode::INTERNAL_SERVER_ERROR })?;
    Ok(Json(data))
}

async fn fetch_interchange(state: &AppState) -> Result<GraphData> {
    {
        let cache = state.interchange_cache.read().await;
        if let Some(c) = &*cache {
            if c.fetched_at.elapsed() < Duration::from_secs(5 * 60) {
                return Ok(c.data.clone());
            }
        }
    }

    let url = format!(
        "https://api.eia.gov/v2/electricity/rto/interchange-data/data/\
         ?api_key={}\
         &frequency=hourly\
         &data[]=value\
         &sort[0][column]=period\
         &sort[0][direction]=desc\
         &length=5000",
        state.eia_key,
    );

    let resp: EiaResponse = state.http.get(&url).send().await?.json().await?;
    let records = resp.response.data;

    let ba_label: HashMap<&str, &str> = BA_LABELS.iter().cloned().collect();

    let mut pair_latest: HashMap<(String, String), (String, f64)> = HashMap::new();
    for r in &records {
        let value = match r.value { Some(v) if v != 0.0 => v, _ => continue };
        let key = (r.from_ba.clone(), r.to_ba.clone());
        let is_newer = pair_latest.get(&key).map_or(true, |(p, _)| r.period > *p);
        if is_newer { pair_latest.insert(key, (r.period.clone(), value)); }
    }

    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    for (from, to) in pair_latest.keys() {
        seen.insert(from.clone());
        seen.insert(to.clone());
    }
    let mut nodes: Vec<Node> = seen.into_iter().map(|id| {
        let label = ba_label.get(id.as_str()).copied().unwrap_or(&id).to_string();
        Node { id, label }
    }).collect();
    nodes.sort_by(|a, b| a.id.cmp(&b.id));

    let mut net: HashMap<(String, String), f64> = HashMap::new();
    for ((from, to), (_, value)) in &pair_latest {
        let (a, b, sign) = if from < to {
            (from.clone(), to.clone(),  1.0_f64)
        } else {
            (to.clone(),  from.clone(), -1.0_f64)
        };
        *net.entry((a, b)).or_insert(0.0) += value * sign;
    }

    let period = pair_latest.values()
        .map(|(p, _)| p.as_str())
        .max()
        .unwrap_or("")
        .to_string();

    let links = net.into_iter()
        .filter_map(|((a, b), net_val)| {
            if net_val.abs() < 1.0 { return None; }
            Some(if net_val >= 0.0 {
                Link { source: a, target: b, value: net_val }
            } else {
                Link { source: b, target: a, value: -net_val }
            })
        })
        .collect();

    let result = GraphData { nodes, links, period };
    let mut cache = state.interchange_cache.write().await;
    *cache = Some(CachedInterchange { data: result.clone(), fetched_at: Instant::now() });
    Ok(result)
}

async fn interchange_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<GraphData>, StatusCode> {
    fetch_interchange(&state)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("EIA fetch failed: {e:#}");
            StatusCode::BAD_GATEWAY
        })
}

async fn health_handler() -> &'static str {
    "ok"
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    dotenvy::dotenv().ok();

    let eia_key = std::env::var("EIA_API_KEY").expect("EIA_API_KEY must be set");

    let history_cache = Cache::builder()
        .max_capacity(512)
        .time_to_live(Duration::from_secs(5 * 60))
        .build();

    let state = Arc::new(AppState {
        eia_key,
        http:              reqwest::Client::new(),
        gen_cache:         Arc::new(RwLock::new(None)),
        interchange_cache: Arc::new(RwLock::new(None)),
        history_cache,
    });

    // Background refresh — warms both caches on startup, then every 4.5 minutes.
    // Users always get instant responses; no one hits a cold gen or interchange cache.
    tokio::spawn({
        let state = Arc::clone(&state);
        async move {
            let mut interval = tokio::time::interval(Duration::from_secs(4 * 60 + 30));
            loop {
                interval.tick().await;
                if let Err(e) = fetch_generation(&state).await {
                    tracing::warn!("background gen refresh failed: {e:#}");
                }
                if let Err(e) = fetch_interchange(&state).await {
                    tracing::warn!("background interchange refresh failed: {e:#}");
                }
            }
        }
    });

    let app = Router::new()
        .route("/health",          get(health_handler))
        .route("/api/interchange", get(interchange_handler))
        .route("/api/generation",  get(generation_handler))
        .route("/api/carbon",      get(carbon_handler))
        .route("/api/history",     get(history_handler))
        .route("/api/duck-curve",  get(duck_curve_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("listening on http://localhost:3000");
    axum::serve(listener, app).await?;
    Ok(())
}
