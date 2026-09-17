const express = require('express');
const statsRouter = express.Router();
const router = express.Router();
const { protect, adminOnly, audit } = require('../middleware/auth');
const Player = require('../models/Player');
const Match = require('../models/Match');
const Clue = require('../models/Clue');
const AuditLog = require('../models/AuditLog');
const GameSettings = require('../models/GameSettings');
const logger = require('../utils/logger');
const notify = require("../utils/notify");
const { notifyAdmins } = require("../utils/notify");

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

module.exports = { statsRouter };
