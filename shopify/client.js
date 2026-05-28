// Minimal Shopify Admin REST client. We deliberately avoid the SDK to keep
// dependencies near zero on the free tier and to make the code easy to audit.

const https = require('https');

const API_VERSION = '2024-10';

function getJson(shop, accessToken, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: shop,
        path: `/admin/api/${API_VERSION}${path}`,
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          Accept: 'application/json',
        },
      },
      r => {
        let buf = '';
        r.on('data', d => (buf += d));
        r.on('end', () => {
          if (r.statusCode >= 400) {
            return reject(new Error(`Shopify ${r.statusCode}: ${buf}`));
          }
          try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function fetchProducts(shop, accessToken) {
  const out = await getJson(shop, accessToken, '/products.json?limit=250');
  return out.products || [];
}

async function fetchOrders(shop, accessToken, sinceISO) {
  // status=any so we include cancelled/refunded? No: forecasting should reflect
  // net realized demand. financial_status=paid + fulfillment_status=any keeps it
  // honest without dropping pre-shipment paid orders.
  const params = new URLSearchParams({
    status: 'any',
    financial_status: 'paid',
    limit: '250',
    created_at_min: sinceISO,
  });
  const out = await getJson(shop, accessToken, `/orders.json?${params}`);
  return out.orders || [];
}

module.exports = { fetchProducts, fetchOrders };
