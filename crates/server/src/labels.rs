/// Static BA identifier → human-readable label table.
pub(crate) const BA_LABELS: &[(&str, &str)] = &[
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
    ("AVRN", "Avangrid Renewables"),
    ("GRID", "Gridforce Energy Management"),
    // SPP runs two separate balancing authorities: SWPP in the Eastern
    // Interconnection and this one in the Western. Despite the name they do
    // not overlap, so both are counted.
    ("SWPW", "Southwest Power Pool West"),
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
    ("SIKE", "Sikeston Municipal Utilities"),
    ("YAD",  "Alcoa Power Gen - Yadkin"),
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

/// BA identifier → IANA timezone of its load centre.
///
/// EIA reports Form 930 periods in UTC, but a daily demand or solar shape is
/// only meaningful against local clock time, so hour-of-day aggregations are
/// bucketed in the BA's own zone. IANA names (not fixed offsets) so DST is
/// handled; note Arizona sits on `America/Phoenix`, which never shifts.
///
/// Multi-zone BAs are assigned the zone of the bulk of their load, which is
/// not always their headquarters: TVA is mostly Central despite Knoxville
/// being Eastern, and MISO is Central despite operating its market on EST.
///
/// Mirrored by `TZ` in `app/src/data/ba.ts` — update both together.
pub(crate) const BA_TIMEZONES: &[(&str, &str)] = &[
    // ── Pacific ──────────────────────────────────────────────────────────
    ("CISO", "America/Los_Angeles"), ("BPAT", "America/Los_Angeles"),
    ("PACW", "America/Los_Angeles"), ("PGE",  "America/Los_Angeles"),
    ("SCL",  "America/Los_Angeles"), ("TPWR", "America/Los_Angeles"),
    ("PSEI", "America/Los_Angeles"), ("DOPD", "America/Los_Angeles"),
    ("GCPD", "America/Los_Angeles"), ("CHPD", "America/Los_Angeles"),
    ("LDWP", "America/Los_Angeles"), ("BANC", "America/Los_Angeles"),
    ("TIDC", "America/Los_Angeles"), ("IID",  "America/Los_Angeles"),
    ("NEVP", "America/Los_Angeles"), ("AVA",  "America/Los_Angeles"),
    // Avangrid's wind fleet sits in the BPA/PacifiCorp West footprint.
    ("AVRN", "America/Los_Angeles"),
    // ── Arizona (no DST) ─────────────────────────────────────────────────
    ("AZPS", "America/Phoenix"), ("SRP",  "America/Phoenix"),
    ("TEPC", "America/Phoenix"), ("DEAA", "America/Phoenix"),
    ("HGMA", "America/Phoenix"), ("WALC", "America/Phoenix"),
    // Gridforce straddles two zones — 52% of its interchange volume is with
    // SRP and WALC in Arizona against 36% with BPA, so Phoenix is the better
    // of two imperfect choices.
    ("GRID", "America/Phoenix"),
    // ── Mountain ─────────────────────────────────────────────────────────
    ("PACE", "America/Denver"), ("IPCO", "America/Boise"),
    ("PNM",  "America/Denver"), ("EPE",  "America/Denver"),
    ("WACM", "America/Denver"), ("PSCO", "America/Denver"),
    ("NWMT", "America/Denver"), ("GWA",  "America/Denver"),
    ("WWA",  "America/Denver"), ("BHBA", "America/Denver"),
    // SPP West spans MT/WY/CO/western NE — Mountain, unlike SWPP.
    ("SWPW", "America/Denver"),
    // ── Central ──────────────────────────────────────────────────────────
    ("ERCO", "America/Chicago"), ("MISO", "America/Chicago"),
    ("SWPP", "America/Chicago"), ("AECI", "America/Chicago"),
    ("EDE",  "America/Chicago"), ("SPA",  "America/Chicago"),
    ("TVA",  "America/Chicago"), ("WAUW", "America/Chicago"),
    ("SIKE", "America/Chicago"),
    // ── Eastern ──────────────────────────────────────────────────────────
    ("PJM",  "America/New_York"), ("SOCO", "America/New_York"),
    ("DUK",  "America/New_York"), ("CPLE", "America/New_York"),
    ("CPLW", "America/New_York"), ("SC",   "America/New_York"),
    ("SCEG", "America/New_York"), ("FPL",  "America/New_York"),
    ("FPC",  "America/New_York"), ("TEC",  "America/New_York"),
    ("FMPP", "America/New_York"), ("GVL",  "America/New_York"),
    ("HST",  "America/New_York"), ("JEA",  "America/New_York"),
    ("TAL",  "America/New_York"), ("SEC",  "America/New_York"),
    ("SEPA", "America/New_York"), ("LGEE", "America/New_York"),
    ("OVEC", "America/New_York"), ("NYIS", "America/New_York"),
    ("ISNE", "America/New_York"), ("YAD",  "America/New_York"),
    // ── Canada / Mexico ──────────────────────────────────────────────────
    ("HQT",  "America/Toronto"), ("IESO", "America/Toronto"),
    ("MHEB", "America/Winnipeg"), ("NBSO", "America/Moncton"),
    ("AESO", "America/Edmonton"), ("BCHA", "America/Vancouver"),
    ("CEN",  "America/Tijuana"), ("CFE",  "America/Tijuana"),
];

/// Timezone for `ba`, falling back to UTC for unknown identifiers so an
/// unmapped BA degrades to the raw EIA clock rather than failing the query.
pub(crate) fn ba_timezone(ba: &str) -> chrono_tz::Tz {
    BA_TIMEZONES.iter()
        .find(|(id, _)| *id == ba)
        .and_then(|(_, tz)| tz.parse().ok())
        .unwrap_or(chrono_tz::UTC)
}
