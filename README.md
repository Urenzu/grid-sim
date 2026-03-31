# US Power Grid Simulator

A real-time visualization of electricity generation and interchange flows across the US grid, powered by live EIA data.

## What it shows

- **Flow mode** — animated arcs and particles between balancing authorities, sized and colored by net MW transferred
- **Generation mode** — fuel-mix donut rings at each BA showing real-time generation by fuel type (nuclear, gas, coal, wind, solar, hydro)
- **Facility overlays** — toggleable layers for major nuclear plants, hydro dams, wind farms, and solar installations, sized proportionally to nameplate capacity (EIA Form 860)

## Data source

All interchange and generation data comes from the [EIA Open Data API v2](https://api.eia.gov/) (`electricity/rto/interchange-data` and `electricity/rto/fuel-type-data`). The server queries all balancing authorities dynamically — no hardcoded BA filter — so any new entity that starts reporting to EIA automatically appears. Data is cached for 5 minutes and refreshed on the next request.

## Accuracy status

### Operator coverage — ~75% by count, ~92% by US load

EIA Form 930 requires reporting from ~68 active US balancing authorities. This visualization renders 50 of them. The 18 not shown are almost entirely small municipal utilities and single-plant merchant operators. By electricity volume the covered BAs account for roughly 90-92% of US consumption.

### Data accuracy — ~90%

Interchange and generation numbers are pulled directly from EIA's live API, which BAs are legally required to report. A per-pair-latest-period algorithm handles the 1-2 hour reporting lag differences between fast-reporting western BAs and slower eastern ones, ensuring no BA is silently dropped. The remaining ~10% gap is the EIA reporting lag itself — data is real but 1-2 hours behind wall-clock time.

### Spatial accuracy — ~65-70%

BA territories are approximated with D3 Voronoi tessellation seeded at each BA's geographic center plus extra seeds for large territories (MISO, SWPP, BPAT, SOCO, ERCO, etc.). Real BA boundaries follow utility franchise areas, state lines, and historical agreements — often irregular shapes that Voronoi can only approximate.

### Facility markers — ~60% of total US capacity

The ~150 nuclear, hydro, wind, and solar facilities shown are the largest plants by nameplate MW from EIA Form 860 (2023). Thousands of smaller facilities are not rendered. Dot sizes are proportional to `sqrt(nameplate_MW)` to keep the visual range manageable.

### Overall — ~80-85% accurate

Sufficient to understand real energy flows and grid structure. Not suitable for precise engineering or operational decisions.

## Known characteristics

- **ERCOT (Texas)** shows only a ~10 MW DC tie to SWPP — this is correct. ERCOT is intentionally isolated from the rest of the US grid.
- **FPL (Florida Power & Light)** exchanges only with Florida-local utilities (FMPP, FPC, GVL, HST, JEA), all of which are now included.
- **Canadian BAs** (HQT, IESO, MHEB) appear in EIA data and are returned by the server but are not rendered since D3 AlbersUSA doesn't project points outside the contiguous US.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Vite |
| Rendering | D3 (SVG Voronoi + zoom) + Canvas (arcs, particles, plant markers) |
| Server | Rust / Axum |
| Data | EIA Open Data API v2 |

## Setup

```bash
# Server (requires EIA_API_KEY env var)
cd crates/server
EIA_API_KEY=your_key cargo run

# Frontend
cd app
npm install
npm run dev
```
