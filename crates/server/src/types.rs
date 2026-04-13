use moka::future::Cache;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

// ── EIA numeric deserializer ───────────────────────────────────────────────

/// EIA sometimes returns numeric values as JSON strings ("918" instead of 918).
pub(crate) fn deserialize_opt_f64<'de, D>(d: D) -> Result<Option<f64>, D::Error>
where D: serde::Deserializer<'de> {
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

// ── Analytics output ───────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct BaAnalytics {
    pub ba:               String,
    pub label:            String,
    #[serde(rename = "totalMw")]
    pub total_mw:         f64,
    #[serde(rename = "carbonIntensity")]
    pub carbon_intensity: f64,
    #[serde(rename = "renewablePct")]
    pub renewable_pct:    f64,
    #[serde(rename = "cleanPct")]
    pub clean_pct:        f64,
    #[serde(rename = "dominantFuel")]
    pub dominant_fuel:    String,
    pub fuels:            Vec<FuelEntry>,
}

#[derive(Serialize, Clone, Default)]
pub struct GridStats {
    #[serde(rename = "totalMw")]
    pub total_mw:         f64,
    #[serde(rename = "carbonIntensity")]
    pub carbon_intensity: f64,
    #[serde(rename = "renewablePct")]
    pub renewable_pct:    f64,
    #[serde(rename = "cleanPct")]
    pub clean_pct:        f64,
    #[serde(rename = "baCount")]
    pub ba_count:         usize,
}

#[derive(Serialize, Clone)]
pub struct AnalyticsResponse {
    pub rankings: Vec<BaAnalytics>,
    pub grid:     GridStats,
}

// ── EIA response types ─────────────────────────────────────────────────────

#[derive(Deserialize)]
pub(crate) struct EiaResponse {
    pub(crate) response: EiaData,
}

#[derive(Deserialize)]
pub(crate) struct EiaData {
    pub(crate) data: Vec<EiaRecord>,
}

#[derive(Deserialize)]
pub(crate) struct EiaFuelResponse {
    pub(crate) response: EiaFuelData,
}

#[derive(Deserialize)]
pub(crate) struct EiaFuelData {
    pub(crate) data: Vec<FuelTypeRecord>,
}

#[derive(Deserialize)]
pub(crate) struct FuelTypeRecord {
    pub(crate) respondent: String,
    pub(crate) fueltype:   String,
    #[serde(deserialize_with = "deserialize_opt_f64")]
    pub(crate) value:      Option<f64>,
    pub(crate) period:     String,
}

#[derive(Deserialize)]
pub(crate) struct EiaRecord {
    #[serde(rename = "fromba")]
    pub(crate) from_ba: String,
    #[serde(rename = "toba")]
    pub(crate) to_ba:   String,
    #[serde(deserialize_with = "deserialize_opt_f64")]
    pub(crate) value:   Option<f64>,
    pub(crate) period:  String,
}

#[derive(Deserialize)]
pub(crate) struct EiaRegionResponse {
    pub(crate) response: EiaRegionData,
}

#[derive(Deserialize)]
pub(crate) struct EiaRegionData {
    pub(crate) data: Vec<RegionRecord>,
}

#[derive(Deserialize)]
pub(crate) struct RegionRecord {
    pub(crate) respondent: String,
    #[serde(deserialize_with = "deserialize_opt_f64")]
    pub(crate) value:      Option<f64>,
    pub(crate) period:     String,
}

// ── Output / cache types ───────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct BaGenData {
    pub ba:            String,
    /// Snapshot period from EIA — skipped in API JSON, used for Parquet writes.
    #[serde(skip)]
    pub period:        String,
    #[serde(rename = "totalMw")]
    pub total_mw:      f64,
    #[serde(rename = "dominantFuel")]
    pub dominant_fuel: String,
    pub fuels:         Vec<FuelEntry>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FuelEntry {
    pub fuel: String,
    pub mw:   f64,
}

#[derive(Serialize, Clone)]
pub struct BaCarbonData {
    pub ba:        String,
    pub intensity: f64,
    #[serde(rename = "totalMw")]
    pub total_mw:  f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GenHistoryPoint {
    pub period:   String,
    pub fuels:    Vec<FuelEntry>,
    #[serde(rename = "totalMw")]
    pub total_mw: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DuckPoint {
    pub period:      String,
    #[serde(rename = "totalMw")]
    pub total_mw:    f64,
    #[serde(rename = "solarMw")]
    pub solar_mw:    f64,
    #[serde(rename = "windMw")]
    pub wind_mw:     f64,
    #[serde(rename = "netLoadMw")]
    pub net_load_mw: f64,
    #[serde(rename = "nuclearMw")]
    pub nuclear_mw:  f64,
    #[serde(rename = "gasMw")]
    pub gas_mw:      f64,
    #[serde(rename = "coalMw")]
    pub coal_mw:     f64,
    #[serde(rename = "hydroMw")]
    pub hydro_mw:    f64,
    pub intensity:   f64,
}

#[derive(Serialize, Clone)]
pub struct GraphData {
    pub nodes:  Vec<Node>,
    pub links:  Vec<Link>,
    pub period: String,
}

#[derive(Serialize, Clone)]
pub struct Node {
    pub id:    String,
    pub label: String,
}

#[derive(Serialize, Clone)]
pub struct Link {
    pub source: String,
    pub target: String,
    /// MW — positive means net flow source→target
    pub value:  f64,
}

/// Raw interchange record stored alongside GraphData for Parquet writes.
pub(crate) struct InterchangeRaw {
    pub(crate) period:  String,
    pub(crate) from_ba: String,
    pub(crate) to_ba:   String,
    pub(crate) mw:      f64,
}

/// Demand snapshot entry (metered load per BA).
#[derive(Clone)]
pub(crate) struct DemandEntry {
    pub(crate) period:    String,
    pub(crate) ba:        String,
    pub(crate) demand_mw: f64,
}

// ── Cache structs ──────────────────────────────────────────────────────────

pub(crate) struct CachedGen {
    pub(crate) data:       Vec<BaGenData>,
    pub(crate) fetched_at: Instant,
}

pub(crate) struct CachedInterchange {
    pub(crate) data:       GraphData,
    pub(crate) raw:        Vec<InterchangeRaw>,
    pub(crate) fetched_at: Instant,
}

pub(crate) struct CachedDemand {
    pub(crate) data:       Vec<DemandEntry>,
    pub(crate) fetched_at: Instant,
}

// ── App state ──────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AppState {
    pub eia_key:           String,
    pub http:              reqwest::Client,
    pub gen_cache:         Arc<RwLock<Option<CachedGen>>>,
    pub interchange_cache: Arc<RwLock<Option<CachedInterchange>>>,
    pub demand_cache:      Arc<RwLock<Option<CachedDemand>>>,
    /// Keyed by "ba:hours" or "duck:ba:hours". TTL managed by moka.
    pub history_cache:     Cache<String, Arc<serde_json::Value>>,
    pub data_dir:          PathBuf,
}

// ── Query params ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub(crate) struct HistoryParams {
    pub(crate) ba:    String,
    pub(crate) hours: Option<u32>,
}

#[derive(Deserialize)]
pub(crate) struct CompareParams {
    pub(crate) bas: String,
}
