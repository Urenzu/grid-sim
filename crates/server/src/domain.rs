use crate::types::FuelEntry;

pub(crate) fn normalize_fuel(code: &str) -> &'static str {
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

pub(crate) fn emission_factor(fuel: &str) -> f64 {
    match fuel {
        "coal"                                  => 1001.0,
        "gas"                                   => 443.0,
        "nuclear" | "wind" | "solar" | "hydro" => 0.0,
        _                                       => 500.0,
    }
}

pub(crate) fn carbon_intensity(fuels: &[FuelEntry]) -> f64 {
    let total: f64 = fuels.iter().map(|f| f.mw).sum();
    if total <= 0.0 { return 0.0; }
    fuels.iter().map(|f| f.mw * emission_factor(&f.fuel)).sum::<f64>() / total
}

pub(crate) fn eia_period(hours_ago: u32) -> String {
    let dt = chrono::Utc::now() - chrono::Duration::hours(hours_ago as i64);
    dt.format("%Y-%m-%dT%H").to_string()
}
