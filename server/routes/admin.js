const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const Player = require('../models/Player');
const Match = require('../models/Match');
const Clue = require('../models/Clue');

router.get('/stats', protect, adminOnly, async (req, res) => {
  const [players, matches, clues] = await Promise.all([
    Player.countDocuments(),
    Match.countDocuments(),
    Clue.countDocuments({ isActive: true }),
  ]);
  res.json({ players, matches, clues });
});

module.exports = router;
