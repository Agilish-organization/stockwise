// Holt's linear exponential smoothing.
// We chose Holt over Holt-Winters because most SMB e-commerce SKUs don't have
// enough history for a stable seasonal component; trend + level is the
// honest model for <90 days of data.

const ALPHA = 0.3;   // level smoothing
const BETA  = 0.1;   // trend smoothing

function mean(xs) {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

// Returns { forecast_daily_units, stddev_daily, n }.
// `series` is an array of daily unit counts, oldest first.
function forecast(series) {
  const units = series.map(r => (typeof r === 'number' ? r : r.units));
  const n = units.length;

  if (n === 0) {
    return { forecast_daily_units: 0, stddev_daily: 0, n: 0, method: 'empty' };
  }

  // Cold-start: not enough signal for trend — use mean.
  if (n < 14) {
    return {
      forecast_daily_units: mean(units),
      stddev_daily: stddev(units),
      n,
      method: 'mean',
    };
  }

  // Initialize level = first value, trend = (last - first) / (n - 1).
  let level = units[0];
  let trend = (units[n - 1] - units[0]) / (n - 1);

  for (let t = 1; t < n; t++) {
    const prevLevel = level;
    level = ALPHA * units[t] + (1 - ALPHA) * (level + trend);
    trend = BETA * (level - prevLevel) + (1 - BETA) * trend;
  }

  // 1-step-ahead forecast. We deliberately don't add trend*h for multi-step;
  // small SMB series and aggressive trends produce nonsense extrapolations.
  // The caller uses `forecast_daily_units` as a flat per-day demand estimate.
  const f = Math.max(0, level + trend);

  return {
    forecast_daily_units: f,
    stddev_daily: stddev(units),
    n,
    method: 'holt',
  };
}

module.exports = { forecast, mean, stddev };
