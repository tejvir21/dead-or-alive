/**
 * utils/subscriptionExpiry.js — Daily cron job
 * Requires: npm install node-cron
 *
 * Two jobs, run once daily:
 *   1. Reminder — notify players whose subscription expires in exactly 3 days
 *      (only once per payment, tracked via expiryReminderSentAt)
 *   2. Auto-downgrade — when a subscription's expiresAt has passed, revert
 *      the player to the free tier (Option A: manual renewal, no auto-charge)
 *
 * Wire this up in index.js:
 *   const { startExpiryCron } = require('./utils/subscriptionExpiry');
 *   startExpiryCron(io);
 */
const cron = require('node-cron');
const Player = require('../models/Player');
const Payment = require('../models/Payment');
const notify = require('./notify');
const logger = require('./logger');

async function sendExpiryReminders(io) {
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const fourDaysFromNow  = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

  // Find active payments expiring in the 3-4 day window that haven't been reminded yet
  const expiringPayments = await Payment.find({
    status: 'paid',
    subscriptionEnd: { $gte: threeDaysFromNow, $lt: fourDaysFromNow },
    expiryReminderSentAt: null,
  }).populate('playerId', 'username email subscription');

  for (const payment of expiringPayments) {
    const player = payment.playerId;
    if (!player) continue;
    // Skip if they've since upgraded/renewed (their current expiry no longer matches this payment)
    if (player.subscription?.plan !== payment.plan) continue;

    await notify(io, player._id, {
      type: 'generic',
      title: `⏰ Your ${payment.plan.toUpperCase()} expires soon`,
      message: `Your ${payment.plan.toUpperCase()} subscription expires on ${payment.subscriptionEnd.toLocaleDateString('en-IN')}. Renew now to keep your perks.`,
      icon: '⏰',
      meta: { plan: payment.plan, expiresAt: payment.subscriptionEnd },
      email: true,
    });

    payment.expiryReminderSentAt = new Date();
    await payment.save();
  }

  if (expiringPayments.length > 0) {
    logger.info(`[subscriptionExpiry] Sent ${expiringPayments.length} expiry reminder(s)`);
  }
}

async function downgradeExpiredSubscriptions(io) {
  const now = new Date();

  // Find players whose subscription has expired but are still marked active
  const expired = await Player.find({
    'subscription.expiresAt': { $lt: now },
    'subscription.plan': { $in: ['pro', 'elite'] },
    'subscription.status': 'active',
  });

  for (const player of expired) {
    await Player.findByIdAndUpdate(player._id, {
      'subscription.plan': 'free',
      'subscription.status': 'expired',
    });

    await notify(io, player._id, {
      type: 'generic',
      title: 'Subscription Expired',
      message: `Your ${player.subscription.plan.toUpperCase()} subscription has expired. Renew anytime from your profile to restore your perks.`,
      icon: '📉',
      email: true,
    });
  }

  if (expired.length > 0) {
    logger.info(`[subscriptionExpiry] Downgraded ${expired.length} expired subscription(s)`);
  }
}

function startExpiryCron(io) {
  // Runs once daily at 09:00 server time
  cron.schedule('0 9 * * *', async () => {
    try {
      await sendExpiryReminders(io);
      await downgradeExpiredSubscriptions(io);
    } catch (err) {
      logger.error('[subscriptionExpiry] Cron job failed:', err);
    }
  });

  logger.info('[subscriptionExpiry] Daily cron scheduled (09:00)');
}

module.exports = { startExpiryCron, sendExpiryReminders, downgradeExpiredSubscriptions };
