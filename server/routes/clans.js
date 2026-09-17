/**
 * routes/clans.js — Full clan CRUD + membership + leaderboard + async battles
 *
 * Challenge SEND/LIST/battle-viewing here (REST) — no live session needed.
 * Challenge ACCEPT/DECLINE, queue JOIN/LEAVE, and starting an individual
 * battle run are socket events in socketHandlers.js, since accepting
 * immediately creates a ClanBattle (needs `io` for notifications) and
 * starting a run needs the in-memory activeSessions map.
 */
const express = require('express');
const router  = express.Router();
const Clan = require('../models/Clan');
const ClanJoinRequest = require('../models/ClanJoinRequest');
const ClanChallenge = require('../models/ClanChallenge');
const ClanBattle = require('../models/ClanBattle');
const Player = require('../models/Player');
const GameSettings = require('../models/GameSettings');
const { protect, adminOnly } = require('../middleware/auth');
const notify = require('../utils/notify');
const logger = require('../utils/logger');

function getPlayerTier(player) {
  const plan = player.subscription?.plan;
  if (plan === 'elite') return 'elite';
  if (plan === 'pro')   return 'pro';
  if (player.isVerified) return 'verified';
  return 'free';
}

function safeMember(m) { return { playerId: m.playerId, role: m.role, joinedAt: m.joinedAt }; }

function safeClan(clan) {
  return {
    _id: clan._id, name: clan.name, tag: clan.tag, description: clan.description,
    badge: clan.badge, ownerId: clan.ownerId, joinPolicy: clan.joinPolicy,
    maxMembers: clan.maxMembers, memberCount: clan.members.length,
    members: clan.members.map(safeMember), stats: clan.stats,
    statsWeekly: clan.statsWeekly, statsMonthly: clan.statsMonthly,
    createdAt: clan.createdAt,
  };
}

// NOTE: never includes roomSequence — that has correctDoor answers baked
// in and would let players preview answers before playing their own run.
function safeBattle(battle) {
  return {
    _id: battle._id, clanAId: battle.clanAId, clanBId: battle.clanBId,
    status: battle.status, startedAt: battle.startedAt, expiresAt: battle.expiresAt,
    scoringMode: battle.scoringMode,
    runs: battle.runs.map(r => ({ playerId: r.playerId, clanId: r.clanId, username: r.username, roomsSurvived: r.roomsSurvived, completedAt: r.completedAt })),
    winnerClanId: battle.winnerClanId, clanAScore: battle.clanAScore, clanBScore: battle.clanBScore,
    completedAt: battle.completedAt, totalRooms: Array.isArray(battle.roomSequence) ? battle.roomSequence.length : undefined,
  };
}

router.get('/', protect, async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const filter = search ? { $or: [{ name: new RegExp(search, 'i') }, { tag: new RegExp(search, 'i') }] } : {};
  const [clans, total] = await Promise.all([
    Clan.find(filter).sort({ 'stats.totalWins': -1, createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
    Clan.countDocuments(filter),
  ]);
  res.json({ clans: clans.map(safeClan), total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

router.get('/leaderboard', protect, async (req, res) => {
  try {
    const { metric = 'wins', period = 'alltime' } = req.query;
    const statsField = period === 'weekly' ? 'statsWeekly' : period === 'monthly' ? 'statsMonthly' : 'stats';
    let allClans = await Clan.find({}).select(`name tag badge ${statsField}`).lean();

    const withMetric = allClans.map(c => {
      const s = c[statsField] || {};
      const wins    = period === 'alltime' ? (s.totalWins || 0) : (s.wins || 0);
      const matches = period === 'alltime' ? (s.totalMatches || 0) : (s.matches || 0);
      const rooms   = period === 'alltime' ? (s.totalRoomsSurvived || 0) : (s.roomsSurvived || 0);
      const winRate = matches > 0 ? wins / matches : 0;
      const value = metric === 'winRate' ? winRate : metric === 'roomsSurvived' ? rooms : wins;
      return { _id: c._id, name: c.name, tag: c.tag, badge: c.badge, wins, matches, rooms, winRate: Math.round(winRate * 1000) / 10, value };
    }).filter(c => metric !== 'winRate' || c.matches > 0);

    withMetric.sort((a, b) => b.value - a.value);
    const top10 = withMetric.slice(0, 10);

    const myClan = await Clan.findOne({ 'members.playerId': req.player._id }).select('_id');
    let myRank = null;
    if (myClan) {
      const idx = withMetric.findIndex(c => c._id.toString() === myClan._id.toString());
      if (idx !== -1) myRank = { rank: idx + 1, ...withMetric[idx] };
    }
    res.json({ metric, period, top10, myRank, totalClans: withMetric.length });
  } catch (err) {
    logger.error('[clans] Leaderboard error:', { message: err.message });
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

router.get('/mine', protect, async (req, res) => {
  const clans = await Clan.find({ 'members.playerId': req.player._id });
  res.json({ clans: clans.map(c => ({ ...safeClan(c), myRole: c.getRole(req.player._id) })) });
});

router.get('/:id', protect, async (req, res) => {
  const clan = await Clan.findById(req.params.id).populate('members.playerId', 'username displayName avatar isVerified subscription.plan isOnline');
  if (!clan) return res.status(404).json({ error: 'Clan not found' });
  res.json({
    clan: {
      ...safeClan(clan),
      members: clan.members.map(m => ({
        playerId: m.playerId._id, username: m.playerId.username, displayName: m.playerId.displayName,
        avatar: m.playerId.avatar, isVerified: m.playerId.isVerified, isOnline: m.playerId.isOnline,
        plan: m.playerId.subscription?.plan, role: m.role, joinedAt: m.joinedAt,
      })),
    },
    myRole: clan.getRole(req.player._id),
  });
});

router.post('/', protect, async (req, res) => {
  try {
    const { name, tag, description, badge, joinPolicy } = req.body;
    if (!name?.trim() || name.trim().length < 3) return res.status(400).json({ error: 'Clan name must be at least 3 characters' });
    if (!tag?.trim() || !/^[A-Za-z0-9]{2,5}$/.test(tag.trim())) return res.status(400).json({ error: 'Tag must be 2-5 letters/numbers' });

    const settings = await GameSettings.getSingleton();
    const fresh = await Player.findById(req.player._id);
    const tier = getPlayerTier(fresh);

    if (!settings.clanSettings.creationTiers.includes(tier)) {
      return res.status(403).json({ error: `Only ${settings.clanSettings.creationTiers.join('/').toUpperCase()} subscribers can create a clan. Upgrade to create your own.` });
    }
    const ownedLimit = settings.clanSettings.ownedClansLimit[tier] ?? 0;
    const ownedCount = await Clan.countDocuments({ ownerId: req.player._id });
    if (ownedCount >= ownedLimit) {
      return res.status(403).json({ error: `You've reached your limit of ${ownedLimit} clan(s) for the ${tier.toUpperCase()} tier.` });
    }
    const existing = await Clan.findOne({ $or: [{ name: name.trim() }, { tag: tag.trim().toUpperCase() }] });
    if (existing) return res.status(409).json({ error: 'A clan with that name or tag already exists' });

    const clan = await Clan.create({
      name: name.trim(), tag: tag.trim().toUpperCase(), description: description || '',
      badge: badge || '🛡️', joinPolicy: joinPolicy === 'invite_only' ? 'invite_only' : 'open',
      ownerId: req.player._id, maxMembers: settings.clanSettings.maxMembersPerClan,
      members: [{ playerId: req.player._id, role: 'owner' }],
    });
    res.status(201).json({ clan: safeClan(clan) });
  } catch (err) {
    logger.error('[clans] Create failed:', { message: err.message });
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', protect, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    const role = clan.getRole(req.player._id);
    if (!['owner', 'admin'].includes(role)) return res.status(403).json({ error: 'Only clan owner/admin can edit clan info' });
    const allowed = ['description', 'badge', 'joinPolicy'];
    for (const k of allowed) if (req.body[k] !== undefined) clan[k] = req.body[k];
    await clan.save();
    res.json({ clan: safeClan(clan) });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/:id/join', protect, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    if (clan.isMember(req.player._id)) return res.status(400).json({ error: 'Already a member' });
    if (clan.members.length >= clan.maxMembers) return res.status(400).json({ error: 'Clan is full' });
    const alreadyInAnother = await Clan.findOne({ 'members.playerId': req.player._id });
    if (alreadyInAnother) return res.status(400).json({ error: 'You must leave your current clan before joining another' });

    if (clan.joinPolicy === 'invite_only') {
      const existingReq = await ClanJoinRequest.findOne({ clanId: clan._id, playerId: req.player._id, status: 'pending' });
      if (existingReq) return res.status(409).json({ error: 'You already have a pending request for this clan' });
      const request = await ClanJoinRequest.create({ clanId: clan._id, playerId: req.player._id, username: req.player.username, message: req.body.message || '' });
      const io = req.app.get('io');
      const notifyTargets = clan.members.filter(m => ['owner', 'admin'].includes(m.role));
      for (const m of notifyTargets) notify(io, m.playerId, { type: 'generic', title: `New join request for ${clan.name}`, message: `${req.player.username} wants to join ${clan.tag}.`, icon: '🛡️' }).catch(() => {});
      return res.status(201).json({ message: 'Join request submitted — awaiting approval', request });
    }
    clan.members.push({ playerId: req.player._id, role: 'member' });
    await clan.save();
    res.json({ clan: safeClan(clan) });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/:id/requests', protect, async (req, res) => {
  const clan = await Clan.findById(req.params.id);
  if (!clan) return res.status(404).json({ error: 'Clan not found' });
  const role = clan.getRole(req.player._id);
  if (!['owner', 'admin'].includes(role)) return res.status(403).json({ error: 'Not authorized' });
  const requests = await ClanJoinRequest.find({ clanId: clan._id, status: 'pending' }).sort({ createdAt: -1 });
  res.json({ requests });
});

router.post('/:id/requests/:reqId/approve', protect, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    const role = clan.getRole(req.player._id);
    if (!['owner', 'admin'].includes(role)) return res.status(403).json({ error: 'Not authorized' });
    if (clan.members.length >= clan.maxMembers) return res.status(400).json({ error: 'Clan is full' });
    const joinReq = await ClanJoinRequest.findById(req.params.reqId);
    if (!joinReq || joinReq.status !== 'pending') return res.status(404).json({ error: 'Request not found or already resolved' });
    joinReq.status = 'approved'; joinReq.resolvedBy = req.player._id; joinReq.resolvedAt = new Date();
    await joinReq.save();
    if (!clan.isMember(joinReq.playerId)) clan.members.push({ playerId: joinReq.playerId, role: 'member' });
    await clan.save();
    notify(req.app.get('io'), joinReq.playerId, { type: 'generic', title: `Welcome to ${clan.name}!`, message: `Your request to join ${clan.tag} was approved.`, icon: '🛡️' }).catch(() => {});
    res.json({ message: 'Approved', clan: safeClan(clan) });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/:id/requests/:reqId/reject', protect, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    const role = clan.getRole(req.player._id);
    if (!['owner', 'admin'].includes(role)) return res.status(403).json({ error: 'Not authorized' });
    const joinReq = await ClanJoinRequest.findById(req.params.reqId);
    if (!joinReq || joinReq.status !== 'pending') return res.status(404).json({ error: 'Request not found or already resolved' });
    joinReq.status = 'rejected'; joinReq.resolvedBy = req.player._id; joinReq.resolvedAt = new Date();
    await joinReq.save();
    res.json({ message: 'Rejected' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/:id/leave', protect, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    const role = clan.getRole(req.player._id);
    if (!role) return res.status(400).json({ error: 'Not a member of this clan' });
    if (role === 'owner') {
      const nextOwner = clan.members.find(m => m.role === 'admin') || clan.members.find(m => m.playerId.toString() !== req.player._id.toString());
      if (!nextOwner) { await Clan.findByIdAndDelete(clan._id); return res.json({ message: 'You were the last member — clan disbanded' }); }
      nextOwner.role = 'owner';
      clan.ownerId = nextOwner.playerId;
    }
    clan.members = clan.members.filter(m => m.playerId.toString() !== req.player._id.toString());
    await clan.save();
    res.json({ message: 'Left clan' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/:id/kick/:playerId', protect, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    const myRole = clan.getRole(req.player._id);
    const targetRole = clan.getRole(req.params.playerId);
    if (!['owner', 'admin'].includes(myRole)) return res.status(403).json({ error: 'Not authorized' });
    if (targetRole === 'owner') return res.status(400).json({ error: 'Cannot kick the owner' });
    if (myRole === 'admin' && targetRole === 'admin') return res.status(403).json({ error: 'Admins cannot kick other admins — only the owner can' });
    clan.members = clan.members.filter(m => m.playerId.toString() !== req.params.playerId);
    await clan.save();
    notify(req.app.get('io'), req.params.playerId, { type: 'generic', title: 'Removed from clan', message: `You were removed from ${clan.name}.`, icon: '🚪' }).catch(() => {});
    res.json({ message: 'Member removed', clan: safeClan(clan) });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/:id/promote/:playerId', protect, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    if (clan.getRole(req.player._id) !== 'owner') return res.status(403).json({ error: 'Only the owner can promote members' });
    const member = clan.members.find(m => m.playerId.toString() === req.params.playerId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    member.role = 'admin';
    await clan.save();
    notify(req.app.get('io'), req.params.playerId, { type: 'generic', title: 'Promoted to Admin', message: `You're now an admin of ${clan.name}!`, icon: '⭐' }).catch(() => {});
    res.json({ clan: safeClan(clan) });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/:id/demote/:playerId', protect, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    if (clan.getRole(req.player._id) !== 'owner') return res.status(403).json({ error: 'Only the owner can demote admins' });
    const member = clan.members.find(m => m.playerId.toString() === req.params.playerId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    member.role = 'member';
    await clan.save();
    res.json({ clan: safeClan(clan) });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    if (clan.getRole(req.player._id) !== 'owner') return res.status(403).json({ error: 'Only the owner can disband the clan' });
    const io = req.app.get('io');
    for (const m of clan.members) {
      if (m.playerId.toString() !== req.player._id.toString()) {
        notify(io, m.playerId, { type: 'generic', title: 'Clan Disbanded', message: `${clan.name} has been disbanded by its owner.`, icon: '💥' }).catch(() => {});
      }
    }
    await Clan.findByIdAndDelete(clan._id);
    await ClanJoinRequest.deleteMany({ clanId: clan._id });
    res.json({ message: 'Clan disbanded' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAN CHALLENGES (send/list via REST; accept/decline via socket — see
// socketHandlers.js 'clanChallenge:respond')
// ─────────────────────────────────────────────────────────────────────────────

router.post('/:id/challenge/:targetClanId', protect, async (req, res) => {
  try {
    const settings = await GameSettings.getSingleton();
    if (!settings.features?.clanMatchmakingEnabled) return res.status(403).json({ error: 'Clan matchmaking is currently disabled' });
    const clan = await Clan.findById(req.params.id);
    const target = await Clan.findById(req.params.targetClanId);
    if (!clan || !target) return res.status(404).json({ error: 'Clan not found' });
    if (clan._id.equals(target._id)) return res.status(400).json({ error: 'Cannot challenge your own clan' });
    const role = clan.getRole(req.player._id);
    if (!['owner', 'admin'].includes(role)) return res.status(403).json({ error: 'Only clan owner/admin can send challenges' });
    const existing = await ClanChallenge.findOne({ challengerClanId: clan._id, targetClanId: target._id, status: 'pending' });
    if (existing) return res.status(409).json({ error: 'A pending challenge to this clan already exists' });

    const challenge = await ClanChallenge.create({ challengerClanId: clan._id, targetClanId: target._id, sentBy: req.player._id });
    const io = req.app.get('io');
    const targetLeaders = target.members.filter(m => ['owner', 'admin'].includes(m.role));
    for (const m of targetLeaders) {
      notify(io, m.playerId, {
        type: 'generic', title: `⚔ Clan Challenge from ${clan.name}!`,
        message: `${clan.tag} has challenged ${target.tag} to a clan battle. Expires in ${settings.clanBattleSettings?.challengeExpiryDays ?? 7} days if not answered.`,
        icon: '⚔', meta: { challengeId: challenge._id, challengerClanId: clan._id },
      }).catch(() => {});
    }
    res.status(201).json({ message: 'Challenge sent', challenge });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/challenges/mine', protect, async (req, res) => {
  const myClan = await Clan.findOne({ 'members.playerId': req.player._id });
  if (!myClan) return res.json({ incoming: [], outgoing: [] });
  const [incoming, outgoing] = await Promise.all([
    ClanChallenge.find({ targetClanId: myClan._id, status: 'pending' }).populate('challengerClanId', 'name tag badge').sort({ createdAt: -1 }),
    ClanChallenge.find({ challengerClanId: myClan._id, status: 'pending' }).populate('targetClanId', 'name tag badge').sort({ createdAt: -1 }),
  ]);
  res.json({ incoming, outgoing, myClanId: myClan._id, myRole: myClan.getRole(req.player._id) });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLAN BATTLES (view state/scores — starting a run is a socket event)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/battles/mine', protect, async (req, res) => {
  const myClan = await Clan.findOne({ 'members.playerId': req.player._id });
  if (!myClan) return res.json({ battles: [] });
  const battles = await ClanBattle.find({ $or: [{ clanAId: myClan._id }, { clanBId: myClan._id }] }).sort({ createdAt: -1 }).limit(20);
  res.json({
    battles: battles.map(b => ({ ...safeBattle(b), hasIPlayed: b.hasPlayerPlayed(req.player._id) })),
    myClanId: myClan._id,
  });
});

router.get('/battles/:id', protect, async (req, res) => {
  const battle = await ClanBattle.findById(req.params.id);
  if (!battle) return res.status(404).json({ error: 'Battle not found' });
  const [clanA, clanB] = await Promise.all([Clan.findById(battle.clanAId), Clan.findById(battle.clanBId)]);
  res.json({
    battle: { ...safeBattle(battle), hasIPlayed: battle.hasPlayerPlayed(req.player._id) },
    clanA: clanA ? { _id: clanA._id, name: clanA.name, tag: clanA.tag, badge: clanA.badge } : null,
    clanB: clanB ? { _id: clanB._id, name: clanB.name, tag: clanB.tag, badge: clanB.badge } : null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  const { page = 1, limit = 50, search } = req.query;
  const filter = search ? { $or: [{ name: new RegExp(search, 'i') }, { tag: new RegExp(search, 'i') }] } : {};
  const [clans, total] = await Promise.all([
    Clan.find(filter).populate('ownerId', 'username email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
    Clan.countDocuments(filter),
  ]);
  res.json({ clans: clans.map(c => ({ ...safeClan(c), owner: c.ownerId })), total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

router.delete('/admin/:id', protect, adminOnly, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({ adminId: req.player._id, adminName: req.player.username, action: 'clan.disband', target: clan.name, details: { reason: req.body.reason } });
    const io = req.app.get('io');
    for (const m of clan.members) {
      notify(io, m.playerId, { type: 'generic', title: 'Clan Disbanded by Admin', message: req.body.reason ? `${clan.name} was disbanded by an admin: ${req.body.reason}` : `${clan.name} was disbanded by an admin.`, icon: '💥' }).catch(() => {});
    }
    await Clan.findByIdAndDelete(clan._id);
    await ClanJoinRequest.deleteMany({ clanId: clan._id });
    res.json({ message: 'Clan disbanded by admin' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/admin/settings', protect, adminOnly, async (req, res) => {
  try {
    const settings = await GameSettings.getSingleton();
    const { maxMembersPerClan, creationTiers, ownedClansLimit } = req.body;
    if (maxMembersPerClan !== undefined) settings.clanSettings.maxMembersPerClan = maxMembersPerClan;
    if (creationTiers !== undefined) settings.clanSettings.creationTiers = creationTiers;
    if (ownedClansLimit !== undefined) {
      for (const tier of ['free', 'verified', 'pro', 'elite']) {
        if (ownedClansLimit[tier] !== undefined) settings.clanSettings.ownedClansLimit[tier] = ownedClansLimit[tier];
      }
    }
    await settings.save();
    res.json({ settings });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// NEW: admin settings for the async battle system
router.patch('/admin/battle-settings', protect, adminOnly, async (req, res) => {
  try {
    const settings = await GameSettings.getSingleton();
    const { challengeExpiryDays, battleWindowHours, scoringMode, roomCount } = req.body;
    if (challengeExpiryDays !== undefined) settings.clanBattleSettings.challengeExpiryDays = challengeExpiryDays;
    if (battleWindowHours !== undefined) settings.clanBattleSettings.battleWindowHours = battleWindowHours;
    if (scoringMode !== undefined && ['sum', 'average', 'best'].includes(scoringMode)) settings.clanBattleSettings.scoringMode = scoringMode;
    if (roomCount !== undefined) settings.clanBattleSettings.roomCount = roomCount; // see CLAN_BATTLE_ROOMCOUNT_LIMITATION.md
    await settings.save();
    res.json({ settings });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
