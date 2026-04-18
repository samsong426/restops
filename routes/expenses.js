const express = require('express');
const router = express.Router();
const db = require('../db/expenses');

router.get('/day/:date', (req, res) => res.json(db.getDaySummary(req.params.date)));
router.get('/:date', (req, res) => res.json(db.getByDate(req.params.date)));
router.post('/', (req, res) => { db.add(req.body); res.json({ ok: true }); });
router.delete('/:id', (req, res) => { db.delete(req.params.id); res.json({ ok: true }); });

module.exports = router;
