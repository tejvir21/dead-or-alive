/**
 * Clan.js — Persistent clan/team social group
 * Three-tier roles: owner > admin > member
 * Only Pro/Elite can create; anyone can join (unless invite-only)
 * Weekly/monthly stat tracking for the leaderboard (reset via
 * utils/clanPeriodReset.js cron), alongside all-time stats.
 */
const mongoose = require('mongoose');

const periodStatsSchema = {
  matches:       { type: Number, default: 0 },
  wins:          { type: Number, default: 0 },
  roomsSurvived: { type: Number, default: 0 },
  periodStart:   { type: Date, default: Date.now },
};

const clanSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
  tag:         { type: String, required: true, unique: true, trim: true, uppercase: true, minlength: 2, maxlength: 5 },
  description: { type: String, default: '', maxlength: 300 },
  badge:       { type: String, default: '🛡️' },

  ownerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },

  members: [{
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    role:     { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  }],

  maxMembers:  { type: Number, default: 20 },
  joinPolicy:  { type: String, enum: ['open', 'invite_only'], default: 'open' },

  stats: {
    totalMatches:       { type: Number, default: 0 },
    totalWins:           { type: Number, default: 0 },
    totalRoomsSurvived:  { type: Number, default: 0 },
  },
  statsWeekly:  periodStatsSchema,
  statsMonthly: periodStatsSchema,

  // Live matchmaking queue flag — persisted so it's recoverable across
  // server restarts, though pairing itself happens in-memory in socketHandlers.js
  inQueueSince: { type: Date, default: null },

}, { timestamps: true });

clanSchema.index({ name: 1 });
clanSchema.index({ tag: 1 });
clanSchema.index({ 'members.playerId': 1 });
clanSchema.index({ 'stats.totalWins': -1 });
clanSchema.index({ 'statsWeekly.wins': -1 });
clanSchema.index({ 'statsMonthly.wins': -1 });

clanSchema.methods.getRole = function (playerId) {
  const member = this.members.find(m => m.playerId.toString() === playerId.toString());
  return member?.role || null;
};

clanSchema.methods.isMember = function (playerId) {
  return this.members.some(m => m.playerId.toString() === playerId.toString());
};

module.exports = mongoose.model('Clan', clanSchema);
