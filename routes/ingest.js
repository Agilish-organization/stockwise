// POST /ingest/:shopId  -> pull last 90d of orders, refresh product master
//
// We persist daily aggregates rather than raw line items because the
// forecaster only ever reads daily series, and SMB stores can have 10k+
// orders/yr that we'd otherwise re-scan on every dashboard load.

const express = require('express');
const shopsDb = require('../db/shops');
const productsDb = require('../db/products');
const salesDb = require('../db/sales');
const shopifyClient = require('../shopify/client');
const demo = require('../demo/seed');

const router = express.Router();

router.post('/:shopId', async (req, res) => {
  const shopId = parseInt(req.params.shopId, 10);
  const shop = await shopsDb.findById(shopId);
  if (!shop) return res.status(404).json({ error: 'shop not found' });

  try {
    if (process.env.DEMO_MODE === '1' || shop.access_token === 'DEMO') {
      await demo.seedShop(shop.id);
      return res.json({ ok: true, mode: 'demo' });
    }

    const products = await shopifyClient.fetchProducts(shop.shop_domain, shop.access_token);
    const productByShopifyId = new Map();
    for (const p of products) {
      // A product has many variants in Shopify. We collapse to one record per
      // variant since inventory + SKU live there.
      for (const v of p.variants || []) {
        const row = await productsDb.upsert({
          shop_id: shop.id,
          shopify_id: String(v.id),
          sku: v.sku || null,
          title: `${p.title}${v.title && v.title !== 'Default Title' ? ' / ' + v.title : ''}`,
          on_hand: v.inventory_quantity ?? 0,
          lead_time_days: null,
          cost: v.price ? parseFloat(v.price) : null,
        });
        productByShopifyId.set(String(v.id), row);
      }
    }

    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const orders = await shopifyClient.fetchOrders(shop.shop_domain, shop.access_token, since);

    for (const o of orders) {
      const day = o.created_at.slice(0, 10);
      for (const li of o.line_items || []) {
        const variantKey = String(li.variant_id);
        const prod = productByShopifyId.get(variantKey);
        if (!prod) continue;
        await salesDb.recordDaily({
          shop_id: shop.id,
          product_id: prod.id,
          sale_date: day,
          units: li.quantity || 0,
          revenue: (parseFloat(li.price || '0') * (li.quantity || 0)) || 0,
        });
      }
    }

    res.json({ ok: true, products: products.length, orders: orders.length });
  } catch (err) {
    console.error('ingest error', err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

module.exports = router;
