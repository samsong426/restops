const db = require('./index');

const eod = {
  getLog: (date) =>
    db.prepare('SELECT * FROM eod_logs WHERE date = ?').get(date),

  upsertLog: ({ date, covers, sales_total, cash_total, card_total, ran_out, notes, opener_name }) =>
    db.prepare(`
      INSERT INTO eod_logs (date, covers, sales_total, cash_total, card_total, ran_out, notes, opener_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        covers = excluded.covers,
        sales_total = excluded.sales_total,
        cash_total = excluded.cash_total,
        card_total = excluded.card_total,
        ran_out = excluded.ran_out,
        notes = excluded.notes,
        opener_name = excluded.opener_name
    `).run(date, covers || null, sales_total || null, cash_total || null, card_total || null,
           ran_out || null, notes || null, opener_name || null),

  deleteLog: (date) =>
    db.prepare('DELETE FROM eod_logs WHERE date=?').run(date),

  getRecent: (limit = 30) =>
    db.prepare('SELECT * FROM eod_logs ORDER BY date DESC LIMIT ?').all(limit),

  getSummary: (startDate, endDate) =>
    db.prepare(`
      SELECT
        COUNT(*) AS days_logged,
        SUM(covers) AS total_covers,
        SUM(sales_total) AS total_sales,
        AVG(covers) AS avg_covers,
        AVG(sales_total) AS avg_sales
      FROM eod_logs
      WHERE date BETWEEN ? AND ?
    `).get(startDate, endDate),

  getRange: (startDate, endDate) =>
    db.prepare('SELECT * FROM eod_logs WHERE date BETWEEN ? AND ? ORDER BY date').all(startDate, endDate),
};

module.exports = eod;
