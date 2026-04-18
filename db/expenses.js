const db = require('./index');

const expenses = {
  getByDate: (date) =>
    db.prepare('SELECT * FROM daily_expenses WHERE date = ? ORDER BY created_at').all(date),

  add: ({ date, description, amount }) =>
    db.prepare('INSERT INTO daily_expenses (date, description, amount) VALUES (?, ?, ?)')
      .run(date, description, parseFloat(amount)),

  delete: (id) =>
    db.prepare('DELETE FROM daily_expenses WHERE id = ?').run(id),

  // Full cash flow summary for a single day
  getDaySummary: (date) => {
    // Revenue from dish sales (live, not waiting for EOD close)
    const salesRow = db.prepare(`
      SELECT COALESCE(SUM(ds.qty_sold * mi.price), 0) AS revenue
      FROM dish_sales ds
      JOIN menu_items mi ON mi.id = ds.menu_item_id
      WHERE ds.date = ?
    `).get(date);

    const labor = db.prepare(`
      SELECT st.name, st.role, st.hourly_rate,
        ROUND(
          ((CAST(substr(end_time,1,2) AS REAL) + CAST(substr(end_time,4,2) AS REAL)/60) -
           (CAST(substr(start_time,1,2) AS REAL) + CAST(substr(start_time,4,2) AS REAL)/60))
        , 2) AS hours,
        ROUND(
          ((CAST(substr(end_time,1,2) AS REAL) + CAST(substr(end_time,4,2) AS REAL)/60) -
           (CAST(substr(start_time,1,2) AS REAL) + CAST(substr(start_time,4,2) AS REAL)/60))
          * st.hourly_rate
        , 2) AS cost
      FROM schedule_slots s
      JOIN staff st ON st.id = s.staff_id
      WHERE s.date = ?
      ORDER BY s.start_time
    `).all(date);

    const inventory = db.prepare(`
      SELECT b.id AS batch_id, b.qty, b.purchase_date, i.name, i.unit, i.cost_per_unit,
        ROUND(b.qty * i.cost_per_unit, 2) AS total_cost
      FROM inventory_batches b
      JOIN inventory_items i ON i.id = b.item_id
      WHERE b.purchase_date = ?
      ORDER BY b.received_at
    `).all(date);

    const otherExpenses = db.prepare(
      'SELECT * FROM daily_expenses WHERE date = ? ORDER BY created_at'
    ).all(date);

    const revenue = salesRow?.revenue || 0;
    const laborTotal = labor.reduce((s, r) => s + (r.cost || 0), 0);
    const inventoryTotal = inventory.reduce((s, r) => s + (r.total_cost || 0), 0);
    const otherTotal = otherExpenses.reduce((s, r) => s + (r.amount || 0), 0);
    const totalExpenses = laborTotal + inventoryTotal + otherTotal;

    return {
      date,
      revenue,
      labor,
      labor_total: Math.round(laborTotal * 100) / 100,
      inventory,
      inventory_total: Math.round(inventoryTotal * 100) / 100,
      other_expenses: otherExpenses,
      other_total: Math.round(otherTotal * 100) / 100,
      total_expenses: Math.round(totalExpenses * 100) / 100,
      net: Math.round((revenue - totalExpenses) * 100) / 100,
    };
  },
};

module.exports = expenses;
