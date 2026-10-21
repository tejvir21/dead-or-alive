/**
 * SupportTicket.js — player support requests
 */
const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
  username: { type: String, required: true },
  email:    { type: String, required: true },

  category: { type: String, enum: ['bug', 'billing', 'account', 'gameplay', 'other'], default: 'other' },
  subject:  { type: String, required: true, maxlength: 120 },
  message:  { type: String, required: true, maxlength: 2000 },

  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open', index: true },

  adminResponse: { type: String, default: null },
  respondedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  respondedAt:   { type: Date, default: null },

}, { timestamps: true });

supportTicketSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
