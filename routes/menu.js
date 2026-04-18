const express = require('express');
const router = express.Router();
const db = require('../db/menu');

router.get('/items', (req, res) => res.json(db.getMenuItems()));
router.post('/items', (req, res) => { db.addMenuItem(req.body); res.json({ ok: true }); });
router.put('/items/:id', (req, res) => { db.updateMenuItem(req.params.id, req.body); res.json({ ok: true }); });
router.delete('/items/:id', (req, res) => { db.deactivateMenuItem(req.params.id); res.json({ ok: true }); });

router.get('/recipes', (req, res) => res.json(db.getRecipes()));
router.post('/recipes', (req, res) => { db.upsertRecipeItem(req.body); res.json({ ok: true }); });
router.delete('/recipes/:menuId/:invId', (req, res) => {
  db.removeRecipeItem(req.params.menuId, req.params.invId);
  res.json({ ok: true });
});

router.get('/revenue', (req, res) => res.json(db.getRevenueBetween(req.query.start, req.query.end)));
router.get('/costs', (req, res) => res.json(db.getDishCosts()));
router.get('/sales', (req, res) => res.json(db.getAllSales()));
router.patch('/sales/:id', (req, res) => { db.updateSale(req.params.id, req.body.qty_sold); res.json({ ok: true }); });
router.delete('/sales/:id', (req, res) => { db.deleteSale(req.params.id); res.json({ ok: true }); });
router.get('/sales/:date', (req, res) => res.json(db.getDishSales(req.params.date)));
router.post('/sales', (req, res) => {
  const { date, sales } = req.body;
  db.saveDishSales(date, sales);
  res.json({ ok: true });
});

module.exports = router;
