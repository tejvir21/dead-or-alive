/**
 * utils/playerTier.js — the dynamic replacement for hardcoded
 * 'pro'/'elite' checks scattered across the codebase.
 *
 * Old pattern (breaks for any plan beyond pro/elite):
 *   function getPlayerTier(player) {
 *     if (player.subscription?.plan === 'elite') return 'elite';
 *     if (player.subscription?.plan === 'pro')   return 'pro';
 *     if (player.isVerified) return 'verified';
 *     return 'free';
 *   }
 *
 * New pattern: trust whatever plan name is actually stored, so a brand
 * new plan (e.g. "premium") works immediately with zero code changes —
 * as long as GameSettings.tiers has a matching entry (which
 * ensureTierForPlan() guarantees gets created whenever a plan is added).
 */

/**
 * @param {Object} player - a Player document (or plain object with the
 *   same shape) — needs .subscription?.plan and .isVerified
 * @returns {String} the tier name — could be 'free', 'verified', or any
 *   dynamic plan name from GameSettings.subscriptionPlans
 */
function getPlayerTier(player) {
  const plan = player?.subscription?.plan;
  // FIX: subscription.plan is very likely stored as the literal string
  // 'free' by default (a common Mongoose pattern), not null/undefined.
  // The string 'free' is truthy — `if (plan)` alone would return 'free'
  // immediately and never check isVerified, meaning a verified player
  // with no PAID subscription would always show as Free regardless of
  // their actual verification status. Explicitly excluding 'free' here
  // lets execution fall through to the isVerified check below, same as
  // if the field were genuinely empty.
  if (plan && plan !== 'free') return plan;
  if (player?.isVerified) return 'verified';
  return 'free';
}

/**
 * Look up a tier's settings bucket from GameSettings, with a safe
 * fallback to 'free' if somehow the tier has no entry (e.g. a plan was
 * deleted but a player is still subscribed to it, or ensureTierForPlan
 * was never called for some reason — defensive, not the normal path).
 *
 * @param {Object} settings - a GameSettings document (already fetched
 *   via GameSettings.getSingleton())
 * @param {String} tierName
 * @returns {Object} the tier's settings — dailyCreate, dailyJoin,
 *   autoStartMin/Max, maxPlayers, canCreateClan, ownedClansLimit,
 *   betaAccess, unlockedCurves
 */
function getTierSettings(settings, tierName) {
  const tier = settings.tiers.get(tierName);
  if (tier) return tier;

  // Fallback — should be rare. Logs so it's visible in Error Logs if it
  // ever actually happens (e.g. data integrity issue, orphaned plan).
  const logger = require('./logger');
  logger.error('[playerTier] No tier settings found, falling back to free', { tierName });
  return settings.tiers.get('free') || {
    dailyCreate: 3, dailyJoin: 10, autoStartMin: 180, autoStartMax: 180,
    maxPlayers: 16, canCreateClan: false, ownedClansLimit: 0,
    betaAccess: 'none', unlockedCurves: ['stepped'],
  };
}

/**
 * Convenience — resolves both tier name AND settings in one call, the
 * most common thing callers actually need.
 */
function resolvePlayerTier(player, settings) {
  const tierName = getPlayerTier(player);
  return { tierName, tierSettings: getTierSettings(settings, tierName) };
}

module.exports = { getPlayerTier, getTierSettings, resolvePlayerTier };
