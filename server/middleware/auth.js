/**
 * Auth Middleware — Phase 1
 * JWT access + refresh tokens, admin ADMIN_IDS env check, ban check
 */
const jwt = require('jsonwebtoken');
const Player = require('../models/Player');
const AuditLog = require('../models/AuditLog');

const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// ── Verify access token ───────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer '))
      token = req.headers.authorization.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const player = await Player.findById(decoded.id).select('-password -otp');
    if (!player) return res.status(401).json({ error: 'Player not found' });

    // Ban check
    if (player.isBanned) {
      const stillBanned = !player.banUntil || player.banUntil > new Date();
      if (stillBanned) return res.status(403).json({ error: 'Account banned', reason: player.banReason });
      // Ban expired — lift it
      await Player.findByIdAndUpdate(player._id, { isBanned: false });
    }

    player.isAdmin = ADMIN_IDS.includes(player._id.toString()) || player.role === 'admin';
    req.player = player;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ── Admin only ────────────────────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (!req.player?.isAdmin)
    return res.status(403).json({ error: 'Admin access required' });
  next();
};

// ── Subscribed only ───────────────────────────────────────────────────────────
const subscribedOnly = (req, res, next) => {
  if (!req.player?.isSubscribed())
    return res.status(403).json({ error: 'Active subscription required' });
  next();
};

// ── Verified only ─────────────────────────────────────────────────────────────
const verifiedOnly = (req, res, next) => {
  if (!req.player?.isVerified && !req.player?.isSubscribed())
    return res.status(403).json({ error: 'Verified account required' });
  next();
};

// ── Audit log helper ──────────────────────────────────────────────────────────
const audit = async (adminId, adminName, action, target, details, req) => {
  try {
    await AuditLog.create({
      adminId, adminName, action, target, details,
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  } catch (_) { }
};

module.exports = { protect, adminOnly, subscribedOnly, verifiedOnly, audit, ADMIN_IDS };
