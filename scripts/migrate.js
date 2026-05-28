#!/usr/bin/env node
// Runs every .sql in migrations/ in lexical (timestamp) order.
// Idempotent files allow safe re-runs without a migrations ledger table.

const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function main() {
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    process.stdout.write(`Applying ${f}... `);
    await pool.query(sql);
    console.log('ok');
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
