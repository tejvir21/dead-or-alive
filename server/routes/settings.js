/**
 * Settings Routes — Phase 1
 * Admin management of all game settings
 */
const express = require('express');
const router = express.Router();
const { protect, adminOnly, audit } = require('../middleware/auth');
const GameSettings = require('../models/GameSettings');

// ── GET settings ──────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  const settings = await GameSettings.getSingleton();
  // Non-admins get limited view
  if (!req.player?.isAdmin) {
    return res.json({
      maxPlayersNormal:   settings.maxPlayersNormal,
      maxPlayersVerified: settings.maxPlayersVerified,
      minPlayersToStart:  settings.minPlayersToStart,
      puzzleTimerSeconds: settings.puzzleTimerSeconds,
      doorTimerSeconds:   settings.doorTimerSeconds,
      features:           settings.features,
      difficultyCurves:   settings.difficultyCurves.filter(c =>
        c.availableTo === 'all' || (req.player?.isVerified && c.availableTo === 'verified')
      ),
      subscriptionPlans: settings.subscriptionPlans.filter(p => p.isActive),
    });
  }
  res.json({ settings });
});

// ── UPDATE general settings ───────────────────────────────────────────────────
router.patch('/general', protect, adminOnly, async (req, res) => {
  try {
    const allowed = [
      'maxPlayersNormal','maxPlayersVerified','minPlayersToStart',
      'puzzleTimerSeconds','doorTimerSeconds','countdownSeconds',
      'reconnectGraceNormal','reconnectGraceVerified',
      'timerReductionEnabled','timerReductionFactor',
      'maxClanSize','clanMatchMinMembers',
    ];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    const settings = await GameSettings.findOneAndUpdate(
      { _singleton: true }, updates, { new: true, upsert: true }
    );
    await audit(req.player._id, req.player.username, 'UPDATE_SETTINGS', 'settings:general', updates, req);
    res.json({ settings });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── UPDATE features ───────────────────────────────────────────────────────────
router.patch('/features', protect, adminOnly, async (req, res) => {
  try {
    const updates = {};
    for (const [k, v] of Object.entries(req.body)) {
      updates[`features.${k}`] = Boolean(v);
    }
    const settings = await GameSettings.findOneAndUpdate(
      { _singleton: true }, { $set: updates }, { new: true }
    );
    await audit(req.player._id, req.player.username, 'UPDATE_FEATURES', 'settings:features', req.body, req);
    res.json({ features: settings.features });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── ADD difficulty curve ──────────────────────────────────────────────────────
router.post('/curves', protect, adminOnly, async (req, res) => {
  try {
    const { name, label, description, levels, availableTo } = req.body;
    if (!name || !Array.isArray(levels) || levels.length === 0)
      return res.status(400).json({ error: 'name and levels[] required' });

    const settings = await GameSettings.getSingleton();
    const exists = settings.difficultyCurves.find(c => c.name === name);
    if (exists) return res.status(409).json({ error: 'Curve name already exists' });

    settings.difficultyCurves.push({ name, label, description, levels, availableTo: availableTo || 'admin' });
    await settings.save();
    await audit(req.player._id, req.player.username, 'ADD_CURVE', `curve:${name}`, { levels }, req);
    res.status(201).json({ curves: settings.difficultyCurves });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── UPDATE difficulty curve ───────────────────────────────────────────────────
router.patch('/curves/:name', protect, adminOnly, async (req, res) => {
  try {
    const settings = await GameSettings.getSingleton();
    const curve = settings.difficultyCurves.find(c => c.name === req.params.name);
    if (!curve) return res.status(404).json({ error: 'Curve not found' });

    const { label, description, levels, availableTo, isDefault } = req.body;
    if (label)       curve.label       = label;
    if (description) curve.description = description;
    if (levels)      curve.levels      = levels;
    if (availableTo) curve.availableTo = availableTo;
    if (isDefault !== undefined) {
      // Only one default at a time
      settings.difficultyCurves.forEach(c => { c.isDefault = false; });
      curve.isDefault = Boolean(isDefault);
    }

    await settings.save();
    await audit(req.player._id, req.player.username, 'UPDATE_CURVE', `curve:${req.params.name}`, req.body, req);
    res.json({ curves: settings.difficultyCurves });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── UPDATE subscription plans ─────────────────────────────────────────────────
router.patch('/plans', protect, adminOnly, async (req, res) => {
  try {
    const { plans } = req.body;
    if (!Array.isArray(plans)) return res.status(400).json({ error: 'plans must be an array' });

    const settings = await GameSettings.findOneAndUpdate(
      { _singleton: true }, { subscriptionPlans: plans }, { new: true }
    );
    await audit(req.player._id, req.player.username, 'UPDATE_PLANS', 'settings:plans', { count: plans.length }, req);
    res.json({ plans: settings.subscriptionPlans });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── UPDATE rooms per player count ─────────────────────────────────────────────
router.patch('/rooms-per-count', protect, adminOnly, async (req, res) => {
  try {
    const { map } = req.body; // { "1": 5, "2": 5, ... }
    if (typeof map !== 'object') return res.status(400).json({ error: 'map object required' });

    const settings = await GameSettings.getSingleton();
    for (const [k, v] of Object.entries(map)) {
      settings.roomsPerPlayerCount.set(k, parseInt(v));
    }
    await settings.save();
    await audit(req.player._id, req.player.username, 'UPDATE_ROOMS_PER_COUNT', 'settings', map, req);
    res.json({ roomsPerPlayerCount: Object.fromEntries(settings.roomsPerPlayerCount) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
