const { query } = require('./index');

// upsert a daily aggregate row. Called per (product, day) during ingest.
async function recordDaily({ shop_id, product_id, sale_date, units, revenue }) {
  await query(
    `INSERT INTO sales_daily (shop_id, product_id, sale_date, units, revenue)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (product_id, sale_date) DO UPDATE
       SET units   = sales_daily.units + EXCLUDED.units,
           revenue = sales_daily.revenue + EXCLUDED.revenue`,
    [shop_id, product_id, sale_date, units, revenue]
  );
}

// Series for the forecaster: dense daily units (zero-filled) for last N days.
async function dailySeries(product_id, days = 90) {
  const { rows } = await query(
    `WITH d AS (
       SELECT generate_series(
         (CURRENT_DATE - ($1::int - 1))::date,
         CURRENT_DATE,
         INTERVAL '1 day'
       )::date AS sale_date
     )
     SELECT d.sale_date, COALESCE(s.units, 0)::int AS units
     FROM d
     LEFT JOIN sales_daily s
       ON s.product_id = $2 AND s.sale_date = d.sale_date
     ORDER BY d.sale_date`,
    [days, product_id]
  );
  return rows;
}

async function saveForecast(f) {
  await query(
    `INSERT INTO forecasts
       (product_id, forecast_daily_units, stddev_daily, horizon_days,
        reorder_point, recommended_order_qty, days_of_cover, generated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (product_id) DO UPDATE
       SET forecast_daily_units  = EXCLUDED.forecast_daily_units,
           stddev_daily          = EXCLUDED.stddev_daily,
           horizon_days          = EXCLUDED.horizon_days,
           reorder_point         = EXCLUDED.reorder_point,
           recommended_order_qty = EXCLUDED.recommended_order_qty,
           days_of_cover         = EXCLUDED.days_of_cover,
           generated_at          = now()`,
    [
      f.product_id, f.forecast_daily_units, f.stddev_daily, f.horizon_days,
      f.reorder_point, f.recommended_order_qty, f.days_of_cover,
    ]
  );
}

async function forecastsByShop(shop_id) {
  const { rows } = await query(
    `SELECT p.id, p.sku, p.title, p.on_hand, p.lead_time_days,
            f.forecast_daily_units, f.stddev_daily, f.horizon_days,
            f.reorder_point, f.recommended_order_qty, f.days_of_cover,
            f.generated_at
     FROM products p
     LEFT JOIN forecasts f ON f.product_id = p.id
     WHERE p.shop_id = $1
     ORDER BY (f.recommended_order_qty IS NULL), f.recommended_order_qty DESC, p.title`,
    [shop_id]
  );
  return rows;
}

module.exports = { recordDaily, dailySeries, saveForecast, forecastsByShop };
