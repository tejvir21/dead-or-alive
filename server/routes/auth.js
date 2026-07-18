/**
 * Auth Routes — Updated to use real mailer.js
 * Replace server/routes/auth.js with this file
 * Also run: npm install nodemailer (in server directory)
 */
require('dotenv').config();
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Player = require('../models/Player');
const { protect } = require('../middleware/auth');
const { authLimiter, otpLimiter, validate, registerRules, loginRules } = require('../middleware/security');
const { ADMIN_IDS } = require('../middleware/auth');
const { sendEmailOTP, sendWhatsAppOTP, sendSMSOTP } = require('../mailer');
const logger = require('../utils/logger');
const notify = require('../utils/notify');

const signAccess = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
const signRefresh = id => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
const computeIsAdmin = p => ADMIN_IDS.includes(p._id.toString()) || p.role === 'admin';

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function safePlayer(p) {
  return {
    id: p._id, username: p.username, email: p.email,
    displayName: p.displayName, phone: p.phone, country: p.country,
    dateOfBirth: p.dateOfBirth, gender: p.gender, avatar: p.avatar, bio: p.bio,
    isEmailVerified: p.isEmailVerified, isPhoneVerified: p.isPhoneVerified,
    isVerified: p.isVerified, subscription: p.subscription,
    role: p.role, isAdmin: computeIsAdmin(p), stats: p.stats,
    preferences: p.preferences, clanId: p.clanId, clanRole: p.clanRole,
    createdAt: p.createdAt,
  };
}

// ── Register ──────────────────────────────────────────────────────────────────
router.post('/register', authLimiter, registerRules, validate, async (req, res) => {
  try {
    const { username, email, password, phone, country, dateOfBirth, gender, displayName } = req.body;
    const existing = await Player.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(409).json({
      error: existing.email === email ? 'Email already registered' : 'Username taken',
    });

    const player = await Player.create({
      username, email, password, phone, country,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender, displayName: displayName || username,
    });

    const accessToken = signAccess(player._id);
    const refreshToken = signRefresh(player._id);
    player.refreshTokens = [{ token: refreshToken }];

    // Send email verification OTP immediately after registration
    const otp = generateOTP();
    player.otp = { code: otp, type: 'email', expiresAt: new Date(Date.now() + 10 * 60 * 1000), attempts: 0 };
    await player.save({ validateBeforeSave: false });

    // Send OTP — won't throw even if SMTP not configured (falls back to console log)
    sendEmailOTP(email, otp, 'email').catch(err =>
      logger.error('[register] Failed to send verification email:', err.message)
    );

    res.status(201).json({ token: accessToken, accessToken, refreshToken, player: safePlayer(player) });
  } catch (err) {
    logger.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', authLimiter, loginRules, validate, async (req, res) => {
  try {
    const { email, password } = req.body;
    const player = await Player.findOne({ email }).select('+password +loginAttempts +lockUntil');
    if (!player) return res.status(401).json({ error: 'Invalid credentials' });

    if (player.isLocked()) {
      const wait = Math.ceil((player.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ error: `Account locked. Try again in ${wait} minute(s).` });
    }
    if (player.isBanned) {
      const stillBanned = !player.banUntil || player.banUntil > new Date();
      if (stillBanned) return res.status(403).json({ error: 'Account banned', reason: player.banReason });
    }

    const ok = await player.comparePassword(password);
    if (!ok) {
      player.loginAttempts = (player.loginAttempts || 0) + 1;
      const maxAttempts = parseInt(process.env.ACCOUNT_LOCKOUT_ATTEMPTS || '5');
      if (player.loginAttempts >= maxAttempts) {
        player.lockUntil = new Date(Date.now() + parseInt(process.env.ACCOUNT_LOCKOUT_MINUTES || '30') * 60000);
      }
      await player.save({ validateBeforeSave: false });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    player.loginAttempts = 0;
    player.lockUntil = undefined;
    player.isOnline = true;
    player.lastSeen = new Date();

    const accessToken = signAccess(player._id);
    const refreshToken = signRefresh(player._id);
    player.refreshTokens = [{ token: refreshToken }, ...(player.refreshTokens || []).slice(0, 4)];
    await player.save({ validateBeforeSave: false });

    res.json({ token: accessToken, accessToken, refreshToken, player: safePlayer(player) });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Refresh token ─────────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const player = await Player.findById(decoded.id);
    if (!player) return res.status(401).json({ error: 'Player not found' });
    const tokenExists = player.refreshTokens.some(t => t.token === refreshToken);
    if (!tokenExists) return res.status(401).json({ error: 'Invalid refresh token' });

    const newAccess = signAccess(player._id);
    const newRefresh = signRefresh(player._id);
    player.refreshTokens = player.refreshTokens.filter(t => t.token !== refreshToken).concat({ token: newRefresh }).slice(-5);
    await player.save({ validateBeforeSave: false });
    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch (_) {
    res.status(401).json({ error: 'Invalid or expired refresh token', code: 'TOKEN_EXPIRED' });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', protect, async (req, res) => {
  const { refreshToken } = req.body;
  await Player.findByIdAndUpdate(req.player._id, {
    isOnline: false, lastSeen: new Date(),
    $pull: { refreshTokens: { token: refreshToken } },
  });
  res.json({ message: 'Logged out' });
});

// ── Get current player ────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  const p = await Player.findById(req.player._id);
  res.json({ player: safePlayer(p) });
});

// ── Update profile ────────────────────────────────────────────────────────────
router.patch('/profile', protect, async (req, res) => {
  try {
    const allowed = ['displayName', 'avatar', 'bio', 'country', 'gender', 'preferences'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const player = await Player.findByIdAndUpdate(req.player._id, updates, { new: true });

    // Notify the player about profile update
    notify(req.app.get('io'), player._id, {
      type: 'profile_updated',
      title: 'Profile updated',
      message: 'Your profile changes were saved successfully.',
      icon: '✏️',
    }).catch(() => { });

    res.json({ player: safePlayer(player) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Send OTP ──────────────────────────────────────────────────────────────────
router.post('/otp/send', protect, otpLimiter, async (req, res) => {
  try {
    const { type = 'email', channel = 'email' } = req.body;
    const player = await Player.findById(req.player._id).select('+otp');

    // Check lockout
    if (player.otp?.lockedUntil && player.otp.lockedUntil > new Date())
      return res.status(429).json({ error: 'Too many OTP attempts. Try again later.' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + parseInt(process.env.OTP_EXPIRES_MINUTES || '10') * 60000);
    player.otp = { code: otp, type, expiresAt, attempts: 0 };
    await player.save({ validateBeforeSave: false });

    // ── Send via the configured channel ───────────────────────────────────────
    if (channel === 'email' || type === 'email') {
      await sendEmailOTP(player.email, otp, type);
    } else if (channel === 'whatsapp') {
      if (!player.phone) return res.status(400).json({ error: 'No phone number on file' });
      await sendWhatsAppOTP(player.phone, otp);
    } else if (channel === 'sms') {
      if (!player.phone) return res.status(400).json({ error: 'No phone number on file' });
      await sendSMSOTP(player.phone, otp);
    }

    res.json({ message: `OTP sent via ${channel}`, expiresIn: 600 });
  } catch (err) {
    logger.error('OTP send error:', err);
    res.status(500).json({ error: 'Failed to send OTP: ' + err.message });
  }
});

// ── Verify OTP ────────────────────────────────────────────────────────────────
router.post('/otp/verify', protect, async (req, res) => {
  try {
    const { code, type } = req.body;
    const player = await Player.findById(req.player._id).select('+otp');

    if (!player.otp?.code) return res.status(400).json({ error: 'No OTP pending. Request a new code first.' });
    if (player.otp.type !== type) return res.status(400).json({ error: 'OTP type mismatch' });
    if (player.otp.expiresAt < new Date()) return res.status(400).json({ error: 'OTP expired. Request a new code.' });

    const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || '3');
    if ((player.otp.attempts || 0) >= maxAttempts) {
      player.otp.lockedUntil = new Date(Date.now() + parseInt(process.env.OTP_LOCKOUT_MINUTES || '30') * 60000);
      await player.save({ validateBeforeSave: false });
      return res.status(429).json({ error: 'Too many incorrect attempts. Try again in 30 minutes.' });
    }

    if (player.otp.code !== String(code)) {
      player.otp.attempts = (player.otp.attempts || 0) + 1;
      await player.save({ validateBeforeSave: false });
      const left = maxAttempts - player.otp.attempts;
      return res.status(400).json({ error: 'Incorrect code', attemptsLeft: left });
    }

    // ── OTP correct ──────────────────────────────────────────────────────────
    const update = { otp: {} };
    if (type === 'email') update.isEmailVerified = true;
    if (type === 'phone') update.isPhoneVerified = true;

    // Grant full verified badge when both email + phone are verified
    const emailOk = type === 'email' || player.isEmailVerified;
    const phoneOk = type === 'phone' || player.isPhoneVerified;
    if (emailOk && (phoneOk || !player.phone)) update.isVerified = true;

    const updated = await Player.findByIdAndUpdate(req.player._id, update, { new: true });
    res.json({ message: 'Verified successfully', player: safePlayer(updated) });
  } catch (err) {
    logger.error('OTP verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── Change password ───────────────────────────────────────────────────────────
router.patch('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password min 8 characters' });
    const player = await Player.findById(req.player._id).select('+password');
    const ok = await player.comparePassword(currentPassword);
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
    player.password = newPassword;
    await player.save();

    // Notify the player about password change
    notify(req.app.get('io'), player._id, {
      type: 'password_changed',
      title: 'Password changed',
      message: 'Your password was changed. If this wasn\'t you, contact support immediately.',
      icon: '🔑',
      email: true,
    }).catch(() => { });

    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: 'Password update failed' });
  }
});

module.exports = router;
