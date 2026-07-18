/**
 * Notification.js — Persistent notification history
 * Powers the bell-icon notification center on the client.
 */
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: [
      'kicked_you', 'you_kicked_someone',
      'profile_updated', 'password_changed',
      'admin_banned', 'admin_unbanned',
      'admin_verified', 'admin_unverified',
      'admin_gifted_subscription',
      'beta_approved', 'beta_rejected',
      'game_won', 'game_eliminated',
      'admin_activity', // for admin-to-admin activity feed
      'generic',
    ],
  },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  icon:    { type: String, default: '🔔' },
  isRead:  { type: Boolean, default: false },
  meta:    { type: mongoose.Schema.Types.Mixed, default: {} }, // extra data (roomCode, banReason, etc.)
}, { timestamps: true });

notificationSchema.index({ playerId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ playerId: 1, createdAt: -1 });

// Auto-expire notifications after 90 days to keep the collection lean
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
