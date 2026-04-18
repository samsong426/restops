const db = require('./index');

const menu = {
  getMenuItems: () =>
    db.prepare('SELECT * FROM menu_items WHERE active = 1 ORDER BY name').all(),

  addMenuItem: ({ name, price }) =>
    db.prepare('INSERT INTO menu_items (name, price) VALUES (?, ?)').run(name, price || 0),

  updateMenuItem: (id, { name, price }) =>
    db.prepare('UPDATE menu_items SET name=?, price=? WHERE id=?').run(name, price || 0, id),

  deactivateMenuItem: (id) =>
    db.prepare('UPDATE menu_items SET active = 0 WHERE id = ?').run(id),

  getRecipes: () =>
    db.prepare(`
      SELECT ri.*, mi.name AS dish_name, ii.name AS ingredient_name, ii.unit
      FROM recipe_items ri
      JOIN menu_items mi ON mi.id = ri.menu_item_id
      JOIN inventory_items ii ON ii.id = ri.inventory_item_id
      WHERE mi.active = 1
      ORDER BY mi.name, ii.name
    `).all(),

  upsertRecipeItem: ({ menu_item_id, inventory_item_id, qty_used }) =>
    db.prepare(`
      INSERT INTO recipe_items (menu_item_id, inventory_item_id, qty_used) VALUES (?, ?, ?)
      ON CONFLICT(menu_item_id, inventory_item_id) DO UPDATE SET qty_used = excluded.qty_used
    `).run(menu_item_id, inventory_item_id, qty_used),

  removeRecipeItem: (menu_item_id, inventory_item_id) =>
    db.prepare('DELETE FROM recipe_items WHERE menu_item_id = ? AND inventory_item_id = ?')
      .run(menu_item_id, inventory_item_id),

  getDishSales: (date) =>
    db.prepare(`
      SELECT ds.*, mi.name AS dish_name, mi.price,
             (ds.qty_sold * mi.price) AS revenue
      FROM dish_sales ds
      JOIN menu_items mi ON mi.id = ds.menu_item_id
      WHERE ds.date = ?
    `).all(date),

  getAllSales: () =>
    db.prepare(`
      SELECT ds.*, mi.name AS dish_name, mi.price,
             (ds.qty_sold * mi.price) AS revenue
      FROM dish_sales ds
      JOIN menu_items mi ON mi.id = ds.menu_item_id
      ORDER BY ds.date DESC
    `).all(),

  updateSale: (id, qty_sold) =>
    db.prepare('UPDATE dish_sales SET qty_sold=? WHERE id=?').run(qty_sold, id),

  deleteSale: (id) =>
    db.prepare('DELETE FROM dish_sales WHERE id=?').run(id),

  saveDishSales: (date, sales) => {
    const upsert = db.prepare(`
      INSERT INTO dish_sales (date, menu_item_id, qty_sold) VALUES (?, ?, ?)
      ON CONFLICT(date, menu_item_id) DO UPDATE SET qty_sold = qty_sold + excluded.qty_sold
    `);
    db.transaction(() => sales.forEach(s => upsert.run(date, s.menu_item_id, s.qty_sold)))();
  },

  // Revenue for a date range
  getRevenueBetween: (startDate, endDate) =>
    db.prepare(`
      SELECT COALESCE(SUM(ds.qty_sold * mi.price), 0) AS revenue
      FROM dish_sales ds JOIN menu_items mi ON mi.id = ds.menu_item_id
      WHERE ds.date BETWEEN ? AND ?
    `).get(startDate, endDate),

  // Food cost per dish (ingredient cost sum ÷ price)
  getDishCosts: () =>
    db.prepare(`
      SELECT mi.id, mi.name, mi.price,
        COALESCE(SUM(ri.qty_used * ii.cost_per_unit), 0) AS ingredient_cost
      FROM menu_items mi
      LEFT JOIN recipe_items ri ON ri.menu_item_id = mi.id
      LEFT JOIN inventory_items ii ON ii.id = ri.inventory_item_id
      WHERE mi.active = 1
      GROUP BY mi.id
    `).all(),

  // Consumption of each inventory item since a given date (from dish sales × recipes)
  getConsumptionSince: (date) =>
    db.prepare(`
      SELECT ri.inventory_item_id,
             SUM(ds.qty_sold * ri.qty_used) AS consumed
      FROM dish_sales ds
      JOIN recipe_items ri ON ri.menu_item_id = ds.menu_item_id
      WHERE ds.date >= ?
      GROUP BY ri.inventory_item_id
    `).all(date),
};

module.exports = menu;
