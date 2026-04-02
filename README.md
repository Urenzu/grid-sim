# US Grid Sim

Real-time visualization of the US electrical grid — generation, fuel mix, and interstate energy flows from live EIA data.

## Coverage

**54 balancing authorities** — all EIA 930 filers that report generation data (~99% of US capacity by MW).

| Interconnection | BAs |
|---|---|
| Western | 30 (CISO, BPAT, PACW, PGE, PSEI, SCL, PACE, IPCO, NEVP, AZPS, SRP, PSCO, WACM, WALC, BANC, LDWP, + 14) |
| Texas | 1 (ERCO) |
| Eastern | 23 (PJM, MISO, SWPP, TVA, SOCO, DUK, LGEE, AECI, NYIS, ISNE, + 13) |

**237 generation facilities** across 6 fuel types (nuclear ~95% capacity, coal ~70%, hydro ~75%, gas CC ~40%, wind ~25%, solar ~20%). Dot size scales with `√(nameplate MW)`.

**BA territories** approximated via D3 Voronoi — real boundaries are irregular franchise areas. EIA polygon boundaries are the planned upgrade.

## Data

- `EIA /rto/interchange-data` — hourly BA-to-BA net MW flows
- `EIA /rto/fuel-type-data` — hourly generation by fuel type per BA
- 5-minute server-side cache, all BAs fetched dynamically (no hardcoded filter)

## Running

```bash
cargo run -p server   # requires EIA_API_KEY in .env
cd app && npm run dev
```

Free EIA key at [eia.gov/opendata](https://www.eia.gov/opendata/).
