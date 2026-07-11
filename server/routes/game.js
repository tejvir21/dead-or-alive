const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Match = require('../models/Match');
const { v4: uuidv4 } = require('uuid');

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

module.exports = router;
