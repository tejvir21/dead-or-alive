/**
 * ClanBattle.js — Asynchronous clan-vs-clan score battle
 *
 * Created once a ClanChallenge is accepted, or once the random queue
 * pairs two clans. Both clans play the SAME pre-generated room sequence
 * (fair identical test), each member independently and asynchronously
 * within a fixed time window. Winner = higher aggregate clan score when
 * the window closes.
 */
const mongoose = require('mongoose');

const clanBattleSchema = new mongoose.Schema({
  clanAId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', required: true },
  clanBId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', required: true },

  status: { type: String, enum: ['active', 'completed'], default: 'active' },

  difficultyCurve: { type: String, default: 'stepped' },

  // The exact room sequence both clans play — generated ONCE at battle
  // creation so it's an identical, fair test. Full data (including
  // correctDoor) is stored here; the server strips that before sending
  // to clients, same pattern as the live game engine's getSafeCurrentRoom.
  roomSequence: { type: mongoose.Schema.Types.Mixed, required: true },

  startedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }, // startedAt + battleWindowHours

  // One entry per member run. A member can only appear once unless
  // scoringMode allows multiple runs (not currently exposed in UI, but
  // the schema doesn't prevent it for future flexibility).
  runs: [{
    playerId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    clanId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', required: true },
    username:      { type: String, required: true },
    roomsSurvived: { type: Number, required: true },
    startedAt:     { type: Date },
    completedAt:   { type: Date, default: Date.now },
  }],

  // Snapshot of the scoring mode AT BATTLE CREATION TIME, so a later
  // admin settings change doesn't retroactively alter a completed battle
  scoringMode: { type: String, enum: ['sum', 'average', 'best'], default: 'sum' },

  winnerClanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', default: null }, // null = draw or not yet completed
  clanAScore:   { type: Number, default: null },
  clanBScore:   { type: Number, default: null },
  completedAt:  { type: Date },

}, { timestamps: true });

clanBattleSchema.index({ clanAId: 1, status: 1 });
clanBattleSchema.index({ clanBId: 1, status: 1 });
clanBattleSchema.index({ status: 1, expiresAt: 1 }); // for the expiry cron's query

// ── Compute a clan's aggregate score from its runs, per the battle's
// scoringMode snapshot ──────────────────────────────────────────────────────
clanBattleSchema.methods.computeClanScore = function (clanId) {
  const clanRuns = this.runs.filter(r => r.clanId.toString() === clanId.toString());
  if (clanRuns.length === 0) return 0;
  const values = clanRuns.map(r => r.roomsSurvived);
  if (this.scoringMode === 'best')    return Math.max(...values);
  if (this.scoringMode === 'average') return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  return values.reduce((a, b) => a + b, 0); // 'sum' (default)
};

clanBattleSchema.methods.hasPlayerPlayed = function (playerId) {
  return this.runs.some(r => r.playerId.toString() === playerId.toString());
};

module.exports = mongoose.model('ClanBattle', clanBattleSchema);
