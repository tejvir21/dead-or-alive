/**
 * routes/settings.js — Admin settings management
 * Includes: general timers, features, curves, beta access, beta requests + notifications
 */
const express = require('express');
const router  = express.Router();
const GameSettings = require('../models/GameSettings');
const BetaRequest  = require('../models/BetaRequest');
const Player       = require('../models/Player');
const { protect, adminOnly } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');
const notify   = require('../utils/notify');
const { notifyAdmins } = require('../utils/notify');
const logger   = require('../utils/logger');

const logAction = async (req, action, target, details) => {
  try {
    await AuditLog.create({ adminId: req.player._id, adminName: req.player.username, action, target, details });
    notifyAdmins(req.app.get('io'), {
      title: 'Admin action taken',
      message: `${req.player.username} performed: ${action}${target ? ' on ' + target : ''}`,
      icon: '🛠️',
    }).catch(() => {});
  } catch (_) {}
};

// ── Get all settings ─────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  const settings = await GameSettings.getSingleton();
  res.json({ settings });
});

// ── Update general timers/limits ──────────────────────────────────────────────
router.patch('/general', protect, adminOnly, async (req, res) => {
  try {
    const allowed = [
      'puzzleTimerSeconds','doorTimerSeconds','countdownSeconds',
      'timerReductionFactor','timerReductionEnabled',
      'maxPlayersNormal','maxPlayersVerified','minPlayersToStart',
      'reconnectGraceNormal','reconnectGraceVerified',
    ];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const settings = await GameSettings.findOneAndUpdate({ _singleton: true }, updates, { new: true });
    await logAction(req, 'settings.general.update', 'GameSettings', updates);
    res.json({ settings });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Update feature flags ──────────────────────────────────────────────────────
router.patch('/features', protect, adminOnly, async (req, res) => {
  try {
    const settings = await GameSettings.getSingleton();
    Object.keys(req.body).forEach(k => { if (settings.features[k] !== undefined) settings.features[k] = req.body[k]; });
    await settings.save();
    await logAction(req, 'settings.features.update', 'GameSettings', req.body);
    res.json({ settings });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Daily limits ───────────────────────────────────────────────────────────────
router.patch('/daily-limits', protect, adminOnly, async (req, res) => {
  try {
    const { tier, create, join } = req.body;
    if (!['free','verified','pro','elite'].includes(tier)) return res.status(400).json({ error: 'Invalid tier' });
    const settings = await GameSettings.getSingleton();
    if (create !== undefined) settings.dailyLimits[tier].create = create;
    if (join   !== undefined) settings.dailyLimits[tier].join   = join;
    await settings.save();
    await logAction(req, 'settings.dailyLimits.update', tier, { create, join });
    res.json({ settings });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Auto-start timer settings ─────────────────────────────────────────────────
router.patch('/auto-start', protect, adminOnly, async (req, res) => {
  try {
    const { enabled, defaultDuration, tierLimits } = req.body;
    const settings = await GameSettings.getSingleton();
    if (enabled !== undefined) settings.autoStartTimer.enabled = enabled;
    if (defaultDuration !== undefined) settings.autoStartTimer.defaultDuration = defaultDuration;
    if (tierLimits) {
      for (const tier of ['free','verified','pro','elite']) {
        if (tierLimits[tier]) {
          if (tierLimits[tier].min !== undefined) settings.autoStartTimer.tierLimits[tier].min = tierLimits[tier].min;
          if (tierLimits[tier].max !== undefined) settings.autoStartTimer.tierLimits[tier].max = tierLimits[tier].max;
        }
      }
    }
    await settings.save();
    await logAction(req, 'settings.autoStart.update', 'GameSettings', req.body);
    res.json({ settings });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Kick system settings ──────────────────────────────────────────────────────
router.patch('/kick-system', protect, adminOnly, async (req, res) => {
  try {
    const allowed = ['enabled','minimumPlayers','thresholdPercent','voteTimeoutSeconds','creatorCanKick'];
    const settings = await GameSettings.getSingleton();
    for (const k of allowed) if (req.body[k] !== undefined) settings.kickSystem[k] = req.body[k];
    await settings.save();
    await logAction(req, 'settings.kickSystem.update', 'GameSettings', req.body);
    res.json({ settings });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Beta access settings ──────────────────────────────────────────────────────
router.patch('/beta-access', protect, adminOnly, async (req, res) => {
  try {
    const allowed = ['enabled','betaUrl','allowElite','allowPro','lockedMessage'];
    const settings = await GameSettings.getSingleton();
    for (const k of allowed) if (req.body[k] !== undefined) settings.betaAccess[k] = req.body[k];
    await settings.save();
    await logAction(req, 'settings.betaAccess.update', 'GameSettings', req.body);
    res.json({ settings });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Grant/revoke individual beta access ─────────────────────────────────────────
router.post('/beta-access/grant/:playerId', protect, adminOnly, async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.playerId, { hasBetaAccess: true }, { new: true });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    await logAction(req, 'betaAccess.grant', player.username, {});

    const settings = await GameSettings.getSingleton();
    notify(req.app.get('io'), player._id, {
      type: 'beta_approved', title: '🧪 Beta Access Granted',
      message: `You now have access to the beta version! Check your profile for the URL.`,
      icon: '🧪', meta: { betaUrl: settings.betaAccess.betaUrl }, email: true,
    }).catch(() => {});

    res.json({ message: 'Beta access granted', player: { id: player._id, username: player.username, hasBetaAccess: true } });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/beta-access/revoke/:playerId', protect, adminOnly, async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.playerId, { hasBetaAccess: false }, { new: true });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    await logAction(req, 'betaAccess.revoke', player.username, {});
    res.json({ message: 'Beta access revoked' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Difficulty curves CRUD ────────────────────────────────────────────────────
router.post('/curves', protect, adminOnly, async (req, res) => {
  try {
    const { name, label, description, levels, availableTo } = req.body;
    if (!name || !levels?.length) return res.status(400).json({ error: 'Name and levels required' });
    const settings = await GameSettings.getSingleton();
    if (settings.difficultyCurves.some(c => c.name === name)) return res.status(409).json({ error: 'Curve name already exists' });
    settings.difficultyCurves.push({ name, label: label || name, description: description || '', levels, availableTo: availableTo || 'all' });
    await settings.save();
    await logAction(req, 'settings.curve.create', name, req.body);
    res.status(201).json({ settings });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/curves/:name', protect, adminOnly, async (req, res) => {
  try {
    const settings = await GameSettings.getSingleton();
    const curve = settings.difficultyCurves.find(c => c.name === req.params.name);
    if (!curve) return res.status(404).json({ error: 'Curve not found' });
    const allowed = ['label','description','levels','availableTo','isDefault'];
    for (const k of allowed) if (req.body[k] !== undefined) curve[k] = req.body[k];
    if (req.body.isDefault === true) settings.difficultyCurves.forEach(c => { if (c.name !== req.params.name) c.isDefault = false; });
    await settings.save();
    await logAction(req, 'settings.curve.update', req.params.name, req.body);
    res.json({ settings });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/curves/:name', protect, adminOnly, async (req, res) => {
  try {
    const settings = await GameSettings.getSingleton();
    const curve = settings.difficultyCurves.find(c => c.name === req.params.name);
    if (curve?.isDefault) return res.status(400).json({ error: 'Cannot delete the default curve' });
    settings.difficultyCurves = settings.difficultyCurves.filter(c => c.name !== req.params.name);
    await settings.save();
    await logAction(req, 'settings.curve.delete', req.params.name, {});
    res.json({ settings });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Subscription plans ────────────────────────────────────────────────────────
router.patch('/plans/:name', protect, adminOnly, async (req, res) => {
  try {
    const settings = await GameSettings.getSingleton();
    const plan = settings.subscriptionPlans.find(p => p.name === req.params.name);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    const allowed = ['label','price','currency','durationDays','maxPlayersBonus','features'];
    for (const k of allowed) if (req.body[k] !== undefined) plan[k] = req.body[k];
    await settings.save();
    await logAction(req, 'settings.plan.update', req.params.name, req.body);
    res.json({ settings });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// BETA REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

router.post('/beta-requests', protect, async (req, res) => {
  try {
    const existing = await BetaRequest.findOne({ playerId: req.player._id, status: 'pending' });
    if (existing) return res.status(409).json({ error: 'You already have a pending beta request' });
    if (req.player.hasBetaAccess) return res.status(400).json({ error: 'You already have beta access' });

    const request = await BetaRequest.create({
      playerId: req.player._id, username: req.player.username, email: req.player.email,
      plan: req.player.subscription?.plan || 'free', message: req.body.message || '',
    });

    notifyAdmins(req.app.get('io'), {
      title: 'New beta access request',
      message: `${req.player.username} (${req.player.subscription?.plan || 'free'}) requested beta access`,
      icon: '🧪',
    }).catch(() => {});

    res.status(201).json({ message: 'Beta access request submitted', request });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/beta-requests/mine', protect, async (req, res) => {
  const requests = await BetaRequest.find({ playerId: req.player._id }).sort({ createdAt: -1 });
  res.json({ requests });
});

router.get('/beta-requests', protect, adminOnly, async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const filter = status ? { status } : {};
  const [requests, total] = await Promise.all([
    BetaRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
    BetaRequest.countDocuments(filter),
  ]);
  res.json({ requests, total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

router.post('/beta-requests/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const request = await BetaRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    request.status = 'approved';
    request.adminNote = req.body.note || '';
    request.resolvedBy = req.player._id;
    request.resolvedAt = new Date();
    await request.save();
    await Player.findByIdAndUpdate(request.playerId, { hasBetaAccess: true });
    await logAction(req, 'betaRequest.approve', request.username, {});

    const settings = await GameSettings.getSingleton();
    notify(req.app.get('io'), request.playerId, {
      type: 'beta_approved', title: '🧪 Beta Access Approved!',
      message: `Your beta access request was approved! Check your profile for the beta URL.`,
      icon: '🧪', meta: { betaUrl: settings.betaAccess.betaUrl }, email: true,
    }).catch(() => {});

    res.json({ message: 'Beta access granted', request });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/beta-requests/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    const request = await BetaRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    request.status = 'rejected';
    request.adminNote = req.body.note || '';
    request.resolvedBy = req.player._id;
    request.resolvedAt = new Date();
    await request.save();
    await logAction(req, 'betaRequest.reject', request.username, { note: req.body.note });

    notify(req.app.get('io'), request.playerId, {
      type: 'beta_rejected', title: 'Beta Access Request Declined',
      message: req.body.note ? `Your beta request was declined: ${req.body.note}` : 'Your beta access request was declined.',
      icon: '❌',
    }).catch(() => {});

    res.json({ message: 'Request rejected', request });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
