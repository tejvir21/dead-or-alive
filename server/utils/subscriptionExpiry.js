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
  const fourDaysFromNow = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

  // Find active payments expiring in the 3-4 day window that haven't been reminded yet
  const expiringPayments = await Payment.find({
    status: 'paid',
    subscriptionEnd: { $gte: threeDaysFromNow, $lt: fourDaysFromNow },
    expiryReminderSentAt: null,
  }).populate('playerId', 'username email subscription');

  for (const payment of expiringPayments) {
    const player = payment.playerId;

    // Skip if player doesn't exist
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

async function sendExpiredReminders(io) {
  const oneDaysBeforeExpired = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
  const currentDate = new Date(Date.now());

  // Find active payments expired that haven't been reminded 1 day after last reminder
  const expiredPayments = await Payment.find({
    status: 'paid',
    subscriptionEnd: { $lt: currentDate },
    $or: [
      { expiryReminderSentAt: { $lt: oneDaysBeforeExpired } },
      { expiryReminderSentAt: { $exists: false } },
    ],
  }).populate('playerId', 'username email subscription');

  for (const payment of expiredPayments) {
    const player = payment.playerId;

    // Skip if player doesn't exist
    if (!player) continue;

    // Skip if they've since upgraded/renewed (their current expiry no longer matches this payment)
    if (player.subscription?.plan !== payment.plan) continue;

    await notify(io, player._id, {
      type: 'generic',
      title: `⏰ Your ${payment.plan.toUpperCase()} expired`,
      message: `Your ${payment.plan.toUpperCase()} subscription expired on ${payment.subscriptionEnd.toLocaleDateString('en-IN')}. Renew now to keep your perks.`,
      icon: '⏰',
      meta: { plan: payment.plan, expiresAt: payment.subscriptionEnd },
      email: true,
    });

    payment.expiryReminderSentAt = new Date();
    await payment.save();
  }

  if (expiredPayments.length > 0) {
    logger.info(`[subscriptionExpiredRemainder] Sent ${expiredPayments.length} expired reminder(s)`);
  }
}

async function removeExpiredSubscriptions(io) {
  const currentDate = new Date(Date.now());

  // Find active payments expired that haven't been reminded 1 day after last reminder
  const expiredPayments = await Payment.find({
    status: 'paid',
    $or: [
      { subscriptionEnd: { $lt: currentDate } },
      { subscriptionEnd: { $exists: false } },
      { subscriptionEnd: null },
    ],
    // subscriptionEnd: { $lt: currentDate },
  }).populate('playerId', 'username email subscription');


  // Find gift subscriptions that have expired
  const expiredGiftSubscriptions = await Player.find({
    'subscription.endDate': { $lt: currentDate },
    'subscription.status': 'gifted',
  });

  // Downgrade expired gift subscriptions to free
  for (const subscription of expiredGiftSubscriptions) {

    // Send the reminder
    await notify(io, subscription._id, {
      type: 'generic',
      title: `⏰ Your ${subscription.subscription.plan.toUpperCase()} expired`,
      message: `Your ${subscription.subscription.plan.toUpperCase()} subscription expired on ${subscription.subscription.endDate.toLocaleDateString('en-IN')}. Renew now to keep your perks.`,
      icon: '⏰',
      meta: { plan: subscription.subscription.plan, expiresAt: subscription.subscription.endDate },
      email: true,
    });

    // Downgrade the player to free
    await Player.findByIdAndUpdate(subscription._id, {
      'subscription': {
        plan: 'free',
        status: 'inactive'
      },
    });
  }

  // Send expiry reminders for expired subscriptions
  for (const payment of expiredPayments) {
    const player = payment.playerId;

    // Skip if player doesn't exist
    if (!player) continue;

    // Skip if they've since upgraded/renewed (their current expiry no longer matches this payment)
    if (player.subscription?.plan !== payment.plan) continue;

    // Downgrade the player to free
    await Player.findByIdAndUpdate(player._id, {
      'subscription': {
        plan: 'free',
      },
    });

    // Send the reminder
    await notify(io, player._id, {
      type: 'generic',
      title: `⏰ Your ${payment.plan.toUpperCase()} expired`,
      message: `Your ${payment.plan.toUpperCase()} subscription expired on ${payment.subscriptionEnd.toLocaleDateString('en-IN')}. Renew now to keep your perks.`,
      icon: '⏰',
      meta: { plan: payment.plan, expiresAt: payment.subscriptionEnd },
      email: true,
    });

    payment.expiryReminderSentAt = new Date();
    await payment.save();
  }
}

function startExpiryCron(io) {

  // Run immediately on server start
  try {
    sendExpiryReminders(io).catch(err => logger.error('[subscriptionExpiry] Initial reminder check failed:', err));
    sendExpiredReminders(io).catch(err => logger.error('[subscriptionExpired] Initial reminder check failed:', err));
    downgradeExpiredSubscriptions(io).catch(err => logger.error('[subscriptionExpiry] Initial downgrade check failed:', err));
    removeExpiredSubscriptions(io).catch(err => logger.error('[subscriptionExpiry] Initial removal check failed:', err));
  } catch (err) {
    logger.error('[subscriptionExpiry] Initial cron job failed:', err);
  }

  logger.info('[subscriptionExpiry] Daily cron started');

  // Runs once daily at 09:00 server time
  cron.schedule('0 9 * * *', async () => {
    try {
      sendExpiryReminders(io).catch(err => logger.error('[subscriptionExpiry] Initial reminder check failed:', err));
      sendExpiredReminders(io).catch(err => logger.error('[subscriptionExpired] Initial reminder check failed:', err));
      downgradeExpiredSubscriptions(io).catch(err => logger.error('[subscriptionExpiry] Initial downgrade check failed:', err));
      removeExpiredSubscriptions(io).catch(err => logger.error('[subscriptionExpiry] Initial removal check failed:', err));
    } catch (err) {
      logger.error('[subscriptionExpiry] Cron job failed:', err);
    }
  });

  logger.info('[subscriptionExpiry] Daily cron scheduled (09:00)');
}

module.exports = { startExpiryCron, sendExpiryReminders, downgradeExpiredSubscriptions };
