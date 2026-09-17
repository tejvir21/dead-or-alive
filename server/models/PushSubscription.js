/**
 * PushSubscription.js — stores each player's Web Push subscription
 * (one browser/device = one subscription; a player can have multiple
 * across devices, all get notified)
 */
const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth:   { type: String, required: true },
  },
  userAgent: { type: String, default: '' }, // helps players identify "Chrome on laptop" etc if you ever list their devices
}, { timestamps: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
