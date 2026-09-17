const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const Player = require('../models/Player');
const Match = require('../models/Match');
const Clue = require('../models/Clue');

const ClanBattle = require('../models/ClanBattle');
const ClanChallenge = require('../models/ClanChallenge');
const Clan = require('../models/Clan');
const ErrorLog = require('../models/ErrorLog');

const { finalizeExpiredBattles } = require('../utils/clanBattleExpiry');

const { toCSV, sendCSV } = require('../utils/csvExport');
const logger = require('../utils/logger');
const notify = require('../utils/notify');
const AuditLog = require('../models/AuditLog');

// ════════════════════════════════════════
// ADMIN ROUTES
// ════════════════════════════════════════

// Dashboard stats
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const [
      totalPlayers, activePlayers, totalMatches, activeMatches,
      totalClues, activeClues, bannedPlayers, verifiedPlayers,
    ] = await Promise.all([
      Player.countDocuments(),
      Player.countDocuments({ isOnline: true }),
      Match.countDocuments(),
      Match.countDocuments({ status: 'in_progress' }),
      Clue.countDocuments(),
      Clue.countDocuments({ isActive: true }),
      Player.countDocuments({ isBanned: true }),
      Player.countDocuments({ isVerified: true }),
    ]);

    // DAU (players active in last 24h)
    const dau = await Player.countDocuments({ lastSeen: { $gte: new Date(Date.now() - 86400000) } });

    res.json({ totalPlayers, activePlayers, totalMatches, activeMatches, totalClues, activeClues, bannedPlayers, verifiedPlayers, dau });
  } catch (err) {
    logger.error('[admin/dashboard] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// List players
router.get('/players', protect, adminOnly, async (req, res) => {
  try {
    const { search, page = 1, limit = 50, filter } = req.query;
    const query = {};
    if (search) query.$or = [{ username: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
    if (filter === 'banned') query.isBanned = true;
    if (filter === 'verified') query.isVerified = true;
    if (filter === 'online') query.isOnline = true;

    const [players, total] = await Promise.all([
      Player.find(query)
        .select('username email phone isVerified isEmailVerified isPhoneVerified isBanned banReason banUntil role subscription stats isOnline lastSeen createdAt')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      Player.countDocuments(query),
    ]);
    res.json({ players, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    logger.error('[admin/players] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// Export endpoints for admin to download CSVs of players, payments, matches, and clans
router.get('/players/export', protect, adminOnly, async (req, res) => {
  const players = await Player.find({}).select('username email phone displayName isVerified isBanned subscription stats createdAt lastSeen').lean();
  const csv = toCSV(players, [
    { key: 'username', label: 'Username' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'displayName', label: 'Display Name' },
    { label: 'Verified', get: p => p.isVerified ? 'yes' : 'no' },
    { label: 'Banned', get: p => p.isBanned ? 'yes' : 'no' },
    { label: 'Plan', get: p => p.subscription?.plan || 'free' },
    { label: 'Games Played', get: p => p.stats?.gamesPlayed || 0 },
    { label: 'Wins', get: p => p.stats?.wins || 0 },
    { label: 'Rooms Survived', get: p => p.stats?.totalRoomsSurvived || 0 },
    { label: 'Joined', get: p => new Date(p.createdAt).toISOString() },
    { label: 'Last Seen', get: p => p.lastSeen ? new Date(p.lastSeen).toISOString() : '' },
  ]);

  sendCSV(res, `players-${Date.now()}.csv`, csv);
});

router.get('/payments/export', protect, adminOnly, async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    const payments = await Payment.find({}).populate('playerId', 'username email').lean();
    const csv = toCSV(payments, [
      { label: 'Player', get: p => p.playerId?.username || 'deleted' },
      { label: 'Email', get: p => p.playerId?.email || '' },
      { key: 'plan', label: 'Plan' },
      { key: 'amount', label: 'Amount' },
      { key: 'currency', label: 'Currency' },
      { key: 'status', label: 'Status' },
      { key: 'razorpayOrderId', label: 'Order ID' },
      { label: 'Date', get: p => new Date(p.createdAt).toISOString() },
    ]);
    sendCSV(res, `payments-${Date.now()}.csv`, csv);
  } catch (err) {
    logger.error('[admin/payments/export] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to export payments — check that the Payment model path in this route matches your actual file' });
  }
});

router.get('/matches/export', protect, adminOnly, async (req, res) => {
  const { from, to } = req.query;
  const filter = { status: 'completed' };
  if (from || to) {
    filter.endedAt = {};
    if (from) filter.endedAt.$gte = new Date(from);
    if (to) filter.endedAt.$lte = new Date(to);
  }
  const matches = await Match.find(filter).lean();
  const csv = toCSV(matches, [
    { key: 'roomCode', label: 'Room Code' },
    { key: 'mode', label: 'Mode' },
    { label: 'Player Count', get: m => m.players?.length || 0 },
    { key: 'totalRooms', label: 'Total Rooms' },
    { key: 'winnersCount', label: 'Winners' },
    { key: 'difficultyCurve', label: 'Difficulty' },
    { label: 'Started', get: m => m.startedAt ? new Date(m.startedAt).toISOString() : '' },
    { label: 'Ended', get: m => m.endedAt ? new Date(m.endedAt).toISOString() : '' },
  ]);

  sendCSV(res, `matches-${Date.now()}.csv`, csv);
});

router.get('/clans/export', protect, adminOnly, async (req, res) => {
  const Clan = require('../models/Clan');
  const clans = await Clan.find({}).lean();
  const csv = toCSV(clans, [
    { key: 'name', label: 'Name' },
    { key: 'tag', label: 'Tag' },
    { label: 'Members', get: c => c.members?.length || 0 },
    { key: 'joinPolicy', label: 'Join Policy' },
    { label: 'Total Matches', get: c => c.stats?.totalMatches || 0 },
    { label: 'Total Wins', get: c => c.stats?.totalWins || 0 },
    { label: 'Created', get: c => new Date(c.createdAt).toISOString() },
  ]);

  sendCSV(res, `clans-${Date.now()}.csv`, csv);
});


// Get single player
router.get('/players/:id/detail', protect, adminOnly, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id).select('-password -otp');
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const Clan = require('../models/Clan');
    const Match = require('../models/Match');

    const [clan, recentMatches] = await Promise.all([
      Clan.findOne({ 'members.playerId': player._id }).select('name tag badge members'),
      Match.find({ 'players.playerId': player._id, status: 'completed' })
        .sort({ endedAt: -1 }).limit(5)
        .select('roomCode players endedAt totalRooms mode'),
    ]);

    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const roomsCreatedToday = (player.roomsCreatedAt || []).filter(d => new Date(d).getTime() > cutoff).length;
    const roomsJoinedToday = (player.roomsJoinedAt || []).filter(d => new Date(d).getTime() > cutoff).length;

    res.json({
      player,
      clan: clan ? { _id: clan._id, name: clan.name, tag: clan.tag, badge: clan.badge, role: clan.getRole(player._id) } : null,
      recentMatches: recentMatches.map(m => ({
        roomCode: m.roomCode, endedAt: m.endedAt, totalRooms: m.totalRooms, mode: m.mode,
        result: m.players.find(p => p.playerId?.toString() === player._id.toString()),
      })),
      dailyUsage: { roomsCreatedToday, roomsJoinedToday },
    });
  } catch (err) {

    logger.error('[admin/players/:id/detail] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to load player detail' });
  }
});

// Update player
router.patch("/players/:id", protect, adminOnly, async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    // ADD THIS (only if isVerified was part of the update):
    if (req.body.isVerified !== undefined) {
      const io = req.app.get("io");
      notify(io, player._id, {
        type: req.body.isVerified ? "admin_verified" : "admin_unverified",
        title: req.body.isVerified
          ? "Account Verified"
          : "Verification Removed",
        message: req.body.isVerified
          ? "Your account has been verified! You now have access to verified perks."
          : "Your verified status has been removed by an admin.",
        icon: req.body.isVerified ? "✓" : "⚠️",
      }).catch(() => { });
    }

    res.json({ player });
  } catch (err) {

    logger.error('[admin/players:id] Failed:', { message: err.message, stack: err.stack });
    res.status(400).json({ error: err.message });
  }
});

// Ban player
router.post("/players/:id/ban", protect, adminOnly, async (req, res) => {
  try {
    const { reason, durationDays } = req.body;
    const banUntil = durationDays
      ? new Date(Date.now() + durationDays * 86400000)
      : null;
    const player = await Player.findByIdAndUpdate(
      req.params.id,
      {
        isBanned: true,
        banReason: reason,
        banUntil,
      },
      { new: true },
    );

    await AuditLog.create({
      adminId: req.player._id,
      adminName: req.player.username,
      action: "player.ban",
      target: player.username,
      details: { reason, durationDays },
    });

    // ADD THIS — notify the banned player (email:true, this is important):
    const io = req.app.get("io");
    notify(io, player._id, {
      type: "admin_banned",
      title: "Account Banned",
      message: durationDays
        ? `Your account was banned for ${durationDays} day(s). Reason: ${reason}`
        : `Your account was permanently banned. Reason: ${reason}`,
      icon: "🚫",
      meta: { reason, durationDays },
      email: true,
    }).catch(() => { });

    res.json({ message: "Player banned", player });
  } catch (err) {

    logger.error('[admin/players/:id/ban] Failed:', { message: err.message, stack: err.stack });
    res.status(400).json({ error: err.message });
  }
});

// Unban player
router.post("/players/:id/unban", protect, adminOnly, async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(
      req.params.id,
      {
        isBanned: false,
        banReason: null,
        banUntil: null,
      },
      { new: true },
    );

    await AuditLog.create({
      adminId: req.player._id,
      adminName: req.player.username,
      action: "player.unban",
      target: player.username,
    });

    // ADD THIS:
    const io = req.app.get("io");
    notify(io, player._id, {
      type: "admin_unbanned",
      title: "Account Unbanned",
      message: "Your account ban has been lifted. Welcome back!",
      icon: "✅",
      email: true,
    }).catch(() => { });

    res.json({ message: "Player unbanned", player });
  } catch (err) {

    logger.error('[admin/players/:id/unban] Failed:', { message: err.message, stack: err.stack });
    res.status(400).json({ error: err.message });
  }
});

// Gift subscription
router.post("/players/:id/subscription",
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const { plan, durationDays } = req.body;
      const expiresAt = new Date(Date.now() + durationDays * 86400000);
      const player = await Player.findByIdAndUpdate(
        req.params.id,
        {
          "subscription.plan": plan,
          "subscription.status": "active",
          "subscription.expiresAt": expiresAt,
        },
        { new: true },
      );

      await AuditLog.create({
        adminId: req.player._id,
        adminName: req.player.username,
        action: "player.giftSubscription",
        target: player.username,
        details: { plan, durationDays },
      });

      // ADD THIS (email:true, this is a nice thing to email about):
      const io = req.app.get("io");
      notify(io, player._id, {
        type: "admin_gifted_subscription",
        title: `🎁 You received ${plan.toUpperCase()}!`,
        message: `An admin gifted you ${plan.toUpperCase()} for ${durationDays} days. Enjoy the extra perks!`,
        icon: "🎁",
        meta: { plan, durationDays },
        email: true,
      }).catch(() => { });

      res.json({ message: "Subscription gifted", player });
    } catch (err) {

      logger.error('[admin/players/:id/subscription] Failed:', { message: err.message, stack: err.stack });
      res.status(400).json({ error: err.message });
    }
  },
);

// Audit logs
router.get('/audit-logs', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 50, action } = req.query;
    const filter = {};
    if (action) filter.action = action;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).populate('adminId', 'username').sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit)).limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {

    logger.error('[admin/audit-logs] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// Delete match
router.delete('/matches/:id', protect, adminOnly, async (req, res) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    // FIX: this called audit(...) — a function that's never imported
    // anywhere in this file (AuditLog, the MODEL, is imported; audit, a
    // helper FUNCTION, never was). Every delete attempt threw
    // "ReferenceError: audit is not defined" here — AFTER the match was
    // already deleted from the DB, so the admin saw a false failure while
    // the deletion had actually already succeeded. Replaced with the same
    // AuditLog.create() pattern already used everywhere else in this file
    // (ban, unban, gift, broadcast, disconnect).
    await AuditLog.create({
      adminId: req.player._id, adminName: req.player.username,
      action: 'match.delete', target: match.roomCode || req.params.id,
    });

    res.json({ message: 'Match deleted' });
  } catch (err) {

    logger.error('[admin/matches/:id] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', protect, adminOnly, async (req, res) => {
  const [players, matches, clues] = await Promise.all([
    Player.countDocuments(),
    Match.countDocuments(),
    Clue.countDocuments({ isActive: true }),
  ]);
  res.json({ players, matches, clues });
});

// Matches list
router.get('/matches', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 30, status, mode, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (mode) filter.mode = mode;
    if (search) filter.roomCode = new RegExp(search, 'i');

    const [matches, total] = await Promise.all([
      Match.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select('roomCode status mode players totalRooms createdAt endedAt winnersCount difficultyCurve isClanBattleRun'),
      Match.countDocuments(filter),
    ]);

    res.json({ matches, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {

    logger.error('[admin/matches] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to load matches' });
  }
});

router.get('/matches/:id', protect, adminOnly, async (req, res) => {
  const match = await Match.findById(req.params.id).populate('players.playerId', 'username displayName');
  if (!match) return res.status(404).json({ error: 'Match not found' });
  res.json({ match });
});

// Cleanup tool: force-abandon a match stuck in 'in_progress' (e.g. from a
// crashed server that never reached endGame — the in-memory session is
// gone but the DB record is stuck)
router.patch('/matches/:id/abandon', protect, adminOnly, async (req, res) => {
  try {
    const match = await Match.findByIdAndUpdate(req.params.id, { status: 'abandoned' }, { new: true });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json({ match });
  } catch (err) {
    logger.error('[admin/matches/:id/abandon] Failed:', { message: err.message, stack: err.stack });
    res.status(400).json({ error: err.message });
  }
});

router.get('/clan-battles', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 30, status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;

    let clanIdFilter = null;
    if (search) {
      const matchingClans = await Clan.find({ $or: [{ name: new RegExp(search, 'i') }, { tag: new RegExp(search, 'i') }] }).select('_id');
      clanIdFilter = matchingClans.map(c => c._id);
      filter.$or = [{ clanAId: { $in: clanIdFilter } }, { clanBId: { $in: clanIdFilter } }];
    }

    const [battles, total] = await Promise.all([
      ClanBattle.find(filter)
        .populate('clanAId', 'name tag').populate('clanBId', 'name tag')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit))
        .select('-roomSequence'), // never expose answers, even to admin listing
      ClanBattle.countDocuments(filter),
    ]);

    res.json({ battles, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error('[admin/clan-battles] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to load clan battles' });
  }
});

router.get('/clan-battles/:id', protect, adminOnly, async (req, res) => {
  const battle = await ClanBattle.findById(req.params.id)
    .populate('clanAId', 'name tag').populate('clanBId', 'name tag')
    .populate('runs.playerId', 'username')
    .select('-roomSequence');
  if (!battle) return res.status(404).json({ error: 'Battle not found' });
  res.json({ battle });
});

// Manual override: force-finalize a specific battle right now, regardless
// of whether its window has actually expired — for stuck/disputed cases
router.post('/clan-battles/:id/force-finalize', protect, adminOnly, async (req, res) => {
  try {
    const battle = await ClanBattle.findById(req.params.id);
    if (!battle) return res.status(404).json({ error: 'Battle not found' });
    if (battle.status !== 'active') return res.status(400).json({ error: 'Battle is not active' });

    battle.expiresAt = new Date(0); // force it into the "expired" query the cron logic uses
    await battle.save();
    const io = req.app.get('io');
    await finalizeExpiredBattles(io); // reuses the exact same finalize logic as the cron — no duplicated logic, no risk of divergent behavior

    const updated = await ClanBattle.findById(req.params.id).populate('clanAId', 'name tag').populate('clanBId', 'name tag').select('-roomSequence');
    res.json({ battle: updated });
  } catch (err) {

    logger.error('[admin/clan-battles/:id/force-finalize] Failed:', { message: err.message, stack: err.stack });
    res.status(400).json({ error: err.message });
  }
});

// Global view of pending challenges (not tied to any one clan) — useful
// for spotting ones that are about to expire or look stuck
router.get('/clan-challenges', protect, adminOnly, async (req, res) => {
  const { status = 'pending' } = req.query;
  const challenges = await ClanChallenge.find({ status })
    .populate('challengerClanId', 'name tag').populate('targetClanId', 'name tag')
    .sort({ createdAt: -1 }).limit(50);
  res.json({ challenges });
});

// Broadcast endpoint for admins to send a message to all players (or filtered by tier/online status)
router.post('/broadcast', protect, adminOnly, async (req, res) => {
  try {
    const { title, message, filterTier, onlineOnly } = req.body;
    if (!title?.trim() || !message?.trim()) return res.status(400).json({ error: 'Title and message are required' });

    const filter = {};
    if (filterTier && filterTier !== 'all') {
      if (filterTier === 'free') filter['subscription.plan'] = { $in: [null, 'free'] };
      else filter['subscription.plan'] = filterTier;
    }
    if (onlineOnly) filter.isOnline = true;

    const players = await Player.find(filter).select('_id');
    const io = req.app.get('io');

    // Fire all notify() calls concurrently rather than sequentially —
    // this reuses the exact same function every other feature already
    // uses, so broadcast automatically gets in-app + push delivery for
    // free, no separate code path to maintain
    await Promise.all(players.map(p =>
      notify(io, p._id, { type: 'generic', title: title.trim(), message: message.trim(), icon: '📢' }).catch((e) => { console.log(e) })
    ));

    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      adminId: req.player._id, adminName: req.player.username, action: 'broadcast.sent',
      target: `${players.length} players`, details: { title, message, filterTier, onlineOnly },
    });

    res.json({ message: `Broadcast sent to ${players.length} player(s)` });
  } catch (err) {

    logger.error('[admin/broadcast] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

// Error logs: view, filter, and delete old logs
router.get('/error-logs', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 30, level, search, from, to } = req.query;
    const filter = {};
    if (level) filter.level = level;
    if (search) filter.message = new RegExp(search, 'i');
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      ErrorLog.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      ErrorLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error('[admin/error-logs] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to load error logs' });
  }
});

// Quick counts for a small dashboard summary (last 24h error/warn counts)
router.get('/error-logs/summary', protect, adminOnly, async (req, res) => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [errors24h, warns24h] = await Promise.all([
    ErrorLog.countDocuments({ level: 'error', timestamp: { $gte: cutoff } }),
    ErrorLog.countDocuments({ level: 'warn', timestamp: { $gte: cutoff } }),
  ]);
  res.json({ errors24h, warns24h });
});

router.delete('/error-logs', protect, adminOnly, async (req, res) => {
  try {
    const { olderThanDays } = req.body;
    const filter = olderThanDays ? { timestamp: { $lt: new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000) } } : {};
    const result = await ErrorLog.deleteMany(filter);
    res.json({ message: `Deleted ${result.deletedCount} log(s)` });
  } catch (err) {

    logger.error('[admin/error-logs/delete] Failed:', { message: err.message, stack: err.stack });
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SESSION MANAGEMENT (partial — live-connection kick only; does NOT force
// a logout/re-authentication, see SESSION_MANAGEMENT_OPTIONS.md)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/players/:id/disconnect', protect, adminOnly, async (req, res) => {
  try {
    const { getPlayerSocketId } = require('../socket/socketHandlers');
    const io = req.app.get('io');
    const socketId = getPlayerSocketId(req.params.id);

    if (!socketId) return res.status(404).json({ error: 'Player is not currently connected' });

    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return res.status(404).json({ error: 'Player is not currently connected' });

    // Tell the client WHY before disconnecting, so the UI can show a
    // meaningful message instead of just going dark
    socket.emit('forceDisconnected', { reason: 'An admin ended your session. Please reload the page.' });
    socket.disconnect(true);

    const Player = require('../models/Player');
    const player = await Player.findById(req.params.id).select('username');
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      adminId: req.player._id, adminName: req.player.username,
      action: 'player.forceDisconnect', target: player?.username || req.params.id,
    });

    res.json({ message: 'Player disconnected' });
  } catch (err) {
    logger.error('[admin/players/:id/disconnect] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to disconnect player' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/overview', protect, adminOnly, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const Payment = require('../models/Payment');

    // ── Revenue & subscriptions — status values confirmed against your
    // actual PaymentsSection filter dropdown: paid/cancelled/refunded/failed ──
    const [dailyRevenue, byPlan, subscriptionBreakdown] = await Promise.all([
      Payment.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: since } } },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            amount: { $sum: '$amount' }, count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: since } } },
        { $group: { _id: '$plan', revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Player.aggregate([
        { $group: { _id: { $ifNull: ['$subscription.plan', 'free'] }, count: { $sum: 1 } } },
      ]),
    ]);

    // ── Player activity ────────────────────────────────────────────────────────
    const [dauSeries, newSignupsSeries, mau] = await Promise.all([
      Player.aggregate([
        { $match: { lastSeen: { $gte: since } } },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastSeen' } },
            count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),
      Player.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),
      Player.countDocuments({ lastSeen: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
    ]);

    // Day-1 retention: of players who signed up 2-3 days ago (giving a
    // full day's window to return), what % showed any activity since?
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const [cohortSize, cohortReturned] = await Promise.all([
      Player.countDocuments({ createdAt: { $gte: threeDaysAgo, $lt: twoDaysAgo } }),
      Player.countDocuments({ createdAt: { $gte: threeDaysAgo, $lt: twoDaysAgo }, lastSeen: { $gte: twoDaysAgo } }),
    ]);
    const day1Retention = cohortSize > 0 ? Math.round((cohortReturned / cohortSize) * 1000) / 10 : null;

    // ── Game modes & difficulty curves ────────────────────────────────────────
    const [modeBreakdown, curveBreakdown, totalMatchesInPeriod] = await Promise.all([
      Match.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$mode', count: { $sum: 1 } } },
      ]),
      Match.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$difficultyCurve', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      Match.countDocuments({ createdAt: { $gte: since } }),
    ]);

    // ── Clan battles ───────────────────────────────────────────────────────────
    const [battleTotal, battleActive, battleCompleted, avgScoreAgg] = await Promise.all([
      ClanBattle.countDocuments({ createdAt: { $gte: since } }),
      ClanBattle.countDocuments({ status: 'active' }),
      ClanBattle.countDocuments({ status: 'completed', createdAt: { $gte: since } }),
      ClanBattle.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: since } } },
        { $group: { _id: null, avgA: { $avg: '$clanAScore' }, avgB: { $avg: '$clanBScore' } } },
      ]),
    ]);

    res.json({
      periodDays: days,
      revenue: {
        daily: dailyRevenue.map(d => ({ date: d._id, amount: d.amount, count: d.count })),
        byPlan: byPlan.map(p => ({ plan: p._id, revenue: p.revenue, count: p.count })),
        totalRevenue: dailyRevenue.reduce((s, d) => s + d.amount, 0),
      },
      subscriptions: {
        breakdown: subscriptionBreakdown.map(s => ({ plan: s._id, count: s.count })),
      },
      activity: {
        dau: dauSeries.map(d => ({ date: d._id, count: d.count })),
        newSignups: newSignupsSeries.map(d => ({ date: d._id, count: d.count })),
        mau,
        day1Retention,
      },
      gameModes: {
        byMode: modeBreakdown.map(m => ({ mode: m._id || 'unknown', count: m.count })),
        byCurve: curveBreakdown.map(c => ({ curve: c._id || 'unknown', count: c.count })),
        totalMatches: totalMatchesInPeriod,
      },
      clanBattles: {
        total: battleTotal, active: battleActive, completed: battleCompleted,
        avgScore: avgScoreAgg[0] && avgScoreAgg[0].avgA != null ? Math.round(((avgScoreAgg[0].avgA + avgScoreAgg[0].avgB) / 2) * 10) / 10 : null,
      },
    });
  } catch (err) {
    logger.error('[admin/analytics/overview] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to load analytics: ' + err.message });
  }
});

module.exports = router;
