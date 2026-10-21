const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Match = require('../models/Match');
const { v4: uuidv4 } = require('uuid');
const GameSettings = require('../models/GameSettings');
const Player = require('../models/Player');
const { getPlayerTier, getTierSettings } = require('../utils/playerTier');

// Get a list of active lobbies (waiting matches)
router.get('/lobbies', protect, async (req, res) => {
  try {
    const lobbies = await Match.find({ status: 'waiting', isClanBattleRun: { $ne: true } })
      .populate('createdBy', 'username isVerified')
      .select('roomCode maxPlayers minPlayers players createdAt createdBy mode difficultyCurve isPasswordProtected')
      .sort({ createdAt: -1 }).limit(30);
    res.json({ lobbies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get match details by room code, excluding correctDoor from rooms
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

// Get a list of completed matches (history)
router.get('/history', protect, async (req, res) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const filter = { 'players.playerId': req.player._id, status: 'completed' };

    const [matches, total] = await Promise.all([
      Match.find(filter)
        .sort({ endedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select('roomCode players totalRooms endedAt createdAt winnersCount mode'),
      Match.countDocuments(filter),
    ]);

    res.json({
      matches,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load match history' });
  }
});

// Get daily usage stats for a player
router.get('/daily-usage', protect, async (req, res) => {
  try {
    const settings = await GameSettings.getSingleton();
    const player = await Player.findById(req.player._id);

    const tier = getPlayerTier(player);
    const tierSettings = getTierSettings(settings, tier);

    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const createdRecent = (player.roomsCreatedAt || []).filter(d => new Date(d).getTime() > cutoff);
    const joinedRecent = (player.roomsJoinedAt || []).filter(d => new Date(d).getTime() > cutoff);

    res.json({
      tier,
      create: { used: createdRecent.length, limit: tierSettings.dailyCreate },
      join: { used: joinedRecent.length, limit: tierSettings.dailyJoin },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get player's current tier and tier-specific settings
router.get('/my-tier', protect, async (req, res) => {
  try {
    const settings = await GameSettings.getSingleton();
    const player = await Player.findById(req.player._id);
    const tier = getPlayerTier(player);
    const tierSettings = getTierSettings(settings, tier);
    res.json({ tier, tierSettings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
