/**
 * Auth Routes
 * Login, register, profile
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Player = require('../models/Player');
const { protect, ADMIN_IDS } = require('../middleware/auth');

// Generate JWT token
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Helper: compute isAdmin for a player document
const computeIsAdmin = (player) =>
  ADMIN_IDS.includes(player._id.toString()) || player.role === 'admin';

// ─── Register ─────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const existing = await Player.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({
        error: existing.email === email ? 'Email already registered' : 'Username taken',
      });
    }

    const player = await Player.create({ username, email, password });
    const token = signToken(player._id);

    res.status(201).json({
      token,
      player: {
        id: player._id,
        username: player.username,
        email: player.email,
        avatar: player.avatar,
        stats: player.stats,
        role: player.role,
        isAdmin: computeIsAdmin(player),
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const player = await Player.findOne({ email }).select('+password');
    if (!player || !(await player.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update online status
    player.isOnline = true;
    player.lastSeen = new Date();
    await player.save({ validateBeforeSave: false });

    const token = signToken(player._id);

    res.json({
      token,
      player: {
        id: player._id,
        username: player.username,
        email: player.email,
        avatar: player.avatar,
        stats: player.stats,
        role: player.role,
        isAdmin: computeIsAdmin(player),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── Get current player ───────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json({
    player: {
      id: req.player._id,
      username: req.player.username,
      email: req.player.email,
      avatar: req.player.avatar,
      stats: req.player.stats,
      role: req.player.role,
      isAdmin: req.player.isAdmin,   // computed by middleware from ADMIN_IDS or role
      survivalRate: req.player.getSurvivalRate(),
    },
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────
router.post('/logout', protect, async (req, res) => {
  await Player.findByIdAndUpdate(req.player._id, {
    isOnline: false,
    lastSeen: new Date(),
  });
  res.json({ message: 'Logged out' });
});

module.exports = router;
