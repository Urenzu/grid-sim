# US Grid Sim

Real-time visualization of the US electrical grid — live generation, fuel mix, interstate energy flows, and historical carbon analytics from EIA data.

## Views

**Grid** — live map of all US balancing authorities. Flow arcs and animated particles show net MW interchange between BAs. Switch between Flow, Generation, and Carbon modes. Click any BA to lock its detail panel and jump to Dispatch.

**Dispatch** — time-series charts for a selected BA: duck curve, fuel mix, carbon intensity, and clean energy share. Supports 24h–7d live windows and 30d/90d/1y historical ranges from parquet. Expand any chart to full screen.

**Analytics** — grid-wide rankings (capacity, carbon, renewables, clean %), scatter plot of all BAs, carbon intensity heatmap by hour and day of week, and long-run clean energy trend from 2019 to present.

## Data sources

| Feed | Endpoint | Refresh |
|---|---|---|
| Live interchange | `EIA /rto/interchange-data` | 5 min cache |
| Live generation | `EIA /rto/fuel-type-data` | 5 min cache |
| Historical | Parquet files (`data/gen/`) | Daily backfill |

Historical data is stored locally as one parquet file per day (`YYYY-MM-DD.parquet`, schema: `period, ba, fuel, mw`). The backfill binary fills gaps from EIA's bulk API.

## Coverage

**68 balancing authorities** — all EIA 930 filers reporting generation data (~99% of US capacity).

## Running

```bash
# Copy and fill in your EIA key
cp .env.example .env

# Start the server (live API + parquet queries)
cargo run -p server

# Start the frontend
cd app && npm run dev
```

Free EIA key at [eia.gov/opendata](https://www.eia.gov/opendata/).

## Backfill historical data

```bash
cargo run -p backfill -- --start 2019-01-01
```

Writes one parquet file per day into `data/gen/`. Safe to re-run — skips existing files.

## Stack

- **Backend** — Rust / Axum, Polars for parquet queries, `tokio` async
- **Frontend** — React, D3.js, TanStack Query, Framer Motion
- **Data** — Apache Parquet (2,660+ daily files, 2019–present)
