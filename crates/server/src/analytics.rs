use anyhow::Result;
use polars::prelude::*;
use std::collections::HashMap;

use crate::domain::carbon_intensity;
use crate::labels::BA_LABELS;
use crate::types::{AnalyticsResponse, BaAnalytics, BaGenData, GridStats};

pub(crate) fn compute_ba_analytics(gen: &[BaGenData]) -> Result<AnalyticsResponse> {
    if gen.is_empty() {
        return Ok(AnalyticsResponse { rankings: vec![], grid: GridStats::default() });
    }

    let ba_label: HashMap<&str, &str> = BA_LABELS.iter().cloned().collect();

    let bas:         Vec<&str> = gen.iter().map(|b| b.ba.as_str()).collect();
    let total_mws:   Vec<f64>  = gen.iter().map(|b| b.total_mw).collect();
    let intensities: Vec<f64>  = gen.iter().map(|b| carbon_intensity(&b.fuels)).collect();
    let renew_pcts:  Vec<f64>  = gen.iter().map(|b| {
        let r: f64 = b.fuels.iter()
            .filter(|f| f.fuel == "wind" || f.fuel == "solar")
            .map(|f| f.mw).sum();
        if b.total_mw > 0.0 { r / b.total_mw * 100.0 } else { 0.0 }
    }).collect();
    let clean_pcts: Vec<f64> = gen.iter().map(|b| {
        let c: f64 = b.fuels.iter()
            .filter(|f| matches!(f.fuel.as_str(), "wind" | "solar" | "hydro" | "nuclear"))
            .map(|f| f.mw).sum();
        if b.total_mw > 0.0 { c / b.total_mw * 100.0 } else { 0.0 }
    }).collect();

    let df = DataFrame::new(vec![
        Series::new("ba".into(),            bas.as_slice()),
        Series::new("total_mw".into(),      total_mws.as_slice()),
        Series::new("intensity".into(),     intensities.as_slice()),
        Series::new("renewable_pct".into(), renew_pcts.as_slice()),
        Series::new("clean_pct".into(),     clean_pcts.as_slice()),
    ])?;

    let grid_df = df.clone().lazy()
        .select([
            col("total_mw").sum().alias("total_mw"),
            (col("total_mw") * col("intensity")).sum().alias("w_ci"),
            (col("total_mw") * col("renewable_pct")).sum().alias("w_renew"),
            (col("total_mw") * col("clean_pct")).sum().alias("w_clean"),
        ])
        .collect()?;

    let total_mw_sum: f64 = grid_df["total_mw"].f64()?.get(0).unwrap_or(0.0);
    let w_ci:         f64 = grid_df["w_ci"].f64()?.get(0).unwrap_or(0.0);
    let w_renew:      f64 = grid_df["w_renew"].f64()?.get(0).unwrap_or(0.0);
    let w_clean:      f64 = grid_df["w_clean"].f64()?.get(0).unwrap_or(0.0);

    let div = |n: f64| if total_mw_sum > 0.0 { n / total_mw_sum } else { 0.0 };
    let grid = GridStats {
        total_mw:         total_mw_sum,
        carbon_intensity: div(w_ci),
        renewable_pct:    div(w_renew),
        clean_pct:        div(w_clean),
        ba_count:         gen.len(),
    };

    let sorted = df.sort(
        ["total_mw"],
        SortMultipleOptions::default().with_order_descending(true),
    )?;

    let bas_col   = sorted["ba"].str()?;
    let mw_col    = sorted["total_mw"].f64()?;
    let ci_col    = sorted["intensity"].f64()?;
    let renew_col = sorted["renewable_pct"].f64()?;
    let clean_col = sorted["clean_pct"].f64()?;

    let rankings: Vec<BaAnalytics> = (0..sorted.height())
        .filter_map(|i| {
            let ba       = bas_col.get(i)?;
            let label    = ba_label.get(ba).copied().unwrap_or(ba).to_string();
            let dominant = gen.iter().find(|b| b.ba == ba)?.dominant_fuel.clone();
            let fuels    = gen.iter().find(|b| b.ba == ba)
                .map(|b| b.fuels.clone())
                .unwrap_or_default();
            Some(BaAnalytics {
                ba:               ba.to_string(),
                label,
                total_mw:         mw_col.get(i).unwrap_or(0.0),
                carbon_intensity: ci_col.get(i).unwrap_or(0.0),
                renewable_pct:    renew_col.get(i).unwrap_or(0.0),
                clean_pct:        clean_col.get(i).unwrap_or(0.0),
                dominant_fuel:    dominant,
                fuels,
            })
        })
        .collect();

    Ok(AnalyticsResponse { rankings, grid })
}
