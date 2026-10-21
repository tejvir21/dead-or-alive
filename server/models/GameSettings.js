/**
 * GameSettings.js — `tiers` is now a genuinely DYNAMIC Mongoose Map, not
 * fixed free/verified/pro/elite fields. Any subscription plan name
 * automatically gets its own settings bucket.
 *
 * 'free' and 'verified' are special — they're not purchasable plans
 * (verified = email+phone verified, no payment), so they're seeded
 * unconditionally and never removed. Every OTHER key in `tiers` should
 * correspond 1:1 with a `subscriptionPlans[].name` — see
 * ensureTierForPlan()/removeTierIfOrphaned() below, which need to be
 * called from wherever plans are actually created/deleted (I don't have
 * that route in this workspace — see DYNAMIC_TIERS_INTEGRATION.md for
 * exactly where to add the calls).
 *
 * NOTE: this REPLACES the previous fixed-tier version (free/verified/
 * pro/elite as named sub-fields + syncTiersToLegacyFields() projecting
 * onto old scattered fields). That approach couldn't represent new plans
 * at all, which is the bug being fixed here. The old scattered fields
 * (dailyLimits, autoStartTimer.tierLimits, etc.) are LEFT IN PLACE for
 * any code that still reads them directly, but they can no longer be
 * treated as the source of truth for anything beyond the original 4
 * tiers — see utils/playerTier.js for the new dynamic lookup pattern
 * that replaces reading those fixed fields.
 */
const mongoose = require('mongoose');

const tierSettingsSchema = new mongoose.Schema({
  dailyCreate: { type: Number, default: 3 },
  dailyJoin: { type: Number, default: 10 },
  autoStartMin: { type: Number, default: 180 },
  autoStartMax: { type: Number, default: 180 },
  minPlayers: { type: Number, default: 1 },
  maxPlayers: { type: Number, default: 16 },
  maxTeams: { type: Number, default: 2 },
  canChooseRoomCount: { type: Boolean, default: false },
  maxRooms: { type: Number, default: 5 },
  canCreateClan: { type: Boolean, default: false },
  ownedClansLimit: { type: Number, default: 0 },
  betaAccess: { type: String, enum: ['none', 'request', 'auto'], default: 'none' },
  unlockedCurves: { type: [String], default: ['stepped'] },
}, { _id: false });

const gameSettingsSchema = new mongoose.Schema({
  _singleton: { type: Boolean, default: true, unique: true },

  puzzleTimerSeconds: { type: Number, default: 30 },
  doorTimerSeconds: { type: Number, default: 30 },
  countdownSeconds: { type: Number, default: 5 },
  timerReductionFactor: { type: Number, default: 0.3 },
  timerReductionEnabled: { type: Boolean, default: true },

  minPlayersToStart: { type: Number, default: 1 },
  reconnectGraceNormal: { type: Number, default: 30 },
  reconnectGraceVerified: { type: Number, default: 60 },

  // Global on/off + fallback duration — NOT tier-specific, so this stays
  // (the OLD tierLimits sub-object here WAS correctly superseded by
  // tiers[].autoStartMin/Max — I mistakenly removed this whole object
  // including these two global fields when I should have only removed
  // tierLimits. Fixed now — socketHandlers.js already reads these two
  // fields correctly, they just had nothing to read until this fix.)
  autoStartTimer: {
    enabled: { type: Boolean, default: true },
    defaultDuration: { type: Number, default: 180 },
  },

  kickSystem: {
    enabled: { type: Boolean, default: true },
    minimumPlayers: { type: Number, default: 3 },
    thresholdPercent: { type: Number, default: 50 },
    voteTimeoutSeconds: { type: Number, default: 30 },
    creatorCanKick: { type: Boolean, default: true },
  },

  betaAccess: {
    enabled: { type: Boolean, default: false },
    betaUrl: { type: String, default: '' },
    lockedMessage: { type: String, default: 'This is a restricted beta version. Subscribe to unlock access.' },
  },

  difficultyCurves: [{
    name: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, default: '' },
    levels: [{ type: Number, min: 1, max: 10 }],
    isDefault: { type: Boolean, default: false },
    // availableTo (the old 3-bucket 'all'/'verified'/'admin' enum) is
    // DEPRECATED now that curve access lives per-tier in tiers[].unlockedCurves
    // below — kept only so old code that still reads it doesn't crash;
    // stop reading it once you've adopted the dynamic tier lookup.
    availableTo: { type: String, enum: ['all', 'verified', 'admin'], default: 'all' },
  }],

  features: {
    maintenanceMode: { type: Boolean, default: false },
    spectatorMode: { type: Boolean, default: true },
    globalLeaderboard: { type: Boolean, default: true },
    chat: { type: Boolean, default: true },
    voteKick: { type: Boolean, default: true },
    dailyLimitsEnabled: { type: Boolean, default: true },
    autoStartEnabled: { type: Boolean, default: true },
    teamModesEnabled: { type: Boolean, default: true },
    clanMatchmakingEnabled: { type: Boolean, default: true },
  },

  clanSettings: {
    maxMembersPerClan: { type: Number, default: 20 },
  },

  clanBattleSettings: {
    challengeExpiryDays: { type: Number, default: 7 },
    battleWindowHours: { type: Number, default: 24 },
    scoringMode: { type: String, enum: ['sum', 'average', 'best'], default: 'sum' },
    roomCount: { type: Number, default: 10 },
  },

  subscriptionPlans: [{
    name: { type: String },
    label: { type: String },
    price: { type: Number },
    currency: { type: String, default: 'INR' },
    durationDays: { type: Number },
    maxPlayersBonus: { type: Number, default: 0 },
    features: [String],
  }],

  // ── DYNAMIC — a Map, not fixed fields. Key = tier name (matches
  // subscriptionPlans[].name for paid tiers, plus the special 'free' and
  // 'verified' keys). Mongoose serializes Maps to plain objects in
  // res.json() automatically — the client sees a normal {tierName: {...}}
  // object, no special handling needed there. ──────────────────────────────
  tiers: { type: Map, of: tierSettingsSchema, default: () => new Map() },

}, { timestamps: true });

// ── Call this whenever a new subscription plan is created, so it
// immediately has a settings bucket instead of silently having nowhere
// to configure its behavior (this was the original bug being fixed) ────────
gameSettingsSchema.methods.ensureTierForPlan = function (planName, cloneFromTier = 'pro') {
  if (this.tiers.has(planName)) return; // already exists, don't clobber
  const base = this.tiers.get(cloneFromTier);
  this.tiers.set(planName, base ? { ...base.toObject() } : {});
};

// ── Call this when a plan is deleted. Doesn't force-delete the tier
// settings (in case they re-add a plan with the same name later, or in
// case a currently-subscribed player is still on the old plan and you
// want their limits to keep working during a migration window) — just
// exposes the check so you can decide. ───────────────────────────────────
gameSettingsSchema.methods.isTierOrphaned = function (tierName) {
  if (tierName === 'free' || tierName === 'verified') return false; // never orphaned, always special
  return !this.subscriptionPlans.some(p => p.name === tierName);
};

gameSettingsSchema.statics.getSingleton = async function () {
  let s = await this.findOne({ _singleton: true });
  if (!s) {
    s = await this.create({
      _singleton: true,
      difficultyCurves: [
        { name: 'gentle', label: 'Gentle', levels: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5], isDefault: false },
        { name: 'balanced', label: 'Balanced', levels: [2, 3, 4, 4, 5, 5, 6, 6, 7, 7], isDefault: false },
        { name: 'stepped', label: 'Stepped', levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], isDefault: true },
        { name: 'ascending_fast', label: 'Ascending Fast', levels: [3, 4, 5, 6, 7, 7, 8, 8, 9, 10], isDefault: false },
        { name: 'spike', label: 'Spike', levels: [1, 2, 3, 8, 9, 3, 4, 9, 10, 10], isDefault: false },
        { name: 'nightmare', label: 'Nightmare', levels: [5, 6, 7, 7, 8, 8, 9, 9, 10, 10], isDefault: false },
        { name: 'expert', label: 'Expert', levels: [7, 7, 8, 8, 8, 9, 9, 9, 10, 10], isDefault: false },
        { name: 'random', label: 'Random', levels: [1, 3, 5, 2, 8, 4, 9, 6, 10, 7], isDefault: false },
      ],
      subscriptionPlans: [
        { name: 'pro', label: 'Pro', price: 199, durationDays: 30, features: ['Extended daily limits', 'Verified badge', 'Beta access (on request)'] },
        { name: 'elite', label: 'Elite', price: 499, durationDays: 30, features: ['Unlimited rooms', 'Auto beta access', 'Priority support', 'Nightmare curves'] },
      ],
      tiers: new Map([
        ['free', { dailyCreate: 3, dailyJoin: 10, autoStartMin: 180, autoStartMax: 180, maxPlayers: 16, canCreateClan: false, ownedClansLimit: 0, betaAccess: 'none', unlockedCurves: ['gentle', 'balanced', 'stepped', 'ascending_fast'] }],
        ['verified', { dailyCreate: 8, dailyJoin: 25, autoStartMin: 60, autoStartMax: 300, maxPlayers: 32, canCreateClan: false, ownedClansLimit: 0, betaAccess: 'none', unlockedCurves: ['gentle', 'balanced', 'stepped', 'ascending_fast', 'spike', 'nightmare', 'expert', 'random'] }],
        ['pro', { dailyCreate: 20, dailyJoin: 60, autoStartMin: 30, autoStartMax: 600, maxPlayers: 32, canCreateClan: true, ownedClansLimit: 1, betaAccess: 'request', unlockedCurves: ['gentle', 'balanced', 'stepped', 'ascending_fast', 'spike', 'nightmare', 'expert', 'random'] }],
        ['elite', { dailyCreate: -1, dailyJoin: -1, autoStartMin: 10, autoStartMax: 1800, maxPlayers: 32, canCreateClan: true, ownedClansLimit: 3, betaAccess: 'auto', unlockedCurves: ['gentle', 'balanced', 'stepped', 'ascending_fast', 'spike', 'nightmare', 'expert', 'random'] }],
      ]),
    });
  }
  return s;
};

module.exports = mongoose.model('GameSettings', gameSettingsSchema);
