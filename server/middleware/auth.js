/**
 * Auth Middleware
 * Verifies JWT tokens for protected routes
 *
 * Admin check priority:
 *  1. Player's _id is in the ADMIN_IDS env variable (comma-separated list)
 *  2. Player's role field in DB is 'admin'
 * Either condition grants admin access — env list takes precedence so you
 * never need a DB migration to bootstrap the first admin.
 */

const jwt = require('jsonwebtoken');
const Player = require('../models/Player');

// Parse admin IDs from env once at startup
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.player = await Player.findById(decoded.id).select('-password');

    if (!req.player) {
      return res.status(401).json({ error: 'Player not found' });
    }

    // Attach isAdmin flag for convenience in route handlers
    req.player.isAdmin =
      ADMIN_IDS.includes(req.player._id.toString()) ||
      req.player.role === 'admin';

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalid or expired' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.player?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { protect, adminOnly, ADMIN_IDS };
