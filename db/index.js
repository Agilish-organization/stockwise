// The ONLY place `new Pool()` is constructed. Every other db/* file imports
// `query` from here. Keeps connection management in one spot.

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

// In DEMO_MODE with no DB configured we still export a pool object so requires
// don't crash; queries that hit it will fail loudly, which is fine for prod.
const pool = connectionString
  ? new Pool({ connectionString, max: 5 })
  : new Pool({ host: 'localhost', database: 'stockwise', max: 1 });

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
