use crate::types::FuelEntry;

/// EIA Form 930 reports rollup respondents alongside real balancing
/// authorities: `US48` (the whole Lower 48) plus 13 regions, each of which
/// re-reports generation already attributed to its member BAs.
///
/// Summing them with the BAs double- (or triple-) counts every megawatt, so
/// they are excluded everywhere generation is aggregated. Keep this list in
/// sync with EIA's respondent metadata.
pub(crate) const AGGREGATE_RESPONDENTS: &[&str] = &[
    "US48", // Lower 48 total
    "CAL", "CAR", "CENT", "FLA", "MIDA", "MIDW",
    "NE", "NW", "NY", "SE", "SW", "TEN", "TEX",
];

/// True when `code` is an EIA rollup region rather than a balancing authority.
pub(crate) fn is_aggregate(code: &str) -> bool {
    AGGREGATE_RESPONDENTS.contains(&code)
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::labels::{ba_timezone, BA_LABELS, BA_TIMEZONES};

    fn fuel(name: &str, mw: f64) -> FuelEntry {
        FuelEntry { fuel: name.to_string(), mw }
    }

    // ── Aggregate filtering ───────────────────────────────────────────────

    #[test]
    fn rollup_respondents_are_flagged() {
        for code in ["US48", "MIDA", "TEX", "SE", "NY", "CENT"] {
            assert!(is_aggregate(code), "{code} should be an aggregate");
        }
    }

    #[test]
    fn real_balancing_authorities_are_not_flagged() {
        // The pairs that collided in the rankings: the rollup must be dropped
        // and its member BA kept.
        for code in ["PJM", "ERCO", "SOCO", "TVA", "CISO", "MISO", "NYIS"] {
            assert!(!is_aggregate(code), "{code} is a real BA");
        }
    }

    #[test]
    fn no_aggregate_is_also_a_labelled_ba() {
        // BA_LABELS is the canonical list of real BAs; overlap would mean the
        // filter is silently removing something the UI expects to show.
        for (id, _) in BA_LABELS {
            assert!(!is_aggregate(id), "{id} is both labelled and an aggregate");
        }
    }

    // ── Carbon intensity ──────────────────────────────────────────────────

    #[test]
    fn all_clean_generation_has_zero_intensity() {
        let fuels = [fuel("wind", 100.0), fuel("nuclear", 50.0), fuel("solar", 25.0)];
        assert_eq!(carbon_intensity(&fuels), 0.0);
    }

    #[test]
    fn intensity_is_generation_weighted_not_a_plain_average() {
        // 900 MW clean + 100 MW coal → 100.1, not the 500.5 a plain mean gives.
        let fuels = [fuel("wind", 900.0), fuel("coal", 100.0)];
        assert!((carbon_intensity(&fuels) - 100.1).abs() < 1e-9);
    }

    #[test]
    fn empty_generation_does_not_divide_by_zero() {
        assert_eq!(carbon_intensity(&[]), 0.0);
        assert_eq!(carbon_intensity(&[fuel("coal", 0.0)]), 0.0);
    }

    // ── Fuel normalisation ────────────────────────────────────────────────

    #[test]
    fn eia_fuel_codes_map_to_canonical_names() {
        assert_eq!(normalize_fuel("SUN"), "solar");
        assert_eq!(normalize_fuel("WND"), "wind");
        assert_eq!(normalize_fuel("NG"),  "gas");
        // Every coal rank collapses to one bucket.
        for code in ["COL", "BIT", "SUB", "LIG", "ANT", "RC"] {
            assert_eq!(normalize_fuel(code), "coal", "{code}");
        }
        assert_eq!(normalize_fuel("XYZ"), "other");
    }

    // ── Timezone table ────────────────────────────────────────────────────

    #[test]
    fn every_labelled_ba_has_a_timezone() {
        for (id, _) in BA_LABELS {
            assert!(
                BA_TIMEZONES.iter().any(|(tz_id, _)| tz_id == id),
                "{id} has no timezone mapping",
            );
        }
    }

    #[test]
    fn every_timezone_entry_has_a_label() {
        // The reverse direction, so a BA can never be added to one table only
        // and silently fall back to UTC.
        for (id, _) in BA_TIMEZONES {
            assert!(
                BA_LABELS.iter().any(|(l_id, _)| l_id == id),
                "{id} has a timezone but no label",
            );
        }
    }

    #[test]
    fn spp_operates_two_distinct_balancing_authorities() {
        // SWPP (Eastern) and SWPW (Western) are separate footprints despite
        // the shared name — neither may be treated as a rollup of the other.
        assert!(!is_aggregate("SWPP"));
        assert!(!is_aggregate("SWPW"));
        assert_ne!(ba_timezone("SWPP"), ba_timezone("SWPW"));
    }

    #[test]
    fn every_timezone_name_parses() {
        for (id, name) in BA_TIMEZONES {
            assert!(
                name.parse::<chrono_tz::Tz>().is_ok(),
                "{id} has unparseable timezone {name}",
            );
        }
    }

    #[test]
    fn unknown_ba_falls_back_to_utc() {
        assert_eq!(ba_timezone("NOT_A_BA"), chrono_tz::UTC);
    }

    #[test]
    fn arizona_does_not_observe_dst() {
        use chrono::{Offset, TimeZone};
        let tz     = ba_timezone("AZPS");
        let winter = tz.with_ymd_and_hms(2026, 1, 15, 12, 0, 0).unwrap();
        let summer = tz.with_ymd_and_hms(2026, 7, 15, 12, 0, 0).unwrap();
        assert_eq!(winter.offset().fix(), summer.offset().fix());
    }

    #[test]
    fn california_does_observe_dst() {
        use chrono::{Offset, TimeZone};
        let tz     = ba_timezone("CISO");
        let winter = tz.with_ymd_and_hms(2026, 1, 15, 12, 0, 0).unwrap();
        let summer = tz.with_ymd_and_hms(2026, 7, 15, 12, 0, 0).unwrap();
        assert_ne!(winter.offset().fix(), summer.offset().fix());
    }
}
