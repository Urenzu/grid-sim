use anyhow::Result;
use axum::{extract::State, http::StatusCode, response::Json, routing::get, Router};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
struct AppState {
    eia_key:   String,
    http:      reqwest::Client,
    gen_cache: Arc<RwLock<Option<CachedGen>>>,
}

struct CachedGen {
    data:       Vec<BaGenData>,
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

#[derive(Serialize, Clone)]
pub struct FuelEntry {
    fuel: String,
    mw:   f64,
}

#[derive(Deserialize)]
struct EiaRecord {
    #[serde(rename = "fromba")]
    from_ba: String,
    #[serde(rename = "toba")]
    to_ba: String,
    value: Option<f64>,
    period: String,
}

// What we send to the frontend
#[derive(Serialize)]
pub struct GraphData {
    nodes: Vec<Node>,
    links: Vec<Link>,
    period: String,
}

#[derive(Serialize)]
pub struct Node {
    id: String,
    label: String,
}

#[derive(Serialize)]
pub struct Link {
    source: String,
    target: String,
    /// MW — positive means net flow source→target
    value: f64,
}

// The ~20 major balancing authorities we care about
const BALANCING_AUTHORITIES: &[(&str, &str)] = &[
    ("CISO", "California ISO"),
    ("ERCO", "ERCOT (Texas)"),
    ("MISO", "MISO"),
    ("PJM", "PJM"),
    ("NYIS", "NY ISO"),
    ("ISNE", "ISO New England"),
    ("SWPP", "Southwest Power Pool"),
    ("PACE", "PacifiCorp East"),
    ("PACW", "PacifiCorp West"),
    ("BPAT", "Bonneville Power"),
    ("IPCO", "Idaho Power"),
    ("NEVP", "NV Energy"),
    ("AZPS", "APS (Arizona)"),
    ("SRP", "Salt River Project"),
    ("WACM", "WAPA Colorado"),
    ("PSCO", "Xcel Energy Colorado"),
    ("TVA", "Tennessee Valley Auth"),
    ("DUK", "Duke Energy"),
    ("FPL", "Florida Power & Light"),
    ("SC", "South Carolina E&G"),
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

    let ba_facets: String = BALANCING_AUTHORITIES
        .iter()
        .map(|(id, _)| format!("&facets[respondent][]={}", id))
        .collect();

    let url = format!(
        "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/\
         ?api_key={}\
         &frequency=hourly\
         &data[]=value\
         {}\
         &sort[0][column]=period\
         &sort[0][direction]=desc\
         &length=500",
        state.eia_key, ba_facets
    );

    let resp: EiaFuelResponse = state.http.get(&url).send().await?.json().await?;
    let records = resp.response.data;

    let period = records.first().map(|r| r.period.clone()).unwrap_or_default();
    let latest: Vec<&FuelTypeRecord> = records.iter().filter(|r| r.period == period).collect();

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

async fn fetch_interchange(state: &AppState) -> Result<GraphData> {
    let ba_list = BALANCING_AUTHORITIES
        .iter()
        .map(|(id, _)| *id)
        .collect::<Vec<_>>()
        .join(",");

    // EIA v2 — electricity/rto/interchange-data, most recent hour
    let url = format!(
        "https://api.eia.gov/v2/electricity/rto/interchange-data/data/\
         ?api_key={}\
         &frequency=hourly\
         &data[]=value\
         &facets[fromba][]={}\
         &sort[0][column]=period\
         &sort[0][direction]=desc\
         &length=500\
         &offset=0",
        state.eia_key, ba_list,
    );

    let resp: EiaResponse = state.http.get(&url).send().await?.json().await?;
    let records = resp.response.data;

    // Use the most recent period in the response
    let period = records
        .first()
        .map(|r| r.period.clone())
        .unwrap_or_default();

    // Keep only records from the most recent period
    let latest: Vec<&EiaRecord> = records.iter().filter(|r| r.period == period).collect();

    let nodes = BALANCING_AUTHORITIES
        .iter()
        .map(|(id, label)| Node {
            id: id.to_string(),
            label: label.to_string(),
        })
        .collect();

    let links = latest
        .iter()
        .filter_map(|r| {
            let value = r.value?;
            if value == 0.0 {
                return None;
            }
            Some(Link {
                source: r.from_ba.clone(),
                target: r.to_ba.clone(),
                value,
            })
        })
        .collect();

    Ok(GraphData {
        nodes,
        links,
        period,
    })
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

    let state = Arc::new(AppState {
        eia_key,
        http:      reqwest::Client::new(),
        gen_cache: Arc::new(RwLock::new(None)),
    });

    let app = Router::new()
        .route("/health",          get(health_handler))
        .route("/api/interchange", get(interchange_handler))
        .route("/api/generation",  get(generation_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("listening on http://localhost:3000");
    axum::serve(listener, app).await?;
    Ok(())
}
