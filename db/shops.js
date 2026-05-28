const { query } = require('./index');

async function upsert({ shop_domain, access_token, scopes }) {
  const { rows } = await query(
    `INSERT INTO shops (shop_domain, access_token, scopes)
     VALUES ($1, $2, $3)
     ON CONFLICT (shop_domain) DO UPDATE
       SET access_token = EXCLUDED.access_token,
           scopes       = EXCLUDED.scopes
     RETURNING *`,
    [shop_domain, access_token, scopes]
  );
  return rows[0];
}

async function findByDomain(shop_domain) {
  const { rows } = await query(
    'SELECT * FROM shops WHERE shop_domain = $1',
    [shop_domain]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await query('SELECT * FROM shops WHERE id = $1', [id]);
  return rows[0];
}

async function list() {
  const { rows } = await query('SELECT * FROM shops ORDER BY installed_at DESC');
  return rows;
}

module.exports = { upsert, findByDomain, findById, list };
