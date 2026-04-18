const express = require('express');
const router = express.Router();
const db = require('../db/eod');

// Specific routes first — before /:date
router.get('/recent', (req, res) => res.json(db.getRecent()));
router.get('/summary/:start/:end', (req, res) =>
  res.json(db.getSummary(req.params.start, req.params.end)));

router.get('/log/:date', (req, res) => res.json(db.getLog(req.params.date) || {}));
router.post('/', (req, res) => { db.upsertLog(req.body); res.json({ ok: true }); });
router.delete('/log/:date', (req, res) => { db.deleteLog(req.params.date); res.json({ ok: true }); });

module.exports = router;
