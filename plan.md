# Grid Sim — Build Plan

## Current state

- Axum server proxies EIA API, caches in-memory (moka), no disk persistence
- Polars added but used only to sort/aggregate the live generation snapshot (~50 rows)
- Analytics page shows ranked BAs by capacity/carbon/renewables/clean from that single snapshot
- History fetched on-demand from EIA per BA (up to 7 days), not stored

---

## Phase 0 — Analytics depth on live snapshot (no Parquet needed)

Everything here uses the current `/api/generation` + `/api/analytics` data.
Builds the UI surface that historical data will later make more powerful.

**Analytics page:**
- [x] Expandable BA rows — click to reveal inline fuel mix breakdown (stacked bar + percentages)
- [x] Scatter plot view — carbon intensity (x) vs clean % (y), one dot per BA, quadrant labels
      ("high clean low carbon" = ideal, "high carbon low clean" = coal-heavy)
- [x] Mini stacked fuel bars in each ranking row (replaces the plain color dot)
- [x] Wire in BaHourHeatmap component (already built, currently unused in analytics)
- [x] View toggle: list | scatter | heatmap

**New server endpoint:**
- [x] `/api/analytics/compare?bas=CISO,PJM,ERCO` — returns side-by-side BaAnalytics for
      selected BAs, Polars computes the delta from grid average for each metric

---

## Phase 1 — Local Parquet accumulation

Start writing data on the dev machine. The files are the asset.
By the time VPS is set up, you'll have days/weeks of history already.

**Canonical schema** (flat fact table, written once per poll):
```
period  : Utf8     "2026-04-09T14"
ba      : Utf8     "CISO"
fuel    : Utf8     "solar"
mw      : Float64  8420.0
```

**Server changes:**
- [ ] Add `--data-dir` CLI arg (default `./data`)
- [ ] Background task writes each successful generation poll to
      `{data_dir}/gen/YYYY-MM-DD.parquet` using temp-then-rename atomicity:
      1. Flatten BaGenData → (period, ba, fuel, mw) rows
      2. Write to `{date}.tmp.parquet`
      3. If date file exists: read + vstack + deduplicate on (period, ba, fuel), keep Last
      4. Rename tmp → final
- [ ] On startup: delete any orphaned `.tmp.parquet` files (crashed writes)
- [ ] New endpoint `/api/analytics/trends?days=7` — Polars `scan_parquet` across date files,
      returns per-BA renewable_pct and carbon_intensity averaged over the window
- [ ] New endpoint `/api/analytics/heatmap?metric=renewable&days=7` — returns
      BA × hour-of-day matrix (group_by [ba, hour]) for the cross-BA heatmap

**Frontend:**
- [ ] Sparklines in rankings list — 7-day renewable % trend per BA (tiny SVG line)
- [ ] "Trending" indicator — up/down arrow if BA's carbon intensity improved/worsened vs 7d avg
- [ ] Hour-of-day heatmap view (BA rows × 24h columns, color = renewable %)

---

## Phase 2 — VPS deployment

- [ ] Provision Hetzner CAX11 (ARM, €4/mo) or DigitalOcean $6 droplet
- [ ] Systemd service: `grid-sim-server`, restarts on failure
- [ ] Deploy script: `git pull && cargo build --release && systemctl restart grid-sim`
- [ ] Serve Vite `dist/` as static files via Axum `ServeDir` (no Nginx needed initially)
- [ ] Data dir at `/opt/grid-sim/data/` — Parquet accumulates continuously
- [ ] Optional: domain + Let's Encrypt via Caddy (simpler TLS than Nginx)

---

## Phase 3 — R2 migration

No schema changes. Just swap the write/read destination.

- [ ] Add Cloudflare R2 bucket (`grid-sim-data`)
- [ ] Replace `File::create` with R2 put via `aws-sdk-s3` (R2 is S3-compatible)
- [ ] Polars `scan_parquet` with `s3://` URI via object_store feature
- [ ] DuckDB `httpfs` extension reads same files: `FROM 's3://grid-sim-data/gen/**/*.parquet'`
- [ ] Keep local disk as fallback/staging if R2 is unreachable

---

## Phase 4 — delta-rs (ACID enforcement)

- [ ] Add `deltalake` crate, wrap Parquet writes in Delta commits
- [ ] Transaction log in `{data_dir}/gen/_delta_log/`
- [ ] Enables: time travel, schema enforcement, safe concurrent writes (backfill jobs)
- [ ] Backfill endpoint: fetch + write historical EIA data without race conditions
- [ ] DuckDB Delta extension reads the table natively: `FROM delta_scan('s3://...')`

---

## Phase 5 — DataFusion query engine (optional, high learning value)

- [ ] Replace or augment DuckDB with embedded DataFusion for analytics endpoints
- [ ] Native Iceberg/Delta support, directly relevant to OSS contributions
- [ ] Custom physical plan nodes for energy-specific aggregations
- [ ] Exposes the internals of query planning at the layer you're contributing to

---

## Data notes

- EIA reporting lag: 1–2 hours. Each BA reports on its own schedule.
  Store whatever period EIA returns — do not assume it equals "now."
- Deduplication key: `(period, ba, fuel)` — re-polls of the same hour are safe to overwrite.
- Volume estimate: 50 BAs × 7 fuels × 8760 hrs/yr ≈ 3M rows/year. Trivial for DuckDB/Polars.
- Partition by day is sufficient. No need for hour-level partitioning at this scale.
