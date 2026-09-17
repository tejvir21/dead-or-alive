/**
 * GameSettings.js — Admin-controlled singleton
 * Includes: timers, limits, daily limits, auto-start, kick system, beta
 * access, difficulty curves, feature flags, subscription plans, clan
 * settings, clan battle settings (async score-based clan-vs-clan).
 */
const mongoose = require('mongoose');

const gameSettingsSchema = new mongoose.Schema({
  _singleton: { type: Boolean, default: true, unique: true },

  puzzleTimerSeconds:    { type: Number, default: 30 },
  doorTimerSeconds:      { type: Number, default: 30 },
  countdownSeconds:      { type: Number, default: 5 },
  timerReductionFactor:  { type: Number, default: 0.3 },
  timerReductionEnabled: { type: Boolean, default: true },

  maxPlayersNormal:       { type: Number, default: 16 },
  maxPlayersVerified:     { type: Number, default: 32 },
  minPlayersToStart:      { type: Number, default: 1 },
  reconnectGraceNormal:   { type: Number, default: 30 },
  reconnectGraceVerified: { type: Number, default: 60 },

  dailyLimits: {
    free:     { create: { type: Number, default: 3 },  join: { type: Number, default: 10 } },
    verified: { create: { type: Number, default: 8 },  join: { type: Number, default: 25 } },
    pro:      { create: { type: Number, default: 20 }, join: { type: Number, default: 60 } },
    elite:    { create: { type: Number, default: -1 }, join: { type: Number, default: -1 } },
  },

  autoStartTimer: {
    enabled:         { type: Boolean, default: true },
    defaultDuration: { type: Number,  default: 180 },
    tierLimits: {
      free:     { min: { type: Number, default: 180 }, max: { type: Number, default: 180 } },
      verified: { min: { type: Number, default: 60 },  max: { type: Number, default: 300 } },
      pro:      { min: { type: Number, default: 30 },  max: { type: Number, default: 600 } },
      elite:    { min: { type: Number, default: 10 },  max: { type: Number, default: 1800 } },
    },
  },

  kickSystem: {
    enabled:            { type: Boolean, default: true },
    minimumPlayers:     { type: Number,  default: 3 },
    thresholdPercent:   { type: Number,  default: 50 },
    voteTimeoutSeconds: { type: Number,  default: 30 },
    creatorCanKick:     { type: Boolean, default: true },
  },

  betaAccess: {
    enabled:       { type: Boolean, default: false },
    betaUrl:       { type: String,  default: '' },
    allowElite:    { type: Boolean, default: true },
    allowPro:      { type: Boolean, default: false },
    lockedMessage: { type: String, default: 'This is a restricted beta version. Subscribe to Pro or Elite to request access.' },
  },

  difficultyCurves: [{
    name:        { type: String, required: true },
    label:       { type: String, required: true },
    description: { type: String, default: '' },
    levels:      [{ type: Number, min: 1, max: 10 }],
    availableTo: { type: String, enum: ['all', 'verified', 'admin'], default: 'all' },
    isDefault:   { type: Boolean, default: false },
  }],

  features: {
    maintenanceMode:    { type: Boolean, default: false },
    spectatorMode:      { type: Boolean, default: true },
    globalLeaderboard:  { type: Boolean, default: true },
    chat:               { type: Boolean, default: true },
    voteKick:           { type: Boolean, default: true },
    dailyLimitsEnabled: { type: Boolean, default: true },
    autoStartEnabled:   { type: Boolean, default: true },
    teamModesEnabled:   { type: Boolean, default: true },
    clanMatchmakingEnabled: { type: Boolean, default: true },
  },

  clanSettings: {
    maxMembersPerClan: { type: Number, default: 20 },
    creationTiers:      { type: [String], default: ['pro', 'elite'] },
    ownedClansLimit: {
      free:     { type: Number, default: 0 },
      verified: { type: Number, default: 0 },
      pro:      { type: Number, default: 1 },
      elite:    { type: Number, default: 3 },
    },
  },

  // ── Clan battles (async score-based clan-vs-clan) ───────────────────────────
  clanBattleSettings: {
    challengeExpiryDays: { type: Number, default: 7 },   // unaccepted challenge auto-expires
    battleWindowHours:   { type: Number, default: 24 },  // once accepted, how long the run window stays open
    scoringMode:         { type: String, enum: ['sum', 'average', 'best'], default: 'sum' },
    roomCount:           { type: Number, default: 10 },  // rooms in the shared battle sequence
  },

  subscriptionPlans: [{
    name:            { type: String },
    label:           { type: String },
    price:           { type: Number },
    currency:        { type: String, default: 'INR' },
    durationDays:    { type: Number },
    maxPlayersBonus: { type: Number, default: 0 },
    features:        [String],
  }],

}, { timestamps: true });

gameSettingsSchema.statics.getSingleton = async function () {
  let s = await this.findOne({ _singleton: true });
  if (!s) {
    s = await this.create({
      _singleton: true,
      difficultyCurves: [
        { name: 'gentle',         label: 'Gentle',         levels: [1,1,2,2,3,3,4,4,5,5],   availableTo: 'all',      isDefault: false },
        { name: 'balanced',       label: 'Balanced',       levels: [2,3,4,4,5,5,6,6,7,7],   availableTo: 'all',      isDefault: false },
        { name: 'stepped',        label: 'Stepped',        levels: [1,2,3,4,5,6,7,8,9,10],  availableTo: 'all',      isDefault: true  },
        { name: 'ascending_fast', label: 'Ascending Fast', levels: [3,4,5,6,7,7,8,8,9,10],  availableTo: 'all',      isDefault: false },
        { name: 'spike',          label: 'Spike',          levels: [1,2,3,8,9,3,4,9,10,10], availableTo: 'verified', isDefault: false },
        { name: 'nightmare',      label: 'Nightmare',      levels: [5,6,7,7,8,8,9,9,10,10], availableTo: 'verified', isDefault: false },
        { name: 'expert',         label: 'Expert',         levels: [7,7,8,8,8,9,9,9,10,10], availableTo: 'verified', isDefault: false },
        { name: 'random',         label: 'Random',         levels: [1,3,5,2,8,4,9,6,10,7],  availableTo: 'verified', isDefault: false },
      ],
      subscriptionPlans: [
        { name: 'pro',   label: 'Pro',   price: 199, durationDays: 30, features: ['Extended daily limits','Verified badge','Beta access (on request)'] },
        { name: 'elite', label: 'Elite', price: 499, durationDays: 30, features: ['Unlimited rooms','Auto beta access','Priority support','Nightmare curves'] },
      ],
    });
  }
  return s;
};

module.exports = mongoose.model('GameSettings', gameSettingsSchema);
