/**
 * utils/clanPeriodReset.js — Weekly/monthly clan leaderboard reset
 * Requires: npm install node-cron (already installed if you did Phase 3 payments)
 *
 * Self-healing: runs daily and checks whether each period has actually
 * rolled over yet (comparing periodStart to now), rather than relying on
 * the cron firing at an exact boundary moment. Safe even if the server
 * was down across a reset boundary.
 */
const cron = require('node-cron');
const Clan = require('../models/Clan');
const logger = require('./logger');

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getUTCDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start of week
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(d = new Date()) {
  const date = new Date(d);
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

async function resetExpiredPeriods() {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const weeklyResult = await Clan.updateMany(
    { 'statsWeekly.periodStart': { $lt: weekStart } },
    { $set: { 'statsWeekly.matches': 0, 'statsWeekly.wins': 0, 'statsWeekly.roomsSurvived': 0, 'statsWeekly.periodStart': weekStart } }
  );

  const monthlyResult = await Clan.updateMany(
    { 'statsMonthly.periodStart': { $lt: monthStart } },
    { $set: { 'statsMonthly.matches': 0, 'statsMonthly.wins': 0, 'statsMonthly.roomsSurvived': 0, 'statsMonthly.periodStart': monthStart } }
  );

  if (weeklyResult.modifiedCount > 0 || monthlyResult.modifiedCount > 0) {
    logger.info(`[clanPeriodReset] Weekly reset: ${weeklyResult.modifiedCount} clan(s). Monthly reset: ${monthlyResult.modifiedCount} clan(s).`);
  }
}

function startClanPeriodResetCron() {
  // Runs once daily at 00:05 UTC — checks and resets any period that has
  // rolled over since the last check (self-healing, see doc comment above)
  cron.schedule('5 0 * * *', async () => {
    try { await resetExpiredPeriods(); }
    catch (err) { logger.error('[clanPeriodReset] Cron job failed:', { message: err.message }); }
  });
  logger.info('[clanPeriodReset] Daily cron scheduled (00:05 UTC)');
}

module.exports = { startClanPeriodResetCron, resetExpiredPeriods };
