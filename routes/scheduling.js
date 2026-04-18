const express = require('express');
const router = express.Router();
const db = require('../db/scheduling');

router.get('/staff', (req, res) => res.json(db.getAllStaff()));
router.post('/staff', (req, res) => res.json(db.addStaff(req.body)));
router.put('/staff/:id', (req, res) => { db.updateStaff(req.params.id, req.body); res.json({ ok: true }); });
router.delete('/staff/:id', (req, res) => res.json(db.deactivateStaff(req.params.id)));

router.get('/week', (req, res) => {
  const { start, end } = req.query;
  res.json(db.getWeek(start, end));
});
router.post('/slots', (req, res) => res.json(db.addSlot(req.body)));
router.put('/slots/:id', (req, res) => { db.updateSlot(req.params.id, req.body); res.json({ ok: true }); });
router.delete('/slots/:id', (req, res) => res.json(db.deleteSlot(req.params.id)));

router.get('/labor', (req, res) => {
  const { start, end } = req.query;
  const labor = db.getLaborHours(start, end);
  const actual = db.getActualHours(start, end);
  const actualMap = {};
  actual.forEach(a => { actualMap[a.id] = a.actual_hours; });
  labor.forEach(l => { l.actual_hours = actualMap[l.id] || null; });
  res.json(labor);
});

router.get('/clock', (req, res) => res.json(db.getClockEntries(req.query.date)));
router.post('/clock/in', (req, res) => { db.clockIn(req.body); res.json({ ok: true }); });
router.post('/clock/out', (req, res) => {
  const { id, clocked_out } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Clock entry id is required' });
  }
  db.clockOut(id, clocked_out);
  res.json({ ok: true });
});
router.patch('/clock/:id/out', (req, res) => { db.clockOut(req.params.id, req.body.clocked_out); res.json({ ok: true }); });
router.delete('/clock/:id', (req, res) => { db.deleteClockEntry(req.params.id); res.json({ ok: true }); });

module.exports = router;
