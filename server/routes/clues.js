/**
 * Clues Routes — Phase 1
 * Full CRUD + bulk import with deduplication
 */
const express = require('express');
const router = express.Router();
const { protect, adminOnly, audit } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const Clue = require('../models/Clue');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

function sanitizeClue(body) {
  const d = { ...body };

  if (typeof d.variables === 'string') {
    try { d.variables = JSON.parse(d.variables); } catch { d.variables = []; }
  }
  if (!Array.isArray(d.variables)) d.variables = [];
  d.variables = d.variables.map(v => ({
    name:    String(v.name || '').toUpperCase(),
    type:    String(v.type || 'number'),
    min:     Number(v.min ?? 1),
    max:     Number(v.max ?? 10),
    options: Array.isArray(v.options) ? v.options.map(String) : [],
  }));

  if (typeof d.hints === 'string') {
    try { d.hints = JSON.parse(d.hints); } catch { d.hints = []; }
  }
  if (!Array.isArray(d.hints)) d.hints = [];
  d.hints = d.hints.map(String).filter(Boolean).slice(0, 2);

  if (typeof d.tags === 'string') {
    try { d.tags = JSON.parse(d.tags); } catch { d.tags = []; }
  }
  if (!Array.isArray(d.tags)) d.tags = [];

  if (d.difficulty !== undefined) {
    d.difficulty = Math.min(10, Math.max(1, parseInt(d.difficulty, 10) || 1));
  }
  return d;
}

// ── GET all clues ─────────────────────────────────────────────────────────────
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { category, difficulty, search, includeInactive, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (!includeInactive) filter.isActive = true;
    if (category)   filter.category   = category;
    if (difficulty) filter.difficulty = parseInt(difficulty);
    if (search)     filter.template   = { $regex: search, $options: 'i' };

    const [clues, total] = await Promise.all([
      Clue.find(filter).sort({ category: 1, difficulty: 1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      Clue.countDocuments(filter),
    ]);

    res.json({ clues, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET category stats ────────────────────────────────────────────────────────
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const stats = await Clue.aggregate([
      { $group: { _id: { category: '$category', difficulty: '$difficulty', isActive: '$isActive' }, count: { $sum: 1 } } },
      { $sort: { '_id.category': 1, '_id.difficulty': 1 } },
    ]);
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET single clue ───────────────────────────────────────────────────────────
router.get('/:id', protect, adminOnly, async (req, res) => {
  const clue = await Clue.findById(req.params.id);
  if (!clue) return res.status(404).json({ error: 'Clue not found' });
  res.json({ clue });
});

// ── POST create clue ──────────────────────────────────────────────────────────
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const data = sanitizeClue(req.body);

    // Check duplicate template
    const existing = await Clue.findOne({ template: data.template });
    if (existing) return res.status(409).json({ error: 'Duplicate template — this clue already exists', existingId: existing._id });

    const clue = await Clue.create({ ...data, clueId: uuidv4(), createdBy: req.player.username });
    await audit(req.player._id, req.player.username, 'CREATE_CLUE', `clue:${clue._id}`, { template: clue.template }, req);
    res.status(201).json({ clue });
  } catch (err) {
    logger.error('Create clue error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── POST bulk import with deduplication ───────────────────────────────────────
router.post('/bulk', protect, adminOnly, async (req, res) => {
  try {
    const { clues } = req.body;
    if (!Array.isArray(clues) || clues.length === 0)
      return res.status(400).json({ error: '"clues" must be a non-empty array' });

    const sanitized = clues.map(c => ({ ...sanitizeClue(c), clueId: c.clueId || uuidv4(), createdBy: req.player.username }));

    // Find which templates already exist
    const templates = sanitized.map(c => c.template);
    const existing  = await Clue.find({ template: { $in: templates } }).select('template');
    const existingTemplates = new Set(existing.map(c => c.template));

    const toInsert  = sanitized.filter(c => !existingTemplates.has(c.template));
    const skipped   = sanitized.filter(c =>  existingTemplates.has(c.template));

    let inserted = 0;
    if (toInsert.length > 0) {
      const result = await Clue.insertMany(toInsert, { ordered: false });
      inserted = result.length;
    }

    await audit(req.player._id, req.player.username, 'BULK_IMPORT_CLUES', 'clues', {
      attempted: sanitized.length, inserted, skipped: skipped.length,
    }, req);

    res.status(201).json({
      inserted, skipped: skipped.length,
      skippedTemplates: skipped.map(c => c.template.slice(0, 60)),
      message: `${inserted} clues added, ${skipped.length} duplicates skipped`,
    });
  } catch (err) {
    logger.error('Bulk import error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── PUT update clue ───────────────────────────────────────────────────────────
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { clueId, ...rest } = req.body;
    const updates = sanitizeClue(rest);

    // Check duplicate template (excluding self)
    if (updates.template) {
      const dup = await Clue.findOne({ template: updates.template, _id: { $ne: req.params.id } });
      if (dup) return res.status(409).json({ error: 'Duplicate template', existingId: dup._id });
    }

    const clue = await Clue.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!clue) return res.status(404).json({ error: 'Clue not found' });
    await audit(req.player._id, req.player.username, 'UPDATE_CLUE', `clue:${clue._id}`, updates, req);
    res.json({ clue });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── PATCH toggle active ───────────────────────────────────────────────────────
router.patch('/:id/toggle', protect, adminOnly, async (req, res) => {
  try {
    const clue = await Clue.findById(req.params.id);
    if (!clue) return res.status(404).json({ error: 'Clue not found' });
    clue.isActive = !clue.isActive;
    await clue.save();
    await audit(req.player._id, req.player.username, 'TOGGLE_CLUE', `clue:${clue._id}`, { isActive: clue.isActive }, req);
    res.json({ clue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE clue ───────────────────────────────────────────────────────────────
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const clue = await Clue.findByIdAndDelete(req.params.id);
    if (!clue) return res.status(404).json({ error: 'Clue not found' });
    await audit(req.player._id, req.player.username, 'DELETE_CLUE', `clue:${clue._id}`, { template: clue.template }, req);
    res.json({ message: 'Clue deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
