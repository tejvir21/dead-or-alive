/**
 * Player Model
 * Stores player profile, auth credentials, game history, and anti-repetition clue tracking
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const playerSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username cannot exceed 20 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Never return password by default
    },
    avatar: {
      type: String,
      default: 'survivor', // avatar key
    },
    // ── Anti-repetition: track recently seen clues ──────────────────────────
    recentClues: [
      {
        clueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clue' },
        seenAt: { type: Date, default: Date.now },
        gameCount: { type: Number, default: 0 }, // which game number this was seen
      },
    ],
    // ── Statistics ──────────────────────────────────────────────────────────
    stats: {
      gamesPlayed: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      totalRoomsSurvived: { type: Number, default: 0 },
      totalEliminations: { type: Number, default: 0 },
      longestSurvivalStreak: { type: Number, default: 0 },
      currentStreak: { type: Number, default: 0 },
    },
    // ── Role ────────────────────────────────────────────────────────────────
    role: {
      type: String,
      enum: ['player', 'admin'],
      default: 'player',
    },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    gamesPlayed: { type: Number, default: 0 }, // shortcut for easy querying
  },
  {
    timestamps: true,
  }
);

// ─── Hash password before save ────────────────────────────────────────────────
playerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Compare password method ──────────────────────────────────────────────────
playerSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Get survival rate ────────────────────────────────────────────────────────
playerSchema.methods.getSurvivalRate = function () {
  if (this.stats.gamesPlayed === 0) return 0;
  return ((this.stats.wins / this.stats.gamesPlayed) * 100).toFixed(1);
};

// ─── Add clue to recent history (deduplicate and enforce 10-game cooldown) ────
playerSchema.methods.addRecentClue = function (clueId) {
  const existing = this.recentClues.find(
    (c) => c.clueId.toString() === clueId.toString()
  );
  if (existing) {
    existing.seenAt = new Date();
    existing.gameCount = this.gamesPlayed;
  } else {
    this.recentClues.push({ clueId, seenAt: new Date(), gameCount: this.gamesPlayed });
  }
  // Keep only last 50 entries
  if (this.recentClues.length > 50) {
    this.recentClues = this.recentClues.slice(-50);
  }
};

// ─── Get clue IDs seen within last 10 games ───────────────────────────────────
playerSchema.methods.getRecentClueIds = function () {
  const cutoff = this.gamesPlayed - 10;
  return this.recentClues
    .filter((c) => c.gameCount >= cutoff)
    .map((c) => c.clueId);
};

module.exports = mongoose.model('Player', playerSchema);
