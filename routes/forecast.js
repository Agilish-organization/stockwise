// POST /forecast/:shopId         -> recompute & persist forecasts for all SKUs
// GET  /forecast/:shopId         -> JSON of cached forecasts + reorder recs

const express = require('express');
const productsDb = require('../db/products');
const salesDb = require('../db/sales');
const shopsDb = require('../db/shops');
const { forecast } = require('../forecast/exponential_smoothing');
const { recommend } = require('../forecast/reorder');

const router = express.Router();

router.post('/:shopId', async (req, res) => {
  const shopId = parseInt(req.params.shopId, 10);
  const shop = await shopsDb.findById(shopId);
  if (!shop) return res.status(404).json({ error: 'shop not found' });

  const products = await productsDb.listByShop(shop.id);
  const results = [];
  for (const p of products) {
    const series = await salesDb.dailySeries(p.id, 90);
    const f = forecast(series);
    const r = recommend({
      on_hand: p.on_hand,
      lead_time_days: p.lead_time_days,
      forecast_daily_units: f.forecast_daily_units,
      stddev_daily: f.stddev_daily,
    });
    await salesDb.saveForecast({
      product_id: p.id,
      forecast_daily_units: f.forecast_daily_units,
      stddev_daily: f.stddev_daily,
      horizon_days: r.horizon_days,
      reorder_point: r.reorder_point,
      recommended_order_qty: r.recommended_order_qty,
      days_of_cover: r.days_of_cover,
    });
    results.push({ product_id: p.id, sku: p.sku, ...f, ...r });
  }
  res.json({ ok: true, count: results.length, results });
});

router.get('/:shopId', async (req, res) => {
  const shopId = parseInt(req.params.shopId, 10);
  const rows = await salesDb.forecastsByShop(shopId);
  res.json({ rows });
});

module.exports = router;
