const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Match = require('../models/Match');
const { v4: uuidv4 } = require('uuid');
const GameSettings = require('../models/GameSettings');
const Player = require('../models/Player');

router.get('/lobbies', protect, async (req, res) => {
  try {
    const lobbies = await Match.find({ status: 'waiting' })
      .populate('createdBy', 'username isVerified')
      .select('roomCode maxPlayers minPlayers players createdAt createdBy mode difficultyCurve isPasswordProtected')
      .sort({ createdAt: -1 }).limit(30);
    res.json({ lobbies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/room/:roomCode', protect, async (req, res) => {
  try {
    const match = await Match.findOne({ roomCode: req.params.roomCode.toUpperCase() })
      .populate('createdBy', 'username');
    if (!match) return res.status(404).json({ error: 'Room not found' });
    const safeRooms = match.rooms.map(({ correctDoor, ...rest }) => rest);
    res.json({ match: { ...match.toObject(), rooms: safeRooms } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', protect, async (req, res) => {
  try {
    const matches = await Match.find({ 'players.playerId': req.player._id, status: 'completed' })
      .select('roomCode players rooms totalRooms startedAt endedAt winnersCount mode')
      .sort({ endedAt: -1 }).limit(20);
    res.json({ matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/daily-usage', protect, async (req, res) => {
  try {
    const settings = await GameSettings.getSingleton();
    const player = await Player.findById(req.player._id);

    const plan = player.subscription?.plan;
    const tier = plan === 'elite' ? 'elite' : plan === 'pro' ? 'pro' : player.isVerified ? 'verified' : 'free';
    const limits = settings.dailyLimits?.[tier] || { create: 3, join: 10 };

    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const createdRecent = (player.roomsCreatedAt || []).filter(d => new Date(d).getTime() > cutoff);
    const joinedRecent = (player.roomsJoinedAt || []).filter(d => new Date(d).getTime() > cutoff);

    res.json({
      tier,
      create: { used: createdRecent.length, limit: limits.create ?? 3 },
      join: { used: joinedRecent.length, limit: limits.join ?? 10 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
