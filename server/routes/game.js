/**
 * Game Routes
 * Lobby creation, join, match history
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Match = require('../models/Match');
const { v4: uuidv4 } = require('uuid');

// ─── Create a lobby ───────────────────────────────────────────────────────────
router.post('/create', protect, async (req, res) => {
  try {
    const { maxPlayers = 8, minPlayers = 3 } = req.body;

    // Generate unique 6-char room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const match = await Match.create({
      matchId: uuidv4(),
      roomCode,
      maxPlayers: Math.min(8, Math.max(3, maxPlayers)),
      minPlayers: Math.min(maxPlayers, Math.max(3, minPlayers)),
      createdBy: req.player._id,
      players: [
        {
          playerId: req.player._id,
          username: req.player.username,
          joinedAt: new Date(),
        },
      ],
      status: 'waiting',
    });

    res.status(201).json({ match, roomCode });
  } catch (err) {
    console.error('Create game error:', err);
    res.status(500).json({ error: 'Could not create game' });
  }
});

// ─── Get open lobbies ─────────────────────────────────────────────────────────
router.get('/lobbies', protect, async (req, res) => {
  try {
    const lobbies = await Match.find({ status: 'waiting' })
      .populate('createdBy', 'username')
      .select('roomCode maxPlayers minPlayers players createdAt createdBy')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ lobbies });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch lobbies' });
  }
});

// ─── Get match by room code ───────────────────────────────────────────────────
router.get('/room/:roomCode', protect, async (req, res) => {
  try {
    const match = await Match.findOne({ roomCode: req.params.roomCode.toUpperCase() })
      .populate('createdBy', 'username');

    if (!match) return res.status(404).json({ error: 'Room not found' });

    // Sanitize: don't send correctDoor to clients
    const safeRooms = match.rooms.map(({ correctDoor, answerRule, clueSeed, ...rest }) => rest);

    res.json({ match: { ...match.toObject(), rooms: safeRooms } });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch room' });
  }
});

// ─── Get match history for player ────────────────────────────────────────────
router.get('/history', protect, async (req, res) => {
  try {
    const matches = await Match.find({
      'players.playerId': req.player._id,
      status: 'completed',
    })
      .select('roomCode players rooms totalRooms startedAt endedAt winnersCount')
      .sort({ endedAt: -1 })
      .limit(10);

    res.json({ matches });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch history' });
  }
});

module.exports = router;
