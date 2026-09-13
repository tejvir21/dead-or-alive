/**
 * utils/notify.js — Central notification dispatcher
 *
 * Usage from any route or socket handler:
 *   const notify = require('../utils/notify');
 *   await notify(io, playerId, {
 *     type: 'admin_banned',
 *     title: 'Account Banned',
 *     message: 'Your account was banned: spamming chat',
 *     icon: '🚫',
 *     meta: { reason: 'spamming chat' },
 *     email: true,   // also send an email (only for important events)
 *   });
 *
 * This:
 *   1. Saves to the Notification collection (persistent history)
 *   2. If the player has an active socket connection, emits 'notification'
 *      to them in real-time (bell icon updates instantly)
 *   3. If email:true and SMTP is configured, sends an email too
 */
const Notification = require('../models/Notification');
const Player = require('../models/Player');
const logger = require('./logger');

// Injected by index.js at startup so this module can reach connected sockets
// without a circular require of socketHandlers.js
let ioInstance = null;
let getPlayerSocketId = null; // (playerId) => socketId | null, injected from socketHandlers

function initNotify(io, socketLookupFn) {
  ioInstance = io;
  getPlayerSocketId = socketLookupFn;
}

async function notify(io, playerId, { type, title, message, icon = '🔔', meta = {}, email = false }) {
  try {
    const notification = await Notification.create({ playerId, type, title, message, icon, meta });

    // Real-time delivery if the player is currently connected
    const activeIo = io || ioInstance;
    if (activeIo && getPlayerSocketId) {
      const socketId = getPlayerSocketId(playerId.toString());
      if (socketId) {
        activeIo.to(socketId).emit('notification', {
          id: notification._id, type, title, message, icon, meta,
          createdAt: notification.createdAt, isRead: false,
        });
      }
    }

    // Email delivery for important events
    if (email) {
      const player = await Player.findById(playerId).select('email username');
      if (player?.email) {
        const { sendNotificationEmail } = require('../mailer');
        sendNotificationEmail(player.email, title, message).catch(err =>
          logger.error('[notify] Email send failed:', err.message)
        );
      }
    }

    return notification;
  } catch (err) {
    logger.error('[notify] Failed to create notification:', err.message);
    return null;
  }
}

// ── Admin-activity feed: notify all currently-online admins ────────────────────
async function notifyAdmins(io, { title, message, icon = '🛠️', meta = {} }) {
  try {
    const { ADMIN_IDS } = require('../middleware/auth');
    const admins = await Player.find({
      $or: [{ _id: { $in: ADMIN_IDS } }, { role: 'admin' }],
    }).select('_id');

    const activeIo = io || ioInstance;
    for (const admin of admins) {
      await Notification.create({ playerId: admin._id, type: 'admin_activity', title, message, icon, meta });
      if (activeIo && getPlayerSocketId) {
        const socketId = getPlayerSocketId(admin._id.toString());
        if (socketId) activeIo.to(socketId).emit('notification', { type: 'admin_activity', title, message, icon, meta, createdAt: new Date(), isRead: false });
      }
    }
  } catch (err) {
    logger.error('[notifyAdmins] Failed:', err.message);
  }
}

module.exports = notify;
module.exports.initNotify = initNotify;
module.exports.notifyAdmins = notifyAdmins;
