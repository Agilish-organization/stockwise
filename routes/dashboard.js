// Server-rendered HTML dashboard. We render strings directly rather than
// pull in a template engine; the view is small and the dependency saves us
// install time on free-tier deploys.

const express = require('express');
const shopsDb = require('../db/shops');
const salesDb = require('../db/sales');

const router = express.Router();

function escape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n, d = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(d);
}

function statusBadge(row) {
  if (!row.forecast_daily_units) return '<span class="badge gray">no data</span>';
  if (row.recommended_order_qty > 0) return '<span class="badge red">REORDER</span>';
  if (row.days_of_cover && row.days_of_cover < 21) return '<span class="badge amber">low</span>';
  return '<span class="badge green">ok</span>';
}

router.get('/', async (req, res) => {
  const shops = await shopsDb.list();
  const shopsHtml = shops.length
    ? shops.map(s => `<li><a href="/dashboard/${s.id}">${escape(s.shop_domain)}</a></li>`).join('')
    : '<li><em>No shops connected yet.</em></li>';
  res.send(layout('Stockwise', `
    <h1>Stockwise</h1>
    <p class="lead">AI-powered inventory forecasting for small e-commerce brands.</p>
    <h2>Connected shops</h2>
    <ul>${shopsHtml}</ul>
    <h2>Connect a shop</h2>
    <form action="/shopify/install" method="get">
      <input name="shop" placeholder="your-store.myshopify.com" required />
      <button type="submit">Install</button>
    </form>
    <p class="muted">Demo? Visit <a href="/dashboard/demo">/dashboard/demo</a> to seed sample data.</p>
  `));
});

// Convenience: seeds a demo shop on first hit so reviewers can see the dashboard
// without going through Shopify OAuth.
router.get('/demo', async (req, res) => {
  const demo = require('../demo/seed');
  const shop = await demo.ensureDemoShop();
  await demo.seedShop(shop.id);
  await demo.computeForecastsForShop(shop.id);
  res.redirect(`/dashboard/${shop.id}`);
});

router.get('/:shopId', async (req, res) => {
  const shopId = parseInt(req.params.shopId, 10);
  const shop = await shopsDb.findById(shopId);
  if (!shop) return res.status(404).send('Shop not found');

  const rows = await salesDb.forecastsByShop(shopId);
  const tbody = rows.map(r => `
    <tr>
      <td>${escape(r.sku || '—')}</td>
      <td>${escape(r.title)}</td>
      <td class="num">${r.on_hand}</td>
      <td class="num">${fmt(r.forecast_daily_units, 2)}</td>
      <td class="num">${fmt(r.days_of_cover, 1)}</td>
      <td class="num">${fmt(r.reorder_point, 1)}</td>
      <td class="num strong">${r.recommended_order_qty || 0}</td>
      <td>${statusBadge(r)}</td>
    </tr>
  `).join('');

  res.send(layout(`${shop.shop_domain} — Stockwise`, `
    <h1>${escape(shop.shop_domain)}</h1>
    <div class="actions">
      <form action="/ingest/${shop.id}" method="post" style="display:inline">
        <button type="submit">Sync from Shopify</button>
      </form>
      <form action="/forecast/${shop.id}" method="post" style="display:inline">
        <button type="submit">Recompute forecasts</button>
      </form>
      <a href="/dashboard">← all shops</a>
    </div>
    <table>
      <thead>
        <tr>
          <th>SKU</th><th>Product</th><th>On hand</th>
          <th>Daily demand</th><th>Days of cover</th>
          <th>Reorder point</th><th>Order qty</th><th>Status</th>
        </tr>
      </thead>
      <tbody>${tbody || '<tr><td colspan="8"><em>No products. Click Sync.</em></td></tr>'}</tbody>
    </table>
  `));
});

function layout(title, body) {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<title>${escape(title)}</title>
<link rel="stylesheet" href="/public/app.css" />
</head><body>
<main>${body}</main>
<footer><a href="https://stockwise.agilishai.com">stockwise.agilishai.com</a></footer>
</body></html>`;
}

module.exports = router;
