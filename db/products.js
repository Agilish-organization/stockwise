const { query } = require('./index');

async function upsert({ shop_id, shopify_id, sku, title, on_hand, lead_time_days, cost }) {
  const { rows } = await query(
    `INSERT INTO products (shop_id, shopify_id, sku, title, on_hand, lead_time_days, cost, updated_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 14), $7, now())
     ON CONFLICT (shop_id, shopify_id) DO UPDATE
       SET sku            = EXCLUDED.sku,
           title          = EXCLUDED.title,
           on_hand        = EXCLUDED.on_hand,
           lead_time_days = COALESCE(EXCLUDED.lead_time_days, products.lead_time_days),
           cost           = EXCLUDED.cost,
           updated_at     = now()
     RETURNING *`,
    [shop_id, shopify_id, sku, title, on_hand || 0, lead_time_days, cost]
  );
  return rows[0];
}

async function listByShop(shop_id) {
  const { rows } = await query(
    'SELECT * FROM products WHERE shop_id = $1 ORDER BY title',
    [shop_id]
  );
  return rows;
}

async function findByShopifyId(shop_id, shopify_id) {
  const { rows } = await query(
    'SELECT * FROM products WHERE shop_id = $1 AND shopify_id = $2',
    [shop_id, shopify_id]
  );
  return rows[0];
}

module.exports = { upsert, listByShop, findByShopifyId };
