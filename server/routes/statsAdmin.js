const express = require('express');
const statsRouter = express.Router();
const adminRouter = express.Router();
const { protect, adminOnly, audit } = require('../middleware/auth');
const Player = require('../models/Player');
const Match = require('../models/Match');
const Clue = require('../models/Clue');
const AuditLog = require('../models/AuditLog');
const GameSettings = require('../models/GameSettings');
const logger = require('../utils/logger');

// ════════════════════════════════════════
// STATS ROUTES
// ════════════════════════════════════════
statsRouter.get('/leaderboard', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const players = await Player.find({ 'stats.gamesPlayed': { $gt: 0 }, isBanned: { $ne: true } })
      .select('username avatar stats isVerified subscription')
      .sort({ 'stats.wins': -1, 'stats.totalRoomsSurvived': -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const leaderboard = players.map((p, i) => ({
      rank: (parseInt(page) - 1) * parseInt(limit) + i + 1,
      username: p.username, avatar: p.avatar,
      wins: p.stats.wins, gamesPlayed: p.stats.gamesPlayed,
      survivalRate: p.getSurvivalRate(),
      totalRoomsSurvived: p.stats.totalRoomsSurvived,
      isVerified: p.isVerified,
      isSubscribed: p.isSubscribed?.(),
    }));

    const total = await Player.countDocuments({ 'stats.gamesPlayed': { $gt: 0 } });
    res.json({ leaderboard, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

statsRouter.get('/me', protect, async (req, res) => {
  const p = await Player.findById(req.player._id);
  res.json({ stats: { ...p.stats, survivalRate: p.getSurvivalRate(), gamesPlayed: p.stats.gamesPlayed } });
});

// ════════════════════════════════════════
// ADMIN ROUTES
// ════════════════════════════════════════

// Dashboard stats
adminRouter.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const [
      totalPlayers, activePlayers, totalMatches, activeMatches,
      totalClues, activeClues, bannedPlayers, verifiedPlayers,
    ] = await Promise.all([
      Player.countDocuments(),
      Player.countDocuments({ isOnline: true }),
      Match.countDocuments(),
      Match.countDocuments({ status: 'in_progress' }),
      Clue.countDocuments(),
      Clue.countDocuments({ isActive: true }),
      Player.countDocuments({ isBanned: true }),
      Player.countDocuments({ isVerified: true }),
    ]);

    // DAU (players active in last 24h)
    const dau = await Player.countDocuments({ lastSeen: { $gte: new Date(Date.now() - 86400000) } });

    res.json({ totalPlayers, activePlayers, totalMatches, activeMatches, totalClues, activeClues, bannedPlayers, verifiedPlayers, dau });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List players
adminRouter.get('/players', protect, adminOnly, async (req, res) => {
  try {
    const { search, page = 1, limit = 50, filter } = req.query;
    const query = {};
    if (search) query.$or = [{ username: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
    if (filter === 'banned')   query.isBanned   = true;
    if (filter === 'verified') query.isVerified = true;
    if (filter === 'online')   query.isOnline   = true;

    const [players, total] = await Promise.all([
      Player.find(query)
        .select('username email phone isVerified isEmailVerified isPhoneVerified isBanned banReason banUntil role subscription stats isOnline lastSeen createdAt')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      Player.countDocuments(query),
    ]);
    res.json({ players, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single player
adminRouter.get('/players/:id', protect, adminOnly, async (req, res) => {
  const player = await Player.findById(req.params.id).select('-password -otp -refreshTokens');
  if (!player) return res.status(404).json({ error: 'Player not found' });
  res.json({ player });
});

// Update player
adminRouter.patch('/players/:id', protect, adminOnly, async (req, res) => {
  try {
    const allowed = ['isVerified','role','subscription','preferences','displayName'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    const player = await Player.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    await audit(req.player._id, req.player.username, 'UPDATE_PLAYER', `player:${req.params.id}`, updates, req);
    res.json({ player });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Ban player
adminRouter.post('/players/:id/ban', protect, adminOnly, async (req, res) => {
  try {
    const { reason, durationDays } = req.body;
    if (!reason) return res.status(400).json({ error: 'Ban reason required' });

    const banUntil = durationDays ? new Date(Date.now() + durationDays * 86400000) : null;
    const player = await Player.findByIdAndUpdate(req.params.id, {
      isBanned: true, banReason: reason, banUntil,
    }, { new: true });

    if (!player) return res.status(404).json({ error: 'Player not found' });
    await audit(req.player._id, req.player.username, 'BAN_PLAYER', `player:${req.params.id}`, { reason, durationDays }, req);
    res.json({ message: 'Player banned', player });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unban player
adminRouter.post('/players/:id/unban', protect, adminOnly, async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id,
      { isBanned: false, banReason: null, banUntil: null }, { new: true });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    await audit(req.player._id, req.player.username, 'UNBAN_PLAYER', `player:${req.params.id}`, {}, req);
    res.json({ message: 'Player unbanned', player });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gift subscription
adminRouter.post('/players/:id/subscription', protect, adminOnly, async (req, res) => {
  try {
    const { plan, durationDays } = req.body;
    if (!plan || !durationDays) return res.status(400).json({ error: 'plan and durationDays required' });

    const endDate = new Date(Date.now() + durationDays * 86400000);
    const player = await Player.findByIdAndUpdate(req.params.id, {
      subscription: { plan, status: 'gifted', startDate: new Date(), endDate },
    }, { new: true });

    if (!player) return res.status(404).json({ error: 'Player not found' });
    await audit(req.player._id, req.player.username, 'GIFT_SUBSCRIPTION', `player:${req.params.id}`, { plan, durationDays }, req);
    res.json({ message: 'Subscription gifted', player });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Audit logs
adminRouter.get('/audit-logs', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 50, action } = req.query;
    const filter = {};
    if (action) filter.action = action;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).populate('adminId', 'username').sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit)).limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Matches list
adminRouter.get('/matches', protect, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const [matches, total] = await Promise.all([
      Match.find(filter).populate('createdBy', 'username').sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit)).limit(parseInt(limit)),
      Match.countDocuments(filter),
    ]);
    res.json({ matches, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete match
adminRouter.delete('/matches/:id', protect, adminOnly, async (req, res) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    await audit(req.player._id, req.player.username, 'DELETE_MATCH', `match:${req.params.id}`, {}, req);
    res.json({ message: 'Match deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { statsRouter, adminRouter };
