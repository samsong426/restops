const db = require('./index');

const inventory = {
  getAllItems: () =>
    db.prepare('SELECT * FROM inventory_items WHERE active = 1 ORDER BY category, name').all(),

  addItem: ({ name, unit, par_level, category, cost_per_unit, expiry_date }) =>
    db.prepare(`
      INSERT INTO inventory_items (name, unit, par_level, category, cost_per_unit, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, unit || 'unit', par_level || 0, category || 'general',
           cost_per_unit || 0, expiry_date || null),

  updateItem: (id, { name, unit, par_level, category, cost_per_unit, expiry_date }) =>
    db.prepare(`
      UPDATE inventory_items SET name=?, unit=?, par_level=?, category=?, cost_per_unit=?, expiry_date=? WHERE id=?
    `).run(name, unit, par_level, category, cost_per_unit || 0, expiry_date || null, id),

  updateBatch: (id, { qty, expiry_date }) =>
    db.prepare('UPDATE inventory_batches SET qty=?, expiry_date=? WHERE id=?').run(qty, expiry_date, id),

  deactivateItem: (id) =>
    db.prepare('UPDATE inventory_items SET active = 0 WHERE id = ?').run(id),

  // Batches (lot tracking per delivery)
  getAllBatches: () =>
    db.prepare('SELECT b.*, i.name AS item_name, i.unit FROM inventory_batches b JOIN inventory_items i ON i.id = b.item_id ORDER BY b.expiry_date ASC').all(),

  getBatchesForItem: (item_id) =>
    db.prepare('SELECT * FROM inventory_batches WHERE item_id = ? ORDER BY expiry_date ASC').all(item_id),

  addBatch: ({ item_id, qty, expiry_date }) =>
    db.prepare('INSERT INTO inventory_batches (item_id, qty, expiry_date) VALUES (?, ?, ?)').run(item_id, qty, expiry_date),

  deleteBatch: (id) =>
    db.prepare('DELETE FROM inventory_batches WHERE id = ?').run(id),

  getLatestCounts: () => {
    const items = db.prepare(`
      SELECT i.*, c.count, c.counted_at
      FROM inventory_items i
      LEFT JOIN inventory_counts c ON c.id = (
        SELECT id FROM inventory_counts WHERE item_id = i.id ORDER BY counted_at DESC LIMIT 1
      )
      WHERE i.active = 1
      ORDER BY i.category, i.name
    `).all();

    // Use localtime conversion so counts recorded in UTC still align with
    // local-date dish_sales entries (e.g. count at 00:05 UTC = previous local day)
    const consumeStmt = db.prepare(`
      SELECT COALESCE(SUM(ds.qty_sold * ri.qty_used), 0) AS consumed
      FROM dish_sales ds
      JOIN recipe_items ri ON ri.menu_item_id = ds.menu_item_id
      WHERE ri.inventory_item_id = @id
        AND ds.date >= date(
          (SELECT counted_at FROM inventory_counts WHERE item_id = @id ORDER BY counted_at DESC LIMIT 1),
          'localtime'
        )
    `);

    // Earliest expiring batch per item
    const batchSummaries = db.prepare(`
      SELECT item_id,
             MIN(expiry_date) AS earliest_expiry,
             COUNT(*) AS batch_count,
             SUM(qty) AS total_batch_qty
      FROM inventory_batches
      GROUP BY item_id
    `).all();
    const batchMap = Object.fromEntries(batchSummaries.map(b => [b.item_id, b]));

    return items.map(item => {
      const consumed = item.count != null ? (consumeStmt.get({ id: item.id })?.consumed || 0) : 0;
      const b = batchMap[item.id];
      return {
        ...item,
        consumed,
        estimated_remaining: item.count != null ? Math.max(0, item.count - consumed) : null,
        earliest_expiry: b?.earliest_expiry || null,
        batch_count: b?.batch_count || 0,
        total_batch_qty: b?.total_batch_qty || 0,
      };
    });
  },

  submitCount: (counts) => {
    const insert = db.prepare('INSERT INTO inventory_counts (item_id, count) VALUES (?, ?)');
    db.transaction((items) => items.forEach(({ item_id, count }) => insert.run(item_id, count)))(counts);
  },

  getBelowPar: () =>
    db.prepare(`
      SELECT i.name, i.unit, i.par_level, i.category,
        c.count AS current_count,
        (i.par_level - c.count) AS order_qty
      FROM inventory_items i
      JOIN inventory_counts c ON c.id = (
        SELECT id FROM inventory_counts WHERE item_id = i.id ORDER BY counted_at DESC LIMIT 1
      )
      WHERE i.active = 1 AND c.count < i.par_level
      ORDER BY order_qty DESC
    `).all(),

  getWasteRisk: () => {
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    return db.prepare(`
      SELECT b.id AS batch_id, b.item_id, b.qty, b.expiry_date, b.received_at,
             i.name, i.unit, i.cost_per_unit,
             (b.qty * i.cost_per_unit) AS waste_value
      FROM inventory_batches b
      JOIN inventory_items i ON i.id = b.item_id
      WHERE i.active = 1
        AND b.expiry_date <= ?
        AND i.cost_per_unit > 0
      ORDER BY b.expiry_date
    `).all(soon).map(r => ({ ...r, is_expired: r.expiry_date < today }));
  },

  getHistory: (item_id, limit = 14) =>
    db.prepare('SELECT * FROM inventory_counts WHERE item_id = ? ORDER BY counted_at DESC LIMIT ?')
      .all(item_id, limit),
};

module.exports = inventory;
