// Reorder logic. Inputs come from exponential_smoothing.js + product master.
//
// reorder_point = lead_time_days * daily_demand + safety_stock
// safety_stock  = z * stddev_daily * sqrt(lead_time_days)     // z=1.65 -> ~95%
//
// If on_hand <= reorder_point, recommend ordering enough to reach a target
// days-of-cover (default 30).

const Z_95 = 1.65;
const TARGET_DAYS_OF_COVER = 30;

function recommend({ on_hand, lead_time_days, forecast_daily_units, stddev_daily }) {
  const lt = Math.max(1, lead_time_days || 14);
  const demand = Math.max(0, forecast_daily_units || 0);
  const sd = Math.max(0, stddev_daily || 0);

  const safety = Z_95 * sd * Math.sqrt(lt);
  const reorder_point = lt * demand + safety;

  const days_of_cover = demand > 0 ? on_hand / demand : null;

  let recommended_order_qty = 0;
  if (on_hand <= reorder_point) {
    const target = TARGET_DAYS_OF_COVER * demand;
    recommended_order_qty = Math.max(0, Math.ceil(target - on_hand));
  }

  return {
    reorder_point: round2(reorder_point),
    days_of_cover: days_of_cover === null ? null : round2(days_of_cover),
    recommended_order_qty,
    horizon_days: TARGET_DAYS_OF_COVER,
  };
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

module.exports = { recommend, Z_95, TARGET_DAYS_OF_COVER };
