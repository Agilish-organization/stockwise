-- Stockwise initial schema. All DDL lives here. Idempotent.

CREATE TABLE IF NOT EXISTS shops (
  id            SERIAL PRIMARY KEY,
  shop_domain   TEXT UNIQUE NOT NULL,
  access_token  TEXT NOT NULL,
  scopes        TEXT,
  installed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id              SERIAL PRIMARY KEY,
  shop_id         INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  shopify_id      TEXT NOT NULL,
  sku             TEXT,
  title           TEXT,
  on_hand         INTEGER NOT NULL DEFAULT 0,
  lead_time_days  INTEGER NOT NULL DEFAULT 14,
  cost            NUMERIC(12,2),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, shopify_id)
);

CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);

-- Daily aggregate of units sold per product. Forecast inputs read from here.
CREATE TABLE IF NOT EXISTS sales_daily (
  id          BIGSERIAL PRIMARY KEY,
  shop_id     INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sale_date   DATE NOT NULL,
  units       INTEGER NOT NULL DEFAULT 0,
  revenue     NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE (product_id, sale_date)
);

CREATE INDEX IF NOT EXISTS idx_sales_daily_shop_date
  ON sales_daily(shop_id, sale_date);

-- Persisted forecast results so dashboard reads are O(products), not O(orders).
CREATE TABLE IF NOT EXISTS forecasts (
  id                       SERIAL PRIMARY KEY,
  product_id               INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  generated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  forecast_daily_units     NUMERIC(12,4) NOT NULL,
  stddev_daily             NUMERIC(12,4) NOT NULL DEFAULT 0,
  horizon_days             INTEGER NOT NULL DEFAULT 30,
  reorder_point            NUMERIC(12,2) NOT NULL,
  recommended_order_qty    INTEGER NOT NULL DEFAULT 0,
  days_of_cover            NUMERIC(12,2),
  UNIQUE (product_id)
);
