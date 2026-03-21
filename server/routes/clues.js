/**
 * Clue Routes - Admin management of clue pool
 */
const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const Clue = require('../models/Clue');
const { v4: uuidv4 } = require('uuid');

// ─── Sanitize incoming clue body ──────────────────────────────────────────────
// Ensures `variables` and `hints` are always proper arrays, never strings.
// Handles the edge case where JSON.stringify accidentally serialised the array.
function sanitizeClueBody(body) {
  const data = { ...body };

  // ── variables: must be an array of objects ──────────────────────────────────
  if (typeof data.variables === 'string') {
    try {
      data.variables = JSON.parse(data.variables);
    } catch {
      data.variables = [];
    }
  }
  if (!Array.isArray(data.variables)) {
    data.variables = [];
  }
  // Ensure each variable is a plain object with correct types
  data.variables = data.variables.map((v) => ({
    name:    String(v.name    ?? '').toUpperCase(),
    type:    String(v.type    ?? 'number'),
    min:     Number(v.min     ?? 1),
    max:     Number(v.max     ?? 10),
    options: Array.isArray(v.options) ? v.options.map(String) : [],
  }));

  // ── hints: must be an array of strings ─────────────────────────────────────
  if (typeof data.hints === 'string') {
    try {
      data.hints = JSON.parse(data.hints);
    } catch {
      data.hints = data.hints ? [data.hints] : [];
    }
  }
  if (!Array.isArray(data.hints)) {
    data.hints = [];
  }
  data.hints = data.hints.map(String).filter(Boolean);

  // ── numeric coercions ───────────────────────────────────────────────────────
  if (data.difficulty !== undefined) {
    data.difficulty = Math.min(5, Math.max(1, parseInt(data.difficulty, 10) || 1));
  }

  return data;
}

// ─── GET all clues (admin) ────────────────────────────────────────────────────
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { category, difficulty, search, includeInactive } = req.query;
    const filter = {};
    if (!includeInactive) filter.isActive = true;
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = parseInt(difficulty);
    if (search) filter.template = { $regex: search, $options: 'i' };

    const clues = await Clue.find(filter).sort({ category: 1, difficulty: 1 });
    res.json({ clues, total: clues.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET single clue ──────────────────────────────────────────────────────────
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const clue = await Clue.findById(req.params.id);
    if (!clue) return res.status(404).json({ error: 'Clue not found' });
    res.json({ clue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST create clue ─────────────────────────────────────────────────────────
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const data = sanitizeClueBody(req.body);
    const clue = await Clue.create({ ...data, clueId: uuidv4() });
    res.status(201).json({ clue });
  } catch (err) {
    console.error('Create clue error:', err.message);
    res.status(400).json({ error: `Clue validation failed: ${err.message}` });
  }
});

// ─── POST bulk import clues ───────────────────────────────────────────────────
router.post('/bulk', protect, adminOnly, async (req, res) => {
  try {
    const { clues } = req.body;
    if (!Array.isArray(clues)) {
      return res.status(400).json({ error: '"clues" must be an array' });
    }
    const withIds = clues.map((c) => ({
      ...sanitizeClueBody(c),
      clueId: c.clueId || uuidv4(),
    }));
    const result = await Clue.insertMany(withIds, { ordered: false });
    res.status(201).json({ inserted: result.length });
  } catch (err) {
    console.error('Bulk import error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─── PUT update clue ──────────────────────────────────────────────────────────
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { clueId, ...rest } = req.body; // never overwrite clueId
    const updates = sanitizeClueBody(rest);
    const clue = await Clue.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!clue) return res.status(404).json({ error: 'Clue not found' });
    res.json({ clue });
  } catch (err) {
    console.error('Update clue error:', err.message);
    res.status(400).json({ error: `Clue validation failed: ${err.message}` });
  }
});

// ─── PATCH toggle clue active ─────────────────────────────────────────────────
router.patch('/:id/toggle', protect, adminOnly, async (req, res) => {
  try {
    const clue = await Clue.findById(req.params.id);
    if (!clue) return res.status(404).json({ error: 'Clue not found' });
    clue.isActive = !clue.isActive;
    await clue.save();
    res.json({ clue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE clue ──────────────────────────────────────────────────────────────
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const clue = await Clue.findByIdAndDelete(req.params.id);
    if (!clue) return res.status(404).json({ error: 'Clue not found' });
    res.json({ message: 'Clue deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
