// Demo seeder. Lets reviewers see the dashboard without going through Shopify
// OAuth. Reproducible: same products and similar (seeded-random) sales each run.

const shopsDb = require('../db/shops');
const productsDb = require('../db/products');
const salesDb = require('../db/sales');
const { forecast } = require('../forecast/exponential_smoothing');
const { recommend } = require('../forecast/reorder');

const SAMPLE_PRODUCTS = [
  { sku: 'TEE-BLK-M',  title: 'Classic Tee — Black / M',   on_hand: 18,  baseline: 4,  trend: 0.05 },
  { sku: 'TEE-WHT-L',  title: 'Classic Tee — White / L',   on_hand: 64,  baseline: 2,  trend: 0.0 },
  { sku: 'MUG-12OZ',   title: 'Logo Mug 12oz',             on_hand: 8,   baseline: 3,  trend: 0.1 },
  { sku: 'HOOD-NAV-L', title: 'Hoodie — Navy / L',         on_hand: 2,   baseline: 1.5, trend: 0.03 },
  { sku: 'STKR-PACK',  title: 'Sticker Pack',              on_hand: 250, baseline: 7,  trend: -0.02 },
  { sku: 'CAP-RED',    title: 'Snapback Cap — Red',        on_hand: 25,  baseline: 1,  trend: 0.0 },
];

// Deterministic PRNG so the demo is reproducible.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

async function ensureDemoShop() {
  return shopsDb.upsert({
    shop_domain: 'demo.myshopify.com',
    access_token: 'DEMO',
    scopes: 'demo',
  });
}

async function seedShop(shop_id) {
  const rand = lcg(42);
  const today = new Date();
  for (let i = 0; i < SAMPLE_PRODUCTS.length; i++) {
    const s = SAMPLE_PRODUCTS[i];
    const p = await productsDb.upsert({
      shop_id,
      shopify_id: `demo-${s.sku}`,
      sku: s.sku,
      title: s.title,
      on_hand: s.on_hand,
      lead_time_days: 14,
      cost: null,
    });
    for (let d = 89; d >= 0; d--) {
      // Linear trend + uniform noise. Round to whole units.
      const expected = Math.max(0, s.baseline + s.trend * (89 - d));
      const noise = (rand() - 0.5) * 2;
      const units = Math.max(0, Math.round(expected + noise));
      if (units === 0) continue;
      const day = new Date(today);
      day.setDate(today.getDate() - d);
      await salesDb.recordDaily({
        shop_id,
        product_id: p.id,
        sale_date: day.toISOString().slice(0, 10),
        units,
        revenue: units * 20,
      });
    }
  }
}

async function computeForecastsForShop(shop_id) {
  const products = await productsDb.listByShop(shop_id);
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
  }
}

module.exports = { ensureDemoShop, seedShop, computeForecastsForShop, SAMPLE_PRODUCTS };
