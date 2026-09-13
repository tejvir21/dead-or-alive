/**
 * ClanChallenge.js — Clan-vs-clan challenge (async battle model)
 * Challenger clan picks a specific online target clan and sends a challenge;
 * target clan's owner/admin accepts (spins up a ClanBattle) or declines.
 *
 * NOTE: expiry is now handled by utils/clanBattleExpiry.js (respects the
 * admin-configurable clanBattleSettings.challengeExpiryDays), NOT a fixed
 * MongoDB TTL index — a static TTL can't read a dynamic settings value.
 */
const mongoose = require('mongoose');

const clanChallengeSchema = new mongoose.Schema({
  challengerClanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', required: true },
  targetClanId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', required: true },
  sentBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },

  status: { type: String, enum: ['pending', 'accepted', 'declined', 'expired'], default: 'pending' },

  respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  respondedAt: { type: Date },

  battleId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClanBattle' }, // set once accepted

}, { timestamps: true });

clanChallengeSchema.index({ targetClanId: 1, status: 1 });
clanChallengeSchema.index({ challengerClanId: 1, status: 1 });
clanChallengeSchema.index({ status: 1, createdAt: 1 }); // for the expiry cron's query

module.exports = mongoose.model('ClanChallenge', clanChallengeSchema);
