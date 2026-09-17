/**
 * utils/webPush.js — thin wrapper around the `web-push` library
 *
 * Requires VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT in .env
 * (see PUSH_NOTIFICATIONS_SETUP.md for the actual generated keys).
 *
 * DEFENSIVE BY DESIGN: both requires below are wrapped, not top-level
 * unconditional requires. If `web-push` isn't installed yet, or
 * models/PushSubscription.js doesn't exist yet, this file still loads
 * successfully — every function below just becomes a safe no-op instead
 * of throwing. This matters because notify.js (used by nearly every
 * route in the app) requires this file; an unconditional require here
 * previously meant a missing optional dependency could crash the entire
 * server on the very first notification sent, anywhere.
 */
const logger = require('./logger');

let webpush = null;
try {
  webpush = require('web-push');
} catch (err) {
  logger.error('[webPush] The "web-push" package is not installed — push notifications disabled. Run: npm install web-push');
}

let PushSubscription = null;
try {
  PushSubscription = require('../models/PushSubscription');
} catch (err) {
  logger.error('[webPush] models/PushSubscription.js not found — push notifications disabled.');
}

const available = !!(webpush && PushSubscription);

let configured = false;
function ensureConfigured() {
  if (!available || configured) return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    logger.error('[webPush] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — push notifications disabled');
    return;
  }
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    configured = true;
  } catch (err) {
    logger.error('[webPush] Failed to configure VAPID details:', { message: err.message });
  }
}

/**
 * Send a push notification to every subscription a player has registered
 * (multiple devices/browsers all get it). Silently no-ops if push isn't
 * available/configured, or the player has no subscriptions — this is a
 * supplementary channel, never a blocking dependency for anything else.
 *
 * @param {String} playerId
 * @param {Object} payload — { title, body, icon, url, tag }
 */
async function sendPushToPlayer(playerId, payload) {
  if (!available) return; // web-push or PushSubscription missing — no-op, not an error
  ensureConfigured();
  if (!configured) return;

  try {
    const subs = await PushSubscription.find({ playerId });
    if (subs.length === 0) return;

    const body = JSON.stringify({
      title: payload.title || 'Dead or Alive',
      body: payload.body || '',
      icon: payload.icon || '/icon-192.png',
      url: payload.url || '/lobby',
      tag: payload.tag || 'general',
    });

    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body);
      } catch (err) {
        // 410 Gone / 404 = subscription is dead (browser unsubscribed,
        // uninstalled, etc.) — clean it up rather than retrying forever
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
        } else {
          logger.error('[webPush] Send failed:', { message: err.message, statusCode: err.statusCode });
        }
      }
    }));
  } catch (err) {
    logger.error('[webPush] sendPushToPlayer failed:', { message: err.message, playerId: playerId?.toString() });
  }
}

/**
 * Send to many players at once (e.g. broadcast) — fires all sends
 * concurrently rather than sequentially awaiting each player
 */
async function sendPushToPlayers(playerIds, payload) {
  await Promise.all(playerIds.map(id => sendPushToPlayer(id, payload)));
}

module.exports = { sendPushToPlayer, sendPushToPlayers };
