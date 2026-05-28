const test = require('node:test');
const assert = require('node:assert/strict');

const { forecast, mean, stddev } = require('../forecast/exponential_smoothing');
const { recommend } = require('../forecast/reorder');

test('forecast: empty series', () => {
  const f = forecast([]);
  assert.equal(f.forecast_daily_units, 0);
  assert.equal(f.method, 'empty');
});

test('forecast: cold-start uses mean for short series', () => {
  const series = [2, 3, 2, 4, 3, 2, 3]; // 7 days
  const f = forecast(series);
  assert.equal(f.method, 'mean');
  assert.ok(Math.abs(f.forecast_daily_units - mean(series)) < 1e-9);
});

test('forecast: stable series converges near the mean', () => {
  const series = Array.from({ length: 60 }, () => 5);
  const f = forecast(series);
  assert.equal(f.method, 'holt');
  assert.ok(Math.abs(f.forecast_daily_units - 5) < 0.5);
  assert.equal(f.stddev_daily, 0);
});

test('forecast: rising trend produces forecast > mean', () => {
  const series = Array.from({ length: 30 }, (_, i) => i + 1); // 1..30
  const f = forecast(series);
  assert.ok(f.forecast_daily_units > mean(series),
    `expected ${f.forecast_daily_units} > ${mean(series)}`);
});

test('reorder: recommends when stock below reorder point', () => {
  const r = recommend({
    on_hand: 5, lead_time_days: 14,
    forecast_daily_units: 2, stddev_daily: 0.5,
  });
  // reorder_point = 14*2 + 1.65*0.5*sqrt(14) ~= 28 + 3.09 = 31.09
  assert.ok(r.reorder_point > 28);
  assert.ok(r.recommended_order_qty > 0);
});

test('reorder: no recommendation when well-stocked', () => {
  const r = recommend({
    on_hand: 500, lead_time_days: 14,
    forecast_daily_units: 1, stddev_daily: 0.2,
  });
  assert.equal(r.recommended_order_qty, 0);
});

test('reorder: zero demand → no recs, no days_of_cover', () => {
  const r = recommend({
    on_hand: 10, lead_time_days: 14,
    forecast_daily_units: 0, stddev_daily: 0,
  });
  assert.equal(r.recommended_order_qty, 0);
  assert.equal(r.days_of_cover, null);
});

test('stddev: zero on constant series', () => {
  assert.equal(stddev([3, 3, 3, 3]), 0);
});
