/**
 * ClanJoinRequest.js — Join requests for invite-only clans
 */
const mongoose = require('mongoose');

const clanJoinRequestSchema = new mongoose.Schema({
  clanId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', required: true, index: true },
  playerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  username:   { type: String, required: true },
  message:    { type: String, default: '', maxlength: 300 },
  status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  resolvedAt: { type: Date },
}, { timestamps: true });

clanJoinRequestSchema.index({ clanId: 1, status: 1 });
clanJoinRequestSchema.index({ playerId: 1, clanId: 1, status: 1 });

module.exports = mongoose.model('ClanJoinRequest', clanJoinRequestSchema);
