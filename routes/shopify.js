// Shopify OAuth (install + callback). Spec:
// https://shopify.dev/docs/apps/build/authentication-authorization
//
// Flow:
//   GET /shopify/install?shop=foo.myshopify.com -> 302 to Shopify authorize URL
//   GET /shopify/callback?code=...&shop=...&hmac=... -> exchange code, persist token

const express = require('express');
const crypto = require('crypto');
const https = require('https');
const shopsDb = require('../db/shops');

const router = express.Router();

const API_KEY = process.env.SHOPIFY_API_KEY;
const API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = process.env.SHOPIFY_SCOPES || 'read_products,read_orders,read_inventory';
const APP_URL = process.env.SHOPIFY_APP_URL || '';

function isValidShopDomain(shop) {
  // Whitelist *.myshopify.com to prevent open-redirect via the install endpoint.
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop || '');
}

function verifyHmac(query) {
  const { hmac, ...rest } = query;
  if (!hmac) return false;
  const message = Object.keys(rest)
    .sort()
    .map(k => `${k}=${rest[k]}`)
    .join('&');
  const digest = crypto
    .createHmac('sha256', API_SECRET || '')
    .update(message)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
  } catch {
    return false;
  }
}

router.get('/install', (req, res) => {
  const shop = req.query.shop;
  if (!isValidShopDomain(shop)) {
    return res.status(400).send('Invalid shop domain. Expected <name>.myshopify.com');
  }
  if (!API_KEY || !API_SECRET) {
    return res.status(500).send('Shopify app credentials not configured.');
  }
  const redirectUri = `${APP_URL}/shopify/callback`;
  const state = crypto.randomBytes(16).toString('hex');
  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(API_KEY)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;
  res.cookie?.('sw_state', state, { httpOnly: true, sameSite: 'lax' });
  res.redirect(installUrl);
});

router.get('/callback', async (req, res) => {
  const { shop, code } = req.query;
  if (!isValidShopDomain(shop) || !code) {
    return res.status(400).send('Bad callback parameters.');
  }
  if (!verifyHmac(req.query)) {
    return res.status(400).send('HMAC verification failed.');
  }
  try {
    const tokenResp = await postJson(
      `https://${shop}/admin/oauth/access_token`,
      { client_id: API_KEY, client_secret: API_SECRET, code }
    );
    if (!tokenResp.access_token) {
      return res.status(502).send('Token exchange failed.');
    }
    await shopsDb.upsert({
      shop_domain: shop,
      access_token: tokenResp.access_token,
      scopes: tokenResp.scope || SCOPES,
    });
    res.redirect(`/dashboard?shop=${encodeURIComponent(shop)}`);
  } catch (err) {
    console.error('OAuth callback error', err);
    res.status(500).send('OAuth failure.');
  }
});

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      r => {
        let buf = '';
        r.on('data', d => (buf += d));
        r.on('end', () => {
          try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = router;
