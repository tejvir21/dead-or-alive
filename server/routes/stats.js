/**
 * Stats Routes
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Player = require('../models/Player');
const Match = require('../models/Match');

// ─── Leaderboard ──────────────────────────────────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  try {
    const players = await Player.find({ 'stats.gamesPlayed': { $gt: 0 } })
      .select('username avatar stats gamesPlayed')
      .sort({ 'stats.wins': -1, 'stats.totalRoomsSurvived': -1 })
      .limit(50);

    const leaderboard = players.map((p, i) => ({
      rank: i + 1,
      username: p.username,
      avatar: p.avatar,
      wins: p.stats.wins,
      gamesPlayed: p.stats.gamesPlayed,
      survivalRate: p.getSurvivalRate(),
      totalRoomsSurvived: p.stats.totalRoomsSurvived,
    }));

    res.json({ leaderboard });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch leaderboard' });
  }
});

// ─── My stats ─────────────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  const player = await Player.findById(req.player._id);
  res.json({
    stats: {
      ...player.stats,
      survivalRate: player.getSurvivalRate(),
      gamesPlayed: player.stats.gamesPlayed,
    },
  });
});

module.exports = router;
