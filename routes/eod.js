const express = require('express');
const router = express.Router();
const db = require('../db/eod');

// Specific routes first — before /:date
router.get('/recent', (req, res) => res.json(db.getRecent()));
router.get('/summary/:start/:end', (req, res) =>
  res.json(db.getSummary(req.params.start, req.params.end)));

router.get('/export', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end required' });
  const rows = db.getRange(start, end);
  const headers = ['date','covers','sales_total','cash_total','card_total','ran_out','notes','opener_name'];
  const escape = (v) => v == null ? '' : `"${String(v).replace(/"/g,'""')}"`;
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="eod-${start}-to-${end}.csv"`);
  res.send(csv);
});

router.get('/log/:date', (req, res) => res.json(db.getLog(req.params.date) || {}));
router.post('/', (req, res) => { db.upsertLog(req.body); res.json({ ok: true }); });
router.delete('/log/:date', (req, res) => { db.deleteLog(req.params.date); res.json({ ok: true }); });

module.exports = router;
