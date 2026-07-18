/**
 * BetaRequest.js — Beta access requests from Pro subscribers
 */
const mongoose = require('mongoose');

const betaRequestSchema = new mongoose.Schema({
  playerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  username:   { type: String, required: true },
  email:      { type: String, required: true },
  plan:       { type: String, default: 'free' },
  message:    { type: String, default: '', maxlength: 500 },
  status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote:  { type: String, default: '' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  resolvedAt: { type: Date },
}, { timestamps: true });

betaRequestSchema.index({ playerId: 1 });
betaRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('BetaRequest', betaRequestSchema);
