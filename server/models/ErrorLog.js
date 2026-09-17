/**
 * ErrorLog.js — persistent storage for error/warn-level log entries,
 * fed by a custom Winston transport (see utils/logger.js).
 *
 * Only 'error' and 'warn' levels are persisted — 'info'/'debug' stay
 * console-only, otherwise this collection would grow unmanageably fast
 * and swamp anything actually worth an admin's attention.
 */
const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  level:     { type: String, enum: ['error', 'warn'], required: true, index: true },
  message:   { type: String, required: true },
  stack:     { type: String, default: null },
  meta:      { type: mongoose.Schema.Types.Mixed, default: {} }, // whatever extra fields were passed to logger.error(msg, {...})
  timestamp: { type: Date, default: Date.now, index: true },
});

// Auto-expire after 30 days — error logs are for recent operational
// visibility, not long-term audit (that's what AuditLog is for). Adjust
// `expireAfterSeconds` if you want a longer/shorter retention window.
errorLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
