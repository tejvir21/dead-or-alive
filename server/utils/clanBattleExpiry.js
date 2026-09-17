/**
 * utils/clanBattleExpiry.js — Two jobs, run hourly:
 *   1. Expire unaccepted challenges older than clanBattleSettings.challengeExpiryDays
 *   2. Finalize battles whose battleWindowHours has elapsed — computes each
 *      clan's aggregate score, declares a winner (or draw), updates clan
 *      stats (all-time + weekly + monthly), notifies every participant.
 *
 * Wire into index.js:
 *   const { startClanBattleExpiryCron } = require('./utils/clanBattleExpiry');
 *   startClanBattleExpiryCron(io);
 */
const cron = require('node-cron');
const ClanChallenge = require('../models/ClanChallenge');
const ClanBattle = require('../models/ClanBattle');
const Clan = require('../models/Clan');
const GameSettings = require('../models/GameSettings');
const notify = require('./notify');
const logger = require('./logger');

async function expireStaleChallenges() {
  const settings = await GameSettings.getSingleton();
  const days = settings.clanBattleSettings?.challengeExpiryDays ?? 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const result = await ClanChallenge.updateMany(
    { status: 'pending', createdAt: { $lt: cutoff } },
    { $set: { status: 'expired' } }
  );

  if (result.modifiedCount > 0) {
    logger.info(`[clanBattleExpiry] Expired ${result.modifiedCount} stale challenge(s) (older than ${days}d)`);
  }
}

async function finalizeExpiredBattles(io) {
  const now = new Date();
  const battles = await ClanBattle.find({ status: 'active', expiresAt: { $lt: now } });

  for (const battle of battles) {
    try {
      const clanAScore = battle.computeClanScore(battle.clanAId);
      const clanBScore = battle.computeClanScore(battle.clanBId);

      let winnerClanId = null;
      if (clanAScore > clanBScore) winnerClanId = battle.clanAId;
      else if (clanBScore > clanAScore) winnerClanId = battle.clanBId;
      // else: exact tie → draw, winnerClanId stays null

      battle.status = 'completed';
      battle.clanAScore = clanAScore;
      battle.clanBScore = clanBScore;
      battle.winnerClanId = winnerClanId;
      battle.completedAt = now;
      await battle.save();

      const [clanA, clanB] = await Promise.all([Clan.findById(battle.clanAId), Clan.findById(battle.clanBId)]);
      if (!clanA || !clanB) continue;

      // Update clan stats (all-time + weekly + monthly) — mirrors the
      // live vs-mode team stat update pattern for consistency
      const roomsSurvivedA = battle.runs.filter(r => r.clanId.toString() === clanA._id.toString()).reduce((s, r) => s + r.roomsSurvived, 0);
      const roomsSurvivedB = battle.runs.filter(r => r.clanId.toString() === clanB._id.toString()).reduce((s, r) => s + r.roomsSurvived, 0);
      const aWon = winnerClanId && winnerClanId.toString() === clanA._id.toString();
      const bWon = winnerClanId && winnerClanId.toString() === clanB._id.toString();

      await Promise.all([
        Clan.findByIdAndUpdate(clanA._id, { $inc: {
          'stats.totalMatches': 1, 'stats.totalWins': aWon ? 1 : 0, 'stats.totalRoomsSurvived': roomsSurvivedA,
          'statsWeekly.matches': 1, 'statsWeekly.wins': aWon ? 1 : 0, 'statsWeekly.roomsSurvived': roomsSurvivedA,
          'statsMonthly.matches': 1, 'statsMonthly.wins': aWon ? 1 : 0, 'statsMonthly.roomsSurvived': roomsSurvivedA,
        }}),
        Clan.findByIdAndUpdate(clanB._id, { $inc: {
          'stats.totalMatches': 1, 'stats.totalWins': bWon ? 1 : 0, 'stats.totalRoomsSurvived': roomsSurvivedB,
          'statsWeekly.matches': 1, 'statsWeekly.wins': bWon ? 1 : 0, 'statsWeekly.roomsSurvived': roomsSurvivedB,
          'statsMonthly.matches': 1, 'statsMonthly.wins': bWon ? 1 : 0, 'statsMonthly.roomsSurvived': roomsSurvivedB,
        }}),
      ]);

      // Notify every member of both clans
      const resultText = winnerClanId
        ? `${winnerClanId.toString() === clanA._id.toString() ? clanA.tag : clanB.tag} wins ${clanAScore} - ${clanBScore}!`
        : `Draw — ${clanAScore} - ${clanBScore}`;

      const allMembers = [...clanA.members, ...clanB.members];
      for (const m of allMembers) {
        notify(io, m.playerId, {
          type: 'generic', title: '⚔ Clan Battle Complete!',
          message: `${clanA.tag} vs ${clanB.tag}: ${resultText}`,
          icon: '⚔', meta: { battleId: battle._id, clanAScore, clanBScore, winnerClanId },
        }).catch(() => {});
      }

      logger.info(`[clanBattleExpiry] Finalized battle ${battle._id}: ${clanA.tag} ${clanAScore} - ${clanBScore} ${clanB.tag}`);
    } catch (err) {
      logger.error('[clanBattleExpiry] Failed to finalize battle:', { battleId: battle._id.toString(), message: err.message });
    }
  }
}

function startClanBattleExpiryCron(io) {
  // Runs hourly — both jobs are idempotent and cheap to re-check
  cron.schedule('0 * * * *', async () => {
    try {
      await expireStaleChallenges();
      await finalizeExpiredBattles(io);
    } catch (err) {
      logger.error('[clanBattleExpiry] Cron job failed:', { message: err.message });
    }
  });
  logger.info('[clanBattleExpiry] Hourly cron scheduled');
}

module.exports = { startClanBattleExpiryCron, expireStaleChallenges, finalizeExpiredBattles };
