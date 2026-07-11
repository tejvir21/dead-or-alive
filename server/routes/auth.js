/**
 * Auth Routes — Phase 1
 * register, login, refresh token, OTP send/verify, profile update
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Player = require('../models/Player');
const { protect } = require('../middleware/auth');
const { authLimiter, otpLimiter, validate, registerRules, loginRules } = require('../middleware/security');
const { ADMIN_IDS } = require('../middleware/auth');
const logger = require('../utils/logger');

const signAccess  = id => jwt.sign({ id }, process.env.JWT_SECRET,         { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
const signRefresh = id => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });

const computeIsAdmin = p => ADMIN_IDS.includes(p._id.toString()) || p.role === 'admin';

function safePlayer(p) {
  return {
    id: p._id, username: p.username, email: p.email,
    displayName: p.displayName, phone: p.phone, country: p.country,
    dateOfBirth: p.dateOfBirth, gender: p.gender, avatar: p.avatar, bio: p.bio,
    isEmailVerified: p.isEmailVerified, isPhoneVerified: p.isPhoneVerified,
    isVerified: p.isVerified, subscription: p.subscription,
    role: p.role, isAdmin: computeIsAdmin(p), stats: p.stats,
    preferences: p.preferences, clanId: p.clanId, clanRole: p.clanRole,
  };
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendEmailOTP(email, otp, purpose) {
  // Placeholder — wire up nodemailer / SendGrid here
  logger.info(`[OTP] Email to ${email}: ${otp} (${purpose})`);
  // In production:
  // const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, ... });
  // await transporter.sendMail({ to: email, subject: `Your OTP: ${otp}`, text: `Your code: ${otp}` });
}

async function sendWhatsAppOTP(phone, otp) {
  logger.info(`[OTP] WhatsApp to ${phone}: ${otp}`);
  // In production:
  // const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({ from: process.env.TWILIO_WHATSAPP_FROM, to: `whatsapp:${phone}`, body: `Your OTP: ${otp}` });
}

async function sendSMSOTP(phone, otp) {
  logger.info(`[OTP] SMS to ${phone}: ${otp}`);
  // await client.messages.create({ from: process.env.TWILIO_SMS_FROM, to: phone, body: `Your OTP: ${otp}` });
}

// ── Register ──────────────────────────────────────────────────────────────────
router.post('/register', authLimiter, registerRules, validate, async (req, res) => {
  try {
    const { username, email, password, phone, country, dateOfBirth, gender, displayName } = req.body;

    const existing = await Player.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({
        error: existing.email === email ? 'Email already registered' : 'Username taken',
      });
    }

    const player = await Player.create({
      username, email, password, phone, country,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender, displayName: displayName || username,
    });

    const accessToken  = signAccess(player._id);
    const refreshToken = signRefresh(player._id);

    player.refreshTokens = [{ token: refreshToken }];
    await player.save({ validateBeforeSave: false });

    // Send email verification OTP
    const otp = generateOTP();
    player.otp = {
      code: otp, type: 'email',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), attempts: 0,
    };
    await player.save({ validateBeforeSave: false });
    await sendEmailOTP(email, otp, 'email_verification');

    res.status(201).json({
      // Legacy field — old client code reads `data.token`. Keep this alias
      // so existing frontends keep working without modification.
      token: accessToken,
      accessToken, refreshToken,
      player: safePlayer(player),
    });
  } catch (err) {
    logger.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', authLimiter, loginRules, validate, async (req, res) => {
  try {
    const { email, password } = req.body;

    const player = await Player.findOne({ email }).select('+password +otp +loginAttempts +lockUntil');
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
      const maxAttempts = parseInt(process.env.ACCOUNT_LOCKOUT_ATTEMPTS || 5);
      if (player.loginAttempts >= maxAttempts) {
        const lockMins = parseInt(process.env.ACCOUNT_LOCKOUT_MINUTES || 30);
        player.lockUntil = new Date(Date.now() + lockMins * 60 * 1000);
      }
      await player.save({ validateBeforeSave: false });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed attempts
    player.loginAttempts = 0;
    player.lockUntil = undefined;
    player.isOnline = true;
    player.lastSeen = new Date();

    const accessToken  = signAccess(player._id);
    const refreshToken = signRefresh(player._id);

    // Keep only last 5 refresh tokens
    player.refreshTokens = [
      { token: refreshToken },
      ...(player.refreshTokens || []).slice(0, 4),
    ];
    await player.save({ validateBeforeSave: false });

    res.json({
      token: accessToken, // legacy alias for old client compatibility
      accessToken, refreshToken,
      player: safePlayer(player),
    });
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

    const newAccess  = signAccess(player._id);
    const newRefresh = signRefresh(player._id);

    // Rotate refresh token
    player.refreshTokens = player.refreshTokens
      .filter(t => t.token !== refreshToken)
      .concat({ token: newRefresh })
      .slice(-5);
    await player.save({ validateBeforeSave: false });

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
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
    const allowed = ['displayName','avatar','bio','country','gender','preferences'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    const player = await Player.findByIdAndUpdate(req.player._id, updates, { new: true });
    res.json({ player: safePlayer(player) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Send OTP ──────────────────────────────────────────────────────────────────
router.post('/otp/send', protect, otpLimiter, async (req, res) => {
  try {
    const { type, channel } = req.body; // type: email|phone, channel: email|whatsapp|sms
    const player = await Player.findById(req.player._id).select('+otp');

    // Check lockout
    if (player.otp?.lockedUntil && player.otp.lockedUntil > new Date())
      return res.status(429).json({ error: 'OTP locked. Try later.' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + parseInt(process.env.OTP_EXPIRES_MINUTES || 10) * 60 * 1000);

    player.otp = { code: otp, type, expiresAt, attempts: 0 };
    await player.save({ validateBeforeSave: false });

    if (type === 'email' || channel === 'email') {
      await sendEmailOTP(player.email, otp, type);
    } else if (channel === 'whatsapp') {
      await sendWhatsAppOTP(player.phone, otp);
    } else if (channel === 'sms') {
      await sendSMSOTP(player.phone, otp);
    }

    res.json({ message: 'OTP sent', expiresIn: 600 });
  } catch (err) {
    logger.error('OTP send error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// ── Verify OTP ────────────────────────────────────────────────────────────────
router.post('/otp/verify', protect, async (req, res) => {
  try {
    const { code, type } = req.body;
    const player = await Player.findById(req.player._id).select('+otp');

    if (!player.otp?.code) return res.status(400).json({ error: 'No OTP pending' });
    if (player.otp.type !== type) return res.status(400).json({ error: 'OTP type mismatch' });
    if (player.otp.expiresAt < new Date()) return res.status(400).json({ error: 'OTP expired' });

    const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || 3);
    if (player.otp.attempts >= maxAttempts) {
      const lockMins = parseInt(process.env.OTP_LOCKOUT_MINUTES || 30);
      player.otp.lockedUntil = new Date(Date.now() + lockMins * 60 * 1000);
      await player.save({ validateBeforeSave: false });
      return res.status(429).json({ error: 'Too many OTP attempts. Locked.' });
    }

    if (player.otp.code !== String(code)) {
      player.otp.attempts += 1;
      await player.save({ validateBeforeSave: false });
      return res.status(400).json({ error: 'Invalid OTP', attemptsLeft: maxAttempts - player.otp.attempts });
    }

    // OTP correct — update verification status
    const update = { otp: {} };
    if (type === 'email')  { update.isEmailVerified = true; }
    if (type === 'phone')  { update.isPhoneVerified = true; }
    if (player.isEmailVerified || type === 'email') {
      if (player.isPhoneVerified || type === 'phone') {
        update.isVerified = true;
      }
    }

    const updated = await Player.findByIdAndUpdate(req.player._id, update, { new: true });
    res.json({ message: 'OTP verified', player: safePlayer(updated) });
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
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: 'Password update failed' });
  }
});

module.exports = router;
