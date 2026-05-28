# Stockwise

AI-powered inventory forecasting for small e-commerce brands.
Connects to Shopify, ingests 90 days of orders, and produces reorder
recommendations using Holt's exponential smoothing.

> Landing page: https://stockwise.agilishai.com

## What you get

- **Shopify OAuth install** at `/shopify/install?shop=<store>.myshopify.com`
- **One-click data sync** that pulls products + 90d of paid orders
- **Forecasts per SKU** with daily demand, days-of-cover, reorder point
- **Reorder recommendations** based on lead time + 95% service level
- **Dashboard** at `/dashboard` — server-rendered HTML, no SPA
- **Demo mode** — visit `/dashboard/demo` to seed a sample shop and skip OAuth

## Quick start

```bash
npm install
cp .env.example .env       # then fill DATABASE_URL (Neon free tier works)
npm run migrate
DEMO_MODE=1 npm start      # http://localhost:3000/dashboard/demo
```

## Free-tier deployment

- **Postgres**: [Neon](https://neon.tech) free tier (0.5 GB, ample for 50 stores)
- **Web**: [Render](https://render.com) or [Fly.io](https://fly.io) free instance
- Single Node process, no background workers. Cost target: **$0/mo**.

## Architecture

```
server.js                # entry (express, < 50 lines)
routes/
  shopify.js   # OAuth install + callback (HMAC verified)
  ingest.js    # pull orders/products, persist daily aggregates
  forecast.js  # recompute + cached results
  dashboard.js # server-rendered HTML
shopify/client.js        # thin Admin REST wrapper (no SDK)
forecast/
  exponential_smoothing.js  # Holt's linear method
  reorder.js                # safety stock + qty math
db/                      # one Pool, one module per entity
migrations/              # all DDL
demo/seed.js             # reproducible sample data
```

## Forecasting

Holt's linear exponential smoothing (α=0.3, β=0.1). Fewer than 14 days of
data → fall back to the mean. Stddev is computed across the full series.

Reorder point uses a 95% service level:

```
safety_stock  = 1.65 · stddev · √lead_time_days
reorder_point = lead_time_days · daily_demand + safety_stock
```

When `on_hand ≤ reorder_point`, recommend ordering enough for 30 days of
cover (default). All values cached in `forecasts` table for fast dashboard loads.

## Tests

```bash
npm test
```

## Env

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | App credentials |
| `SHOPIFY_SCOPES` | Default `read_products,read_orders,read_inventory` |
| `SHOPIFY_APP_URL` | Public URL for OAuth callback |
| `DEMO_MODE` | Set to `1` to bypass Shopify, use seed data |
