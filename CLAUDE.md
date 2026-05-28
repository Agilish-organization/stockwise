# Stockwise — Engineering Guide

AI-powered inventory forecasting for small e-commerce brands.

## Stack
- Node.js 20 + Express (server-rendered HTML, no SPA)
- PostgreSQL (via `pg`) — single Pool in `db/index.js`
- Shopify Admin REST API (read_products, read_orders scopes)
- Forecasting: in-process exponential smoothing (Holt-Winters lite), no Python

## Layout
```
server.js                # entrypoint, <= 300 lines
routes/
  shopify.js             # OAuth install + callback
  ingest.js              # pull orders/products, persist
  forecast.js            # forecast + reorder recs API
  dashboard.js           # server-rendered HTML views
db/
  index.js               # ONLY place that constructs `new Pool()`
  shops.js               # shop tokens
  products.js            # product catalog
  sales.js               # daily sales aggregates
forecast/
  exponential_smoothing.js
  reorder.js
migrations/
  <unix>_<name>.sql      # all DDL lives here
views/                   # simple HTML templates
public/                  # static css
test/
```

## Rules
- Entry file cap: 300 lines.
- Every endpoint group: `routes/<name>.js` using `express.Router()`.
- All DB queries go through `db/<entity>.js`. No inline SQL elsewhere.
- No DDL outside `migrations/`.
- Comments answer WHY, never WHAT.
- Pre-revenue: free tier only (Neon free Postgres, Render/Fly free web).

## Env
- `DATABASE_URL` — Postgres
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`, `SHOPIFY_APP_URL`
- `DEMO_MODE=1` to bypass Shopify with seeded mock data

## Running
```
npm install
npm run migrate
DEMO_MODE=1 npm start
```

## Forecasting approach
Daily-aggregated unit sales per SKU. Holt's linear exponential smoothing
(alpha=0.3, beta=0.1). When series < 14 days, fall back to mean. Reorder logic:
```
reorder_point = lead_time_days * forecasted_daily_demand + safety_stock
safety_stock  = z * stddev_daily * sqrt(lead_time_days)   // z=1.65 (95%)
```
If `on_hand <= reorder_point`, recommend ordering
`target_days * daily_demand - on_hand`.
