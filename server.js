const path = require('path');
const express = require('express');

const app = express();
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use('/shopify', require('./routes/shopify'));
app.use('/ingest', require('./routes/ingest'));
app.use('/forecast', require('./routes/forecast'));
app.use('/dashboard', require('./routes/dashboard'));

app.get('/', (req, res) => res.redirect('/dashboard'));
app.get('/healthz', (req, res) => res.json({ ok: true }));

// Centralized error responder so route handlers can throw and we still send
// JSON for /ingest|/forecast and HTML for dashboard paths.
app.use((err, req, res, _next) => {
  console.error('Unhandled error', err);
  if (req.path.startsWith('/dashboard')) {
    return res.status(500).send('Server error.');
  }
  res.status(500).json({ error: String(err.message || err) });
});

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => console.log(`Stockwise listening on :${port}`));
}

module.exports = app;
