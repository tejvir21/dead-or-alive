/**
 * Player Model — Phase 1
 * Includes: verification, subscription, profile fields, reconnection state
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const playerSchema = new mongoose.Schema(
  {
    // ── Core auth ───────────────────────────────────────────────────────────
    username: {
      type: String, required: true, unique: true, trim: true,
      minlength: 3, maxlength: 20,
      match: [/^[a-zA-Z0-9_]+$/, 'Username: letters, numbers, underscores only'],
    },
    email: {
      type: String, required: true, unique: true,
      lowercase: true, trim: true,
    },
    password: { type: String, required: true, minlength: 8, select: false },

    // ── Extended profile fields ──────────────────────────────────────────────
    displayName:  { type: String, trim: true, maxlength: 30 },
    phone:        { type: String, trim: true, sparse: true },
    country:      { type: String, trim: true },
    dateOfBirth:  { type: Date },
    gender:       { type: String, enum: ['male','female','non-binary','prefer_not_to_say', null], default: null },
    avatar:       { type: String, default: 'survivor' },
    bio:          { type: String, maxlength: 200 },

    // ── Verification ─────────────────────────────────────────────────────────
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isVerified:      { type: Boolean, default: false }, // full verified badge

    // ── OTP ──────────────────────────────────────────────────────────────────
    // NOTE: No field-level `select: false` here. The entire `otp` subdocument
    // is excluded by default at the QUERY level instead (see middleware/auth.js
    // and socket/socketHandlers.js using .select('-otp')). Mixing a schema-level
    // select:false on a subfield (otp.code) with a query-level exclusion of the
    // parent (-otp) causes MongoDB error 31249 "Path collision" — you cannot
    // exclude both a parent path and a child of that same path in one projection.
    // Routes that need the OTP code explicitly select it back with .select('+otp').
    otp: {
      code:       { type: String },
      type:       { type: String, enum: ['email','phone','admin','password_reset'] },
      expiresAt:  { type: Date },
      attempts:   { type: Number, default: 0 },
      lockedUntil:{ type: Date },
    },

    // ── Subscription ─────────────────────────────────────────────────────────
    subscription: {
      plan:       { type: String, enum: ['free','pro','elite'], default: 'free' },
      status:     { type: String, enum: ['active','inactive','cancelled','gifted'], default: 'inactive' },
      startDate:  { type: Date },
      endDate:    { type: Date },
      razorpaySubscriptionId: { type: String },
    },

    // ── Clan ─────────────────────────────────────────────────────────────────
    clanId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Clan' },
    clanRole:   { type: String, enum: ['captain','co-captain','member'], default: 'member' },

    // ── Security ─────────────────────────────────────────────────────────────
    loginAttempts:  { type: Number, default: 0 },
    lockUntil:      { type: Date },
    refreshTokens:  [{ token: String, createdAt: { type: Date, default: Date.now } }],

    // ── Status ───────────────────────────────────────────────────────────────
    role:       { type: String, enum: ['player','admin'], default: 'player' },
    isBanned:   { type: Boolean, default: false },
    banReason:  { type: String },
    banUntil:   { type: Date },
    isOnline:   { type: Boolean, default: false },
    lastSeen:   { type: Date, default: Date.now },

    // ── Anti-repetition (clue memory) ────────────────────────────────────────
    recentClues: [{
      clueId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Clue' },
      seenAt:    { type: Date, default: Date.now },
      gameCount: { type: Number, default: 0 },
    }],
    gamesPlayed: { type: Number, default: 0 },

    // ── Stats ────────────────────────────────────────────────────────────────
    stats: {
      gamesPlayed:           { type: Number, default: 0 },
      wins:                  { type: Number, default: 0 },
      totalRoomsSurvived:    { type: Number, default: 0 },
      totalEliminations:     { type: Number, default: 0 },
      longestSurvivalStreak: { type: Number, default: 0 },
      currentStreak:         { type: Number, default: 0 },
      fastestDoorPick:       { type: Number, default: null }, // ms
    },

    // ── Preferences ──────────────────────────────────────────────────────────
    preferences: {
      theme:       { type: String, default: 'default' },
      difficulty:  { type: String, enum: ['any','easy','medium','hard'], default: 'any' },
      notifications: { type: Boolean, default: true },
    },

    // ── Push notifications ────────────────────────────────────────────────────
    pushTokens: [{ token: String, platform: String }],
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// email and username already get a unique index automatically from `unique: true`
// on the field definitions above — no need to declare them again here.
playerSchema.index({ 'subscription.plan': 1 });
playerSchema.index({ isVerified: 1 });

// ── Hash password ─────────────────────────────────────────────────────────────
playerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

playerSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Account lock check ────────────────────────────────────────────────────────
playerSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// ── Subscription helpers ──────────────────────────────────────────────────────
playerSchema.methods.isSubscribed = function () {
  return (
    (this.subscription.plan === 'pro' || this.subscription.plan === 'elite') &&
    this.subscription.status === 'active' &&
    (!this.subscription.endDate || this.subscription.endDate > new Date())
  );
};

playerSchema.methods.maxPlayers = function (adminSettings) {
  const normalMax   = adminSettings?.maxPlayersNormal   || 16;
  const verifiedMax = adminSettings?.maxPlayersVerified  || 32;
  return (this.isVerified || this.isSubscribed()) ? verifiedMax : normalMax;
};

playerSchema.methods.reconnectGrace = function () {
  return (this.isVerified || this.isSubscribed())
    ? parseInt(process.env.RECONNECT_GRACE_SECONDS_VERIFIED || 60)
    : parseInt(process.env.RECONNECT_GRACE_SECONDS_NORMAL   || 30);
};

// ── Survival rate ─────────────────────────────────────────────────────────────
playerSchema.methods.getSurvivalRate = function () {
  if (!this.stats.gamesPlayed) return '0.0';
  return ((this.stats.wins / this.stats.gamesPlayed) * 100).toFixed(1);
};

// ── Clue memory ───────────────────────────────────────────────────────────────
playerSchema.methods.getRecentClueIds = function () {
  const cutoff = this.gamesPlayed - 10;
  return this.recentClues.filter(c => c.gameCount >= cutoff).map(c => c.clueId);
};

module.exports = mongoose.model('Player', playerSchema);
