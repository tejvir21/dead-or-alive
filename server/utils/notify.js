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

// DEFENSIVE: push is a supplementary channel — it must NEVER be able to
// crash this file. Every notification in the entire app (ban, verify,
// gift, kicks, game results, clan battles, broadcast, everything) routes
// through notify() below. If web-push isn't installed yet, or
// models/PushSubscription.js doesn't exist yet, requiring './webPush'
// directly at the top of this file would throw at MODULE LOAD TIME —
// which crashes the whole process on the very first notify() call
// anywhere, not just wherever push was intended to fire. Wrapping in
// try/catch here means a missing optional dependency degrades to
// "push silently doesn't happen" instead of "the entire app goes down."
let sendPushToPlayer = async () => {};
try {
  ({ sendPushToPlayer } = require('./webPush'));
} catch (err) {
  logger.error('[notify] Push notifications unavailable — webPush.js failed to load:', { message: err.message });
}

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

    // Push delivery (works even if the tab's closed) — fire-and-forget,
    // never blocks or throws back to the caller. Fires regardless of
    // online status: the whole point of push is reaching someone who
    // ISN'T actively looking at an open tab right now.
    sendPushToPlayer(playerId, {
      title: title || 'Dead or Alive',
      body: message || '',
      url: meta?.roomCode ? `/game/${meta.roomCode}` : meta?.battleId ? '/clans' : '/lobby',
      tag: type || 'general',
    }).catch(() => {});

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
