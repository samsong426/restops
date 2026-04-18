const express = require('express');
const router = express.Router();
const db = require('../db/inventory');

router.get('/items', (req, res) => res.json(db.getAllItems()));
router.post('/items', (req, res) => res.json(db.addItem(req.body)));
router.patch('/items/:id/par', (req, res) => res.json(db.updatePar(req.params.id, req.body.par_level)));
router.delete('/items/:id', (req, res) => res.json(db.deactivateItem(req.params.id)));

router.get('/counts', (req, res) => res.json(db.getLatestCounts()));
router.post('/counts', (req, res) => { db.submitCount(req.body); res.json({ ok: true }); });

router.get('/order-list', (req, res) => res.json(db.getBelowPar()));
router.get('/waste-risk', (req, res) => res.json(db.getWasteRisk()));
router.get('/history/:item_id', (req, res) => res.json(db.getHistory(req.params.item_id)));
router.put('/items/:id', (req, res) => { db.updateItem(req.params.id, req.body); res.json({ ok: true }); });

router.get('/batches', (req, res) => res.json(db.getAllBatches()));
router.get('/batches/:item_id', (req, res) => res.json(db.getBatchesForItem(req.params.item_id)));
router.post('/batches', (req, res) => { db.addBatch(req.body); res.json({ ok: true }); });
router.patch('/batches/:id', (req, res) => { db.updateBatch(req.params.id, req.body); res.json({ ok: true }); });
router.delete('/batches/:id', (req, res) => { db.deleteBatch(req.params.id); res.json({ ok: true }); });

module.exports = router;
