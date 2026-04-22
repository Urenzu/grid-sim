# US Grid Sim

Real-time visualization of the US electrical grid — live generation, fuel mix, interstate energy flows, and historical carbon analytics from EIA data.

![Grid map](docs/Screenshot%202026-04-22%20151328.png)

## Views

**Grid** — live map of all 69 US balancing authorities. Animated flow arcs show net MW interchange between BAs. Toggle between Flow, Generation, and Carbon modes. Click any BA to lock its detail panel.

**Dispatch** — per-BA time-series charts: duck curve, fuel mix, carbon intensity, and clean energy share. Live 24h–7d windows and 30d/90d/1y historical ranges from parquet.

![Dispatch view](docs/Screenshot%202026-04-22%20151401.png)

**Analytics** — grid-wide rankings by capacity, carbon, renewables, and clean %; scatter plot; carbon intensity heatmap by hour and day of week; clean energy trend from 2019 to present.

## Data

| Feed | Source | Refresh |
|---|---|---|
| Live interchange & generation | EIA 930 API | 5-min cache |
| Historical (2019–present) | Parquet files synced from Cloudflare R2 | Daily backfill |

2,660+ daily parquet files (`YYYY-MM-DD.parquet`, schema: `period, ba, fuel, mw`). The backfill binary fills gaps from EIA's bulk API and is safe to re-run.

## Stack

- **Backend** — Rust / Axum, Polars for parquet queries, Tokio async runtime
- **Frontend** — React, D3.js, TanStack Query, Framer Motion
- **Infra** — Docker, deployed on Railway; historical data persisted in Cloudflare R2

## Running locally

```bash
cp .env.example .env   # add your EIA API key
cargo run -p server    # API server on :3000
cd app && npm run dev  # frontend dev server
```

Free EIA key at [eia.gov/opendata](https://www.eia.gov/opendata/).

To backfill historical data:

```bash
cargo run -p backfill -- --start 2019-01-01
```
