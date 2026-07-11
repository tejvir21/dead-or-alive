/**
 * GameSettings Model
 * Single-document store for all admin-configurable settings.
 * Always read via GameSettings.getSingleton()
 */
const mongoose = require('mongoose');

const difficultyBandSchema = new mongoose.Schema(
  { min: Number, max: Number, label: String },
  { _id: false }
);

const difficultyCurveSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true }, // 'gentle', 'balanced', etc.
    label:       { type: String },
    description: { type: String },
    // map of room index (0-based) → difficulty level
    // stored as array so index = room position
    levels:      { type: [Number], required: true },
    isDefault:   { type: Boolean, default: false },
    availableTo: { type: String, enum: ['all','verified','admin'], default: 'admin' },
  },
  { _id: false }
);

const gameSettingsSchema = new mongoose.Schema(
  {
    _singleton: { type: Boolean, default: true, unique: true },

    // ── Player limits ─────────────────────────────────────────────────────────
    maxPlayersNormal:   { type: Number, default: 16 },
    maxPlayersVerified: { type: Number, default: 32 },
    minPlayersToStart:  { type: Number, default: 1 },

    // ── Timer settings (seconds) ──────────────────────────────────────────────
    puzzleTimerSeconds:    { type: Number, default: 30 },
    doorTimerSeconds:      { type: Number, default: 30 },
    countdownSeconds:      { type: Number, default: 5 },
    reconnectGraceNormal:  { type: Number, default: 30 },
    reconnectGraceVerified:{ type: Number, default: 60 },

    // ── Timer reduction on correct early pick ─────────────────────────────────
    timerReductionEnabled: { type: Boolean, default: true },
    timerReductionFactor:  { type: Number, default: 0.3 }, // admin can change

    // ── Difficulty curves ──────────────────────────────────────────────────────
    difficultyCurves: {
      type: [difficultyCurveSchema],
      default: [
        {
          name: 'gentle',
          label: 'Gentle',
          description: 'Easy start, gradual increase',
          levels: [1,1,2,2,3,3,4,4,5,5],
          isDefault: false,
          availableTo: 'all',
        },
        {
          name: 'balanced',
          label: 'Balanced',
          description: 'Steady climb across all rooms',
          levels: [1,2,3,4,5,6,7,8,9,10],
          isDefault: false,
          availableTo: 'all',
        },
        {
          name: 'stepped',
          label: 'Stepped',
          description: 'Easy → Medium → Hard → Brutal → Nightmare',
          levels: [1,1,3,3,5,5,7,7,9,10],
          isDefault: true,
          availableTo: 'all',
        },
        {
          name: 'spike',
          label: 'Spike',
          description: 'Easy start then sudden brutality',
          levels: [1,1,2,5,7,9,10,10,10,10],
          isDefault: false,
          availableTo: 'verified',
        },
        {
          name: 'nightmare',
          label: 'Nightmare',
          description: 'No mercy from the start',
          levels: [5,6,7,7,8,8,9,9,10,10],
          isDefault: false,
          availableTo: 'verified',
        },
        {
          name: 'random',
          label: 'Random',
          description: 'Pure chaos — any difficulty any room',
          levels: [3,7,1,9,4,10,2,8,5,6],
          isDefault: false,
          availableTo: 'verified',
        },
        {
          name: 'ascending_fast',
          label: 'Ascending Fast',
          description: 'Quick difficulty ramp',
          levels: [1,2,4,5,6,7,8,9,10,10],
          isDefault: false,
          availableTo: 'all',
        },
        {
          name: 'expert',
          label: 'Expert',
          description: 'For seasoned players only',
          levels: [4,5,5,6,6,7,8,8,9,10],
          isDefault: false,
          availableTo: 'verified',
        },
      ],
    },

    // ── Rooms per player count ─────────────────────────────────────────────────
    roomsPerPlayerCount: {
      type: Map,
      of: Number,
      default: {
        '1': 5, '2': 5, '3': 5, '4': 6, '5': 7,
        '6': 8, '7': 9, '8': 10, '9': 10, '10': 10,
        '11': 10, '12': 10, '13': 10, '14': 10,
        '15': 10, '16': 10, '17': 10, '18': 10,
        '19': 10, '20': 10, '21': 10, '22': 10,
        '23': 10, '24': 10, '25': 10, '26': 10,
        '27': 10, '28': 10, '29': 10, '30': 10,
        '31': 10, '32': 10,
      },
    },

    // ── Clan settings ─────────────────────────────────────────────────────────
    maxClanSize:         { type: Number, default: 20 },
    clanMatchMinMembers: { type: Number, default: 2 },

    // ── Feature flags ─────────────────────────────────────────────────────────
    features: {
      teamsEnabled:       { type: Boolean, default: true },
      clansEnabled:       { type: Boolean, default: true },
      spectatorEnabled:   { type: Boolean, default: true },
      replayEnabled:      { type: Boolean, default: false },
      maintenanceMode:    { type: Boolean, default: false },
      newUserRegistration:{ type: Boolean, default: true },
      subscriptionsEnabled:{ type: Boolean, default: true },
      chatEnabled:        { type: Boolean, default: true },
      broadcastChatForSubscribers: { type: Boolean, default: true },
    },

    // ── Subscription plans ────────────────────────────────────────────────────
    subscriptionPlans: {
      type: [
        {
          name:        String,
          label:       String,
          priceINR:    Number,
          durationDays:Number,
          features:    [String],
          razorpayPlanId: String,
          isActive:    Boolean,
        },
      ],
      default: [
        {
          name: 'free', label: 'Free', priceINR: 0, durationDays: 0,
          features: ['16_max_players','basic_clues','standard_reconnect'],
          razorpayPlanId: '', isActive: true,
        },
        {
          name: 'pro', label: 'Pro', priceINR: 99, durationDays: 30,
          features: ['32_max_players','custom_room_code','exclusive_themes','stats_dashboard','extended_reconnect','early_access'],
          razorpayPlanId: '', isActive: true,
        },
        {
          name: 'elite', label: 'Elite', priceINR: 799, durationDays: 365,
          features: ['32_max_players','custom_room_code','exclusive_themes','stats_dashboard','extended_reconnect','early_access','clan_creation','password_rooms','broadcast_chat','all_difficulty_curves'],
          razorpayPlanId: '', isActive: true,
        },
      ],
    },
  },
  { timestamps: true }
);

// Always return the one settings document
gameSettingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne({ _singleton: true });
  if (!settings) settings = await this.create({ _singleton: true });
  return settings;
};

module.exports = mongoose.model('GameSettings', gameSettingsSchema);
