use anyhow::Result;
use chrono::NaiveDate;
use std::collections::HashMap;
use std::time::{Duration, Instant};

use crate::domain::normalize_fuel;
use crate::labels::BA_LABELS;
use crate::types::{
    AppState, BaGenData, CachedDemand, CachedGen, CachedInterchange, DemandEntry, EiaFuelResponse,
    EiaRecord, EiaRegionResponse, EiaResponse, FuelEntry, GraphData, InterchangeRaw, Link, Node,
    RegionRecord, FuelTypeRecord,
};

// ── EIA snapshot fetches (cache-backed, used by API handlers) ─────────────

pub(crate) async fn fetch_generation(state: &AppState) -> Result<Vec<BaGenData>> {
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

    // Each BA reports on its own schedule — find each BA's latest period.
    let mut ba_latest: HashMap<String, String> = HashMap::new();
    for r in &records {
        let entry = ba_latest.entry(r.respondent.clone()).or_insert_with(|| r.period.clone());
        if r.period > *entry { *entry = r.period.clone(); }
    }

    let latest: Vec<&FuelTypeRecord> = records.iter()
        .filter(|r| ba_latest.get(&r.respondent).map_or(false, |p| *p == r.period))
        .collect();

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
        let period        = ba_latest.get(&ba).cloned().unwrap_or_default();
        let total_mw: f64 = fuel_map.values().sum();
        let dominant_fuel = fuel_map.iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(f, _)| f.clone())
            .unwrap_or_else(|| "other".to_string());
        let mut fuels: Vec<FuelEntry> = fuel_map.into_iter()
            .map(|(fuel, mw)| FuelEntry { fuel, mw })
            .collect();
        fuels.sort_by(|a, b| b.mw.partial_cmp(&a.mw).unwrap_or(std::cmp::Ordering::Equal));
        BaGenData { ba, period, total_mw, dominant_fuel, fuels }
    }).collect();
    result.sort_by(|a, b| b.total_mw.partial_cmp(&a.total_mw).unwrap_or(std::cmp::Ordering::Equal));

    let mut cache = state.gen_cache.write().await;
    *cache = Some(CachedGen { data: result.clone(), fetched_at: Instant::now() });
    Ok(result)
}

pub(crate) async fn fetch_interchange(state: &AppState) -> Result<GraphData> {
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

    // Capture raw records for Parquet writes before computing net flows
    let raw: Vec<InterchangeRaw> = pair_latest.iter()
        .map(|((from, to), (period, mw))| InterchangeRaw {
            period:  period.clone(),
            from_ba: from.clone(),
            to_ba:   to.clone(),
            mw:      *mw,
        })
        .collect();

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
    *cache = Some(CachedInterchange { data: result.clone(), raw, fetched_at: Instant::now() });
    Ok(result)
}

pub(crate) async fn fetch_demand(state: &AppState) -> Result<Vec<DemandEntry>> {
    {
        let cache = state.demand_cache.read().await;
        if let Some(c) = &*cache {
            if c.fetched_at.elapsed() < Duration::from_secs(5 * 60) {
                return Ok(c.data.clone());
            }
        }
    }

    let url = format!(
        "https://api.eia.gov/v2/electricity/rto/region-data/data/\
         ?api_key={}\
         &frequency=hourly\
         &data[]=value\
         &facets[type][]=D\
         &sort[0][column]=period\
         &sort[0][direction]=desc\
         &length=500",
        state.eia_key
    );

    let resp: EiaRegionResponse = state.http.get(&url).send().await?.json().await?;
    let records = resp.response.data;

    let mut ba_latest: HashMap<String, String> = HashMap::new();
    for r in &records {
        let entry = ba_latest.entry(r.respondent.clone()).or_insert_with(|| r.period.clone());
        if r.period > *entry { *entry = r.period.clone(); }
    }

    let mut result: Vec<DemandEntry> = records.iter()
        .filter(|r| ba_latest.get(&r.respondent).map_or(false, |p| *p == r.period))
        .filter_map(|r| {
            let mw = r.value?;
            if mw <= 0.0 { return None; }
            Some(DemandEntry { period: r.period.clone(), ba: r.respondent.clone(), demand_mw: mw })
        })
        .collect();
    result.sort_by(|a, b| a.ba.cmp(&b.ba));

    let mut cache = state.demand_cache.write().await;
    *cache = Some(CachedDemand { data: result.clone(), fetched_at: Instant::now() });
    Ok(result)
}

pub(crate) async fn fetch_history(state: &AppState, ba: &str, hours: u32) -> Result<Vec<FuelTypeRecord>> {
    use crate::domain::eia_period;
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
        state.eia_key, ba, start, end, hours * 10,
    );
    let resp: EiaFuelResponse = state.http.get(&url).send().await?.json().await?;
    Ok(resp.response.data)
}

// ── EIA full-day range fetches (paginated, used by gap-fill) ──────────────

pub(crate) async fn fetch_gen_range(state: &AppState, date: NaiveDate) -> Result<Vec<FuelTypeRecord>> {
    let start = format!("{date}T00");
    let end   = format!("{date}T23");
    let mut all    = Vec::new();
    let mut offset = 0usize;
    loop {
        let url = format!(
            "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/\
             ?api_key={}&frequency=hourly&data[]=value\
             &start={}&end={}\
             &sort[0][column]=period&sort[0][direction]=asc\
             &length=5000&offset={}",
            state.eia_key, start, end, offset
        );
        let resp: EiaFuelResponse = state.http.get(&url).send().await?.json().await?;
        let n = resp.response.data.len();
        all.extend(resp.response.data);
        if n < 5000 { break; }
        offset += 5000;
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Ok(all)
}

pub(crate) async fn fetch_interchange_range(state: &AppState, date: NaiveDate) -> Result<Vec<EiaRecord>> {
    let start = format!("{date}T00");
    let end   = format!("{date}T23");
    let mut all    = Vec::new();
    let mut offset = 0usize;
    loop {
        let url = format!(
            "https://api.eia.gov/v2/electricity/rto/interchange-data/data/\
             ?api_key={}&frequency=hourly&data[]=value\
             &start={}&end={}\
             &sort[0][column]=period&sort[0][direction]=asc\
             &length=5000&offset={}",
            state.eia_key, start, end, offset
        );
        let resp: EiaResponse = state.http.get(&url).send().await?.json().await?;
        let n = resp.response.data.len();
        all.extend(resp.response.data);
        if n < 5000 { break; }
        offset += 5000;
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Ok(all)
}

pub(crate) async fn fetch_demand_range(state: &AppState, date: NaiveDate) -> Result<Vec<RegionRecord>> {
    let start = format!("{date}T00");
    let end   = format!("{date}T23");
    let mut all    = Vec::new();
    let mut offset = 0usize;
    loop {
        let url = format!(
            "https://api.eia.gov/v2/electricity/rto/region-data/data/\
             ?api_key={}&frequency=hourly&data[]=value\
             &facets[type][]=D\
             &start={}&end={}\
             &sort[0][column]=period&sort[0][direction]=asc\
             &length=5000&offset={}",
            state.eia_key, start, end, offset
        );
        let resp: EiaRegionResponse = state.http.get(&url).send().await?.json().await?;
        let n = resp.response.data.len();
        all.extend(resp.response.data);
        if n < 5000 { break; }
        offset += 5000;
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Ok(all)
}
