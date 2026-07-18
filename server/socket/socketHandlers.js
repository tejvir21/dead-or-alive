/**
 * socketHandlers.js — Phase 3 complete
 *
 * Fixes/additions in this version:
 *  - Room creator is auto-ready on creation (no need to click ready)
 *  - Kick confirmation notification to the kicker + kicked player (persistent + real-time)
 *  - Solo-player elimination: no "spectate" option offered (nobody else to watch)
 *  - playerSocketRegistry exposed so utils/notify.js can deliver real-time notifications
 *    to any player currently connected, even outside an active game session
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const Player       = require('../models/Player');
const Match        = require('../models/Match');
const GameSettings = require('../models/GameSettings');
const { generateRoomSequence, validateDoorChoice } = require('../utils/roomGenerator');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const notify = require('../utils/notify');

const activeSessions  = new Map();
const reconnectTimers = new Map();

// ── Global registry: playerId → current socketId (for notify.js real-time delivery) ──
// This exists independently of any game session — it tracks EVERY connected
// player, so notifications work even when they're just browsing the lobby/profile.
const playerSocketRegistry = new Map();
function getPlayerSocketId(playerId) { return playerSocketRegistry.get(playerId) || null; }

class GameSession {
  constructor(matchId, roomCode, createdBy, maxPlayers, minPlayers, difficultyCurve, autoStartDuration) {
    this.matchId           = matchId;
    this.roomCode          = roomCode;
    this.createdBy         = createdBy;
    this.maxPlayers        = maxPlayers;
    this.minPlayers        = minPlayers;
    this.difficultyCurve   = difficultyCurve || 'stepped';
    this.autoStartDuration = autoStartDuration || 180;
    this.status            = 'waiting';
    this.players           = new Map();
    this.spectators        = new Set();
    this.eliminatedSpecs   = new Set();
    this.rooms             = [];
    this.currentRoomIndex  = 0;
    this.roundPhase        = 'idle';
    this.roundTimer        = null;
    this.revealTimer       = null;
    this.choices           = new Map();
    this.puzzleStartTime   = null;
    this.doorStartTime     = null;
    this.autoStartTimer    = null;
    this.autoStartAt       = null;
    this.kickVotes         = new Map();
  }

  getAlivePlayers()   { return [...this.players.values()].filter(p => p.alive); }
  getAllPlayers()      { return [...this.players.values()]; }
  getReadyPlayers()   { return [...this.players.values()].filter(p => p.ready); }
  findByPlayerId(pid) { return [...this.players.values()].find(p => p.playerId === pid) || null; }
  getCurrentRoom()    { return this.rooms[this.currentRoomIndex] || null; }

  // True if this session only ever had 1 player total (solo game) —
  // used to decide whether to offer "spectate" on elimination
  isSoloGame() { return this.getAllPlayers().length <= 1 && this.spectators.size === 0; }

  getSafeCurrentRoom() {
    const r = this.getCurrentRoom();
    if (!r) return null;
    const { correctDoor, answerRule, resolvedVars, clueSeed, ...safe } = r;
    return safe;
  }

  getSpectatorRoom() {
    const r = this.getSafeCurrentRoom();
    if (!r) return null;
    return { ...r, clueText: null, hints: [] };
  }

  toPublicState(spectatorMode = false) {
    return {
      roomCode: this.roomCode, status: this.status, roundPhase: this.roundPhase,
      currentRoomIndex: this.currentRoomIndex, totalRooms: this.rooms.length,
      minPlayers: this.minPlayers, maxPlayers: this.maxPlayers, createdBy: this.createdBy,
      difficultyCurve: this.difficultyCurve, autoStartDuration: this.autoStartDuration,
      autoStartAt: this.autoStartAt,
      players: this.getAllPlayers().map(p => ({
        id: p.playerId, username: p.username, alive: p.alive, ready: p.ready,
        roomsSurvived: p.roomsSurvived, hasChosen: this.choices.has(p.socketId),
        isVerified: p.isVerified, skippedToDoor: p.skippedToDoor,
      })),
      currentRoom: spectatorMode ? this.getSpectatorRoom() : this.getSafeCurrentRoom(),
    };
  }
}

class PlayerState {
  constructor(socketId, playerId, username, isVerified, tier, isCreator) {
    this.socketId = socketId; this.playerId = playerId; this.username = username;
    this.isVerified = !!isVerified; this.tier = tier || 'free';
    this.alive = true;
    // FIX: room creator starts auto-ready — no need to click ready themselves
    this.ready = !!isCreator;
    this.roomsSurvived = 0;
    this.skippedToDoor = false; this.joinedAt = Date.now();
  }
}

async function authenticateSocket(socket, next) {
  try {
    const token = (socket.handshake.auth?.token || socket.handshake.headers?.authorization || '').replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const player  = await Player.findById(decoded.id).select('-password -otp');
    if (!player) return next(new Error('Player not found'));
    if (player.isBanned && (!player.banUntil || player.banUntil > new Date())) return next(new Error('Account banned'));
    socket.player = player;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return next(new Error('Token expired'));
    next(new Error('Invalid token'));
  }
}

function getPlayerTier(player) {
  const plan = player.subscription?.plan;
  if (plan === 'elite') return 'elite';
  if (plan === 'pro')   return 'pro';
  if (player.isVerified) return 'verified';
  return 'free';
}

async function checkDailyLimit(player, type, settings) {
  if (!settings.features?.dailyLimitsEnabled) return { allowed: true };
  const tier  = getPlayerTier(player);
  const lims  = settings.dailyLimits?.[tier] || { create: 3, join: 10 };
  const limit = type === 'create' ? (lims.create ?? 3) : (lims.join ?? 10);
  if (limit === -1) return { allowed: true, limit: -1 };
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const field  = type === 'create' ? 'roomsCreatedAt' : 'roomsJoinedAt';
  const recent = (player[field] || []).filter(d => new Date(d).getTime() > cutoff);
  return { allowed: recent.length < limit, used: recent.length, limit };
}

async function recordDailyUsage(playerId, type) {
  const field  = type === 'create' ? 'roomsCreatedAt' : 'roomsJoinedAt';
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await Player.findByIdAndUpdate(playerId, { $push: { [field]: new Date() }, $pull: { [field]: { $lt: cutoff } } });
}

async function calcTimerReduction(session, correctPickers, totalAlive) {
  const settings = await GameSettings.getSingleton();
  if (!settings.timerReductionEnabled) return 0;
  const factor    = settings.timerReductionFactor || 0.3;
  const doorTimer = settings.doorTimerSeconds || 30;
  const elapsed   = (Date.now() - (session.doorStartTime || Date.now())) / 1000;
  const remaining = Math.max(0, doorTimer - elapsed);
  const speed     = Math.max(0, (doorTimer - elapsed) / doorTimer);
  const pct       = totalAlive > 0 ? correctPickers / totalAlive : 0;
  return Math.round(remaining * pct * speed * factor);
}

function startAutoStartTimer(code, io, session, duration) {
  clearAutoStartTimer(session);
  if (!duration || duration <= 0) return;
  session.autoStartDuration = duration;
  session.autoStartAt = Date.now() + duration * 1000;
  io.to(code).emit('autoStartTimerBegun', { duration, expiresAt: session.autoStartAt });

  session.autoStartTimer = setTimeout(async () => {
    if (session.status !== 'waiting') return;
    const ready = session.getReadyPlayers();
    if (ready.length < session.minPlayers) {
      io.to(code).emit('autoStartCancelled', { reason: `Only ${ready.length} player(s) ready. Need ${session.minPlayers}. Room closed.` });
      activeSessions.delete(code);
      Match.findOneAndUpdate({ matchId: session.matchId }, { status: 'abandoned' }).exec();
      return;
    }
    const notReady = [...session.players.values()].filter(p => !p.ready);
    notReady.forEach(p => {
      session.players.delete(p.socketId);
      const s = io.sockets.sockets.get(p.socketId);
      if (s) { s.emit('youWereKicked', { reason: 'Auto-start timer expired while you were not ready' }); s.leave(code); }
      io.to(code).emit('playerRemovedAutoStart', { username: p.username });
    });
    io.to(code).emit('autoStarting', { readyCount: ready.length });
    setTimeout(() => startCountdown(code, io, session), 500);
  }, duration * 1000);
}

function clearAutoStartTimer(session) {
  if (session.autoStartTimer) { clearTimeout(session.autoStartTimer); session.autoStartTimer = null; session.autoStartAt = null; }
}

function resolveKickVote(code, io, session, targetPlayerId, settings) {
  const voteObj = session.kickVotes.get(targetPlayerId);
  if (!voteObj) return;
  const target    = session.findByPlayerId(targetPlayerId);
  const others    = [...session.players.values()].filter(p => p.playerId !== targetPlayerId);
  const votesFor  = [...voteObj.votes.values()].filter(v => v).length;
  const threshold = settings.kickSystem?.thresholdPercent ?? 50;
  const needed    = Math.ceil(others.length * threshold / 100);

  io.to(code).emit('kickVoteUpdate', { targetId: targetPlayerId, target: target?.username, votesFor, votesNeeded: needed, totalEligible: others.length });

  if (votesFor >= needed || voteObj.votes.size >= others.length) {
    clearTimeout(voteObj.timer);
    session.kickVotes.delete(targetPlayerId);
    if (votesFor >= needed) executeKick(code, io, session, targetPlayerId, 'Voted out by majority', settings, voteObj.initiatorId);
    else io.to(code).emit('kickVoteFailed', { targetId: targetPlayerId, target: target?.username });
  }
}

// ── executeKick — now sends persistent + real-time notifications ────────────────
async function executeKick(code, io, session, targetPlayerId, reason, settings, initiatorId) {
  const target = session.findByPlayerId(targetPlayerId);
  if (!target) return;
  const sock = io.sockets.sockets.get(target.socketId);
  if (sock) { sock.emit('youWereKicked', { reason }); sock.leave(code); }

  // ── Notification: to the kicked player ──────────────────────────────────────
  notify(io, target.playerId, {
    type: 'kicked_you', title: 'Removed from room',
    message: `You were removed from room ${code}: ${reason}`,
    icon: '🚪', meta: { roomCode: code, reason },
  }).catch(() => {});

  // ── Notification: to whoever initiated the kick (confirmation) ──────────────
  if (initiatorId) {
    notify(io, initiatorId, {
      type: 'you_kicked_someone', title: 'Player removed',
      message: `${target.username} was removed from room ${code}`,
      icon: '👋', meta: { roomCode: code, username: target.username },
    }).catch(() => {});
  }

  if (session.status === 'waiting') {
    session.players.delete(target.socketId);
  } else {
    session.players.delete(target.socketId);
    session.choices.delete(target.socketId);
    const alive  = session.getAlivePlayers();
    const chosen = alive.filter(p => session.choices.has(p.socketId));
    if (alive.length > 0 && chosen.length >= alive.length) { clearTimeout(session.roundTimer); revealResults(code, io, session); }
  }

  io.to(code).emit('playerKicked', { username: target.username, reason, session: session.toPublicState() });

  if (session.createdBy === targetPlayerId) {
    const rem = [...session.players.values()];
    if (rem.length > 0) { session.createdBy = rem[0].playerId; io.to(code).emit('hostTransferred', { newHost: rem[0].username }); }
  }
}

function startCountdown(code, io, session) {
  if (session.status !== 'waiting') return;
  clearAutoStartTimer(session);
  session.status = 'countdown';
  io.to(code).emit('countdownStarted', { seconds: 5 });
  let count = 5;
  const interval = setInterval(() => {
    count--;
    io.to(code).emit('countdownTick', { seconds: count });
    if (count <= 0) { clearInterval(interval); setTimeout(() => beginGame(code, io, session), 800); }
  }, 1000);
}

async function beginGame(code, io, session) {
  try {
    session.status = 'in_progress';
    const playerIds  = [...session.players.values()].map(p => p.playerId);
    const players    = await Player.find({ _id: { $in: playerIds } });
    const excludeIds = players.flatMap(p => p.getRecentClueIds ? p.getRecentClueIds() : []);
    session.rooms    = await generateRoomSequence(session.players.size, excludeIds, session.difficultyCurve);
    await Match.findOneAndUpdate({ matchId: session.matchId }, { status: 'in_progress', startedAt: new Date(), totalRooms: session.rooms.length });
    io.to(code).emit('gameStarted', { totalRooms: session.rooms.length, session: session.toPublicState() });
    setTimeout(() => startRoom(code, io, session), 2000);
  } catch (err) {
    logger.error('beginGame error:', err);
    io.to(code).emit('error', { message: 'Failed to start: ' + err.message });
    session.status = 'waiting';
  }
}

async function startRoom(code, io, session) {
  session.choices.clear();
  session.roundPhase = 'puzzle';
  session.puzzleStartTime = Date.now();
  for (const p of session.players.values()) p.skippedToDoor = false;
  const room = session.getCurrentRoom();
  if (!room) return endGame(code, io, session);
  const settings  = await GameSettings.getSingleton();
  const timerSecs = settings.puzzleTimerSeconds || 30;
  io.to(code).emit('roomStarted', {
    roomNumber: room.roomNumber, environment: room.environment, clueCategory: room.clueCategory,
    clueText: room.clueText, flavorText: room.flavorText, hints: room.hints,
    ambientObjects: room.ambientObjects, timerSeconds: timerSecs, totalRooms: session.rooms.length,
    difficulty: room.difficulty, session: session.toPublicState(),
  });
  session.eliminatedSpecs.forEach(sid => {
    const s = io.sockets.sockets.get(sid);
    if (s) s.emit('spectatorRoomStarted', { ...session.getSpectatorRoom(), timerSeconds: timerSecs, totalRooms: session.rooms.length });
  });
  session.roundTimer = setTimeout(() => startDoorSelection(code, io, session), timerSecs * 1000);
}

async function startDoorSelection(code, io, session) {
  clearTimeout(session.roundTimer);
  session.roundPhase = 'door_selection';
  session.doorStartTime = Date.now();
  const settings  = await GameSettings.getSingleton();
  const doorTimer = settings.doorTimerSeconds || 30;
  io.to(code).emit('doorSelectionStarted', { timerSeconds: doorTimer, session: session.toPublicState() });
  session.roundTimer = setTimeout(() => {
    for (const player of session.getAlivePlayers()) {
      if (!session.choices.has(player.socketId)) session.choices.set(player.socketId, { door: Math.random() > 0.5 ? 'LIVE' : 'DIE', chosenAt: Date.now(), auto: true });
    }
    revealResults(code, io, session);
  }, doorTimer * 1000);
}

async function revealResults(code, io, session) {
  clearTimeout(session.roundTimer);
  session.roundPhase = 'reveal';
  const room = session.getCurrentRoom();
  const correctDoor = room.correctDoor;
  const results = [], survivors = [], eliminated = [];

  // Snapshot before elimination to correctly determine solo-game status
  const wasSoloGame = session.isSoloGame();

  for (const [sid, choice] of session.choices) {
    const player = session.players.get(sid);
    if (!player || !player.alive) continue;
    const survived = validateDoorChoice(room, choice.door);
    results.push({ username: player.username, chosenDoor: choice.door, survived, wasAuto: !!choice.auto });
    if (survived) { player.roomsSurvived++; survivors.push(player.username); }
    else          { player.alive = false; eliminated.push(player.username); }
  }

  await Match.findOneAndUpdate({ matchId: session.matchId }, { $push: { rooms: { roomNumber: room.roomNumber, roomId: room.roomId, clueText: room.clueText, correctDoor, difficulty: room.difficulty, survivorCount: survivors.length, eliminatedCount: eliminated.length } } });

  setTimeout(() => {
    io.to(code).emit('roundResult', { correctDoor, results, survivors, eliminated, session: session.toPublicState() });
    eliminated.forEach(username => {
      const elim = [...session.players.values()].find(p => p.username === username && !p.alive);
      if (elim) {
        const s = io.sockets.sockets.get(elim.socketId);
        // FIX: solo game → no spectate option, since there's nobody else to watch
        if (s) s.emit('youWereEliminated', { correctDoor, chosenDoor: session.choices.get(elim.socketId)?.door, canSpectate: !wasSoloGame });
      }
      io.to(code).emit('playerEliminated', { username });
    });
  }, 1000);

  session.revealTimer = setTimeout(async () => {
    const alive = session.getAlivePlayers();
    if (alive.length === 0) { endGame(code, io, session); return; }
    if (session.currentRoomIndex >= session.rooms.length - 1) { endGame(code, io, session, alive); return; }
    session.currentRoomIndex++;
    io.to(code).emit('nextRoom', { nextRoomNumber: session.currentRoomIndex + 1, alivePlayers: alive.length, session: session.toPublicState() });
    setTimeout(() => startRoom(code, io, session), 3000);
  }, 6000);
}

async function endGame(code, io, session, winners = []) {
  clearTimeout(session.roundTimer);
  clearTimeout(session.revealTimer);
  session.status = 'completed';
  session.roundPhase = 'idle';
  const winnerUsernames = winners.map(p => p.username);
  const updates = session.getAllPlayers().map(p => Player.findByIdAndUpdate(p.playerId, { $inc: { gamesPlayed: 1, 'stats.gamesPlayed': 1, 'stats.wins': winnerUsernames.includes(p.username) ? 1 : 0, 'stats.totalRoomsSurvived': p.roomsSurvived } }));
  await Promise.all([...updates, Match.findOneAndUpdate({ matchId: session.matchId }, { status: 'completed', endedAt: new Date(), winnersCount: winners.length })]);
  io.to(code).emit('gameEnd', { winners: winnerUsernames, allPlayers: session.getAllPlayers().map(p => ({ username: p.username, roomsSurvived: p.roomsSurvived, alive: p.alive })), totalRooms: session.rooms.length });

  // ── Notification: game result to each player ────────────────────────────────
  session.getAllPlayers().forEach(p => {
    const won = winnerUsernames.includes(p.username);
    notify(io, p.playerId, {
      type: won ? 'game_won' : 'game_eliminated',
      title: won ? '🏆 You escaped!' : '💀 Game over',
      message: won
        ? `You survived all ${session.rooms.length} rooms in match ${code}!`
        : `You survived ${p.roomsSurvived}/${session.rooms.length} rooms in match ${code}.`,
      icon: won ? '🏆' : '💀',
      meta: { roomCode: code, roomsSurvived: p.roomsSurvived, totalRooms: session.rooms.length },
    }).catch(() => {});
  });

  setTimeout(() => activeSessions.delete(code), 120000);
}

function handleDisconnect(socket, code, session, player, io) {
  if (session.status === 'waiting') { handleLeave(socket, code, io, true); return; }
  const grace = player.isVerified ? parseInt(process.env.RECONNECT_GRACE_SECONDS_VERIFIED || 60) : parseInt(process.env.RECONNECT_GRACE_SECONDS_NORMAL || 30);
  io.to(code).emit('playerDisconnected', { username: player.username, graceSeconds: grace, message: `${player.username} disconnected. ${grace}s to reconnect.` });
  const key = `${code}:${player.playerId}`;
  const t = setTimeout(() => {
    if (!io.sockets.sockets.get(socket.id) && session.players.has(socket.id)) {
      if (session.roundPhase === 'door_selection' && !session.choices.has(socket.id))
        session.choices.set(socket.id, { door: Math.random() > 0.5 ? 'LIVE' : 'DIE', chosenAt: Date.now(), auto: true });
      player.alive = false;
      session.players.delete(socket.id);
      io.to(code).emit('playerEliminated', { username: player.username, reason: 'disconnected' });
      if (session.getAlivePlayers().length === 0) endGame(code, io, session);
    }
    reconnectTimers.delete(key);
  }, grace * 1000);
  reconnectTimers.set(key, t);
}

function handleLeave(socket, code, io, isDisconnect) {
  const session = activeSessions.get(code);
  if (!session) return;
  const player = session.players.get(socket.id);
  session.spectators.delete(socket.id);
  session.eliminatedSpecs.delete(socket.id);
  if (player) {
    session.players.delete(socket.id);
    if (!isDisconnect) socket.leave(code);
    io.to(code).emit('playerLeft', { username: player.username, session: session.toPublicState() });
    if (session.createdBy === player.playerId && session.status === 'waiting') {
      const rem = [...session.players.values()];
      if (!rem.length) { clearAutoStartTimer(session); activeSessions.delete(code); Match.findOneAndUpdate({ matchId: session.matchId }, { status: 'abandoned' }).exec(); }
      else { session.createdBy = rem[0].playerId; io.to(code).emit('hostTransferred', { newHost: rem[0].username }); }
    }
  }
}

function initSocketHandlers(io) {
  io.use(authenticateSocket);

  // Register the socket lookup fn with the notify utility on startup
  notify.initNotify(io, getPlayerSocketId);

  io.on('connection', socket => {
    setTimeout(() => logger.info(`🔌 Connected: ${socket.player.username} (${socket.id})`), 0);
    Player.findByIdAndUpdate(socket.player._id, { isOnline: true, lastSeen: new Date() }).exec();

    // Register in the global socket registry for notification delivery
    playerSocketRegistry.set(socket.player._id.toString(), socket.id);

    socket.on('createRoom', async ({ maxPlayers = 8, minPlayers = 1, difficultyCurve, autoStartDuration } = {}) => {
      try {
        const settings = await GameSettings.getSingleton();
        if (settings.features.maintenanceMode) return socket.emit('error', { message: 'Server under maintenance.' });
        const fresh   = await Player.findById(socket.player._id);
        const limChk  = await checkDailyLimit(fresh, 'create', settings);
        if (!limChk.allowed) return socket.emit('error', { message: `Daily create limit (${limChk.used}/${limChk.limit}) reached. Resets in 24h. Upgrade for more.` });
        const tier    = getPlayerTier(fresh);
        const tl      = settings.autoStartTimer?.tierLimits?.[tier] || { min: 180, max: 180 };
        const dur     = Math.min(tl.max, Math.max(tl.min, parseInt(autoStartDuration) || settings.autoStartTimer?.defaultDuration || 180));
        const pmx     = ['elite', 'pro', 'verified'].includes(tier) ? settings.maxPlayersVerified : settings.maxPlayersNormal;
        const safeMax = Math.min(pmx, Math.max(1, parseInt(maxPlayers) || 8));
        const safeMin = Math.min(safeMax, Math.max(1, parseInt(minPlayers) || 1));
        const roomCode = uuidv4().substring(0, 6).toUpperCase();
        const matchId  = uuidv4();
        await Match.create({ matchId, roomCode, maxPlayers: safeMax, minPlayers: safeMin, createdBy: socket.player._id, players: [{ playerId: socket.player._id, username: socket.player.username, joinedAt: new Date() }], status: 'waiting', difficultyCurve: difficultyCurve || 'stepped' });
        await recordDailyUsage(socket.player._id, 'create');
        const session = new GameSession(matchId, roomCode, socket.player._id.toString(), safeMax, safeMin, difficultyCurve, dur);
        // FIX: pass isCreator=true so PlayerState constructor auto-sets ready=true
        const ps = new PlayerState(socket.id, socket.player._id.toString(), socket.player.username, socket.player.isVerified, tier, true);
        session.players.set(socket.id, ps);
        activeSessions.set(roomCode, session);
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, session: session.toPublicState(), tierLimits: tl, tier });
        if (settings.features?.autoStartEnabled !== false && settings.autoStartTimer?.enabled !== false) startAutoStartTimer(roomCode, io, session, dur);
      } catch (err) { logger.error('createRoom error:', err); socket.emit('error', { message: 'Failed to create room' }); }
    });

    socket.on('joinRoom', async ({ roomCode, spectate = false } = {}) => {
      try {
        const code = (roomCode || '').toUpperCase();
        const session = activeSessions.get(code);
        if (!session) return socket.emit('error', { message: 'Room not found' });

        const existing = session.findByPlayerId(socket.player._id.toString());
        if (existing) {
          const key = `${code}:${socket.player._id}`;
          const rt = reconnectTimers.get(key);
          if (rt) { clearTimeout(rt); reconnectTimers.delete(key); }
          if (existing.socketId !== socket.id) { session.players.delete(existing.socketId); existing.socketId = socket.id; session.players.set(socket.id, existing); }
          socket.join(code);
          socket.emit('reconnected', { session: session.toPublicState() });
          io.to(code).emit('playerReconnected', { username: socket.player.username, session: session.toPublicState() });
          if (session.status === 'in_progress') {
            const s2 = await GameSettings.getSingleton();
            const room = session.getSafeCurrentRoom();
            if (room && session.roundPhase === 'puzzle') {
              const el = Math.floor((Date.now() - (session.puzzleStartTime || Date.now())) / 1000);
              socket.emit('roomStarted', { ...room, totalRooms: session.rooms.length, timerSeconds: Math.max(1, (s2.puzzleTimerSeconds || 30) - el) });
            } else if (session.roundPhase === 'door_selection') {
              const el = Math.floor((Date.now() - (session.doorStartTime || Date.now())) / 1000);
              socket.emit('doorSelectionStarted', { timerSeconds: Math.max(1, (s2.doorTimerSeconds || 30) - el), session: session.toPublicState() });
            }
          }
          return;
        }

        if (spectate || session.status === 'in_progress') {
          socket.join(code); session.spectators.add(socket.id);
          socket.emit('joinedAsSpectator', { session: session.toPublicState(true) });
          io.to(code).emit('spectatorJoined', { username: socket.player.username });
          return;
        }

        if (session.status !== 'waiting') return socket.emit('error', { message: 'Game already started. Join as spectator?' });
        if (session.players.size >= session.maxPlayers) return socket.emit('error', { message: 'Room is full' });

        const settings2 = await GameSettings.getSingleton();
        const fresh2 = await Player.findById(socket.player._id);
        const jlim = await checkDailyLimit(fresh2, 'join', settings2);
        if (!jlim.allowed) return socket.emit('error', { message: `Daily join limit (${jlim.used}/${jlim.limit}) reached. Resets in 24h.` });

        const tier2 = getPlayerTier(fresh2);
        const ps2 = new PlayerState(socket.id, socket.player._id.toString(), socket.player.username, socket.player.isVerified, tier2, false);
        session.players.set(socket.id, ps2);
        await recordDailyUsage(socket.player._id, 'join');
        await Match.findOneAndUpdate({ matchId: session.matchId }, { $push: { players: { playerId: socket.player._id, username: socket.player.username, joinedAt: new Date() } } });
        socket.join(code);
        socket.emit('joinedRoom', { session: session.toPublicState() });
        io.to(code).emit('playerJoined', { username: socket.player.username, session: session.toPublicState() });
      } catch (err) { logger.error('joinRoom error:', err); socket.emit('error', { message: 'Failed to join room' }); }
    });

    socket.on('leaveRoom', ({ roomCode } = {}) => handleLeave(socket, (roomCode || '').toUpperCase(), io, false));

    socket.on('playerReady', ({ roomCode } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session || session.status !== 'waiting') return;
      const player = session.players.get(socket.id);
      if (!player) return;
      player.ready = !player.ready;
      io.to(code).emit('playerReadyUpdate', { username: player.username, ready: player.ready, session: session.toPublicState() });
      if (session.getReadyPlayers().length >= session.players.size && session.players.size >= session.minPlayers) startCountdown(code, io, session);
    });

    socket.on('startGame', async ({ roomCode } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session) return socket.emit('error', { message: 'Room not found' });
      if (session.createdBy !== socket.player._id.toString()) return socket.emit('error', { message: 'Only the host can start' });
      if (session.status !== 'waiting') return;
      const ready = session.getReadyPlayers();
      if (ready.length < session.minPlayers) return socket.emit('error', { message: `Need at least ${session.minPlayers} ready player(s)` });
      const notReady = [...session.players.values()].filter(p => !p.ready);
      notReady.forEach(p => {
        session.players.delete(p.socketId);
        const s = io.sockets.sockets.get(p.socketId);
        if (s) { s.emit('youWereKicked', { reason: 'Host started the game while you were not ready' }); s.leave(code); }
        io.to(code).emit('playerRemovedAutoStart', { username: p.username });
      });
      startCountdown(code, io, session);
    });

    socket.on('setAutoStartDuration', async ({ roomCode, duration } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session || session.status !== 'waiting' || session.createdBy !== socket.player._id.toString()) return;
      const settings = await GameSettings.getSingleton();
      const fresh = await Player.findById(socket.player._id);
      const tier = getPlayerTier(fresh);
      const tl = settings.autoStartTimer?.tierLimits?.[tier] || { min: 180, max: 180 };
      const clamped = Math.min(tl.max, Math.max(tl.min, parseInt(duration) || 180));
      startAutoStartTimer(code, io, session, clamped);
      socket.emit('autoStartDurationSet', { duration: clamped });
    });

    socket.on('initiateKickVote', async ({ roomCode, targetPlayerId } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session) return;
      const settings = await GameSettings.getSingleton();
      if (!settings.kickSystem?.enabled) return socket.emit('error', { message: 'Kick system disabled' });
      const initiator = session.players.get(socket.id);
      const target    = session.findByPlayerId(targetPlayerId);
      if (!initiator || !target || initiator.playerId === targetPlayerId) return;
      if (session.status === 'waiting' && session.createdBy !== socket.player._id.toString()) return socket.emit('error', { message: 'Only the host can remove players in the waiting room' });
      const minP = settings.kickSystem?.minimumPlayers ?? 3;
      if (session.players.size < minP) {
        if (session.status === 'waiting' && session.createdBy === socket.player._id.toString()) { executeKick(code, io, session, targetPlayerId, 'Removed by host', settings, initiator.playerId); return; }
        return socket.emit('error', { message: `Need at least ${minP} players to vote kick` });
      }
      if (session.kickVotes.has(targetPlayerId)) return socket.emit('error', { message: 'A vote is already running for this player' });
      const timeout = settings.kickSystem?.voteTimeoutSeconds ?? 30;
      const expires = Date.now() + timeout * 1000;
      const votes = new Map();
      votes.set(initiator.playerId, true);
      const timer = setTimeout(() => { session.kickVotes.delete(targetPlayerId); io.to(code).emit('kickVoteExpired', { targetId: targetPlayerId, target: target.username }); }, timeout * 1000);
      session.kickVotes.set(targetPlayerId, { initiatorId: initiator.playerId, votes, timer, expiresAt: expires });
      const others = [...session.players.values()].filter(p => p.playerId !== targetPlayerId);
      const threshold = settings.kickSystem?.thresholdPercent ?? 50;
      const needed = Math.ceil(others.length * threshold / 100);
      io.to(code).emit('kickVoteStarted', { targetId: targetPlayerId, target: target.username, initiator: initiator.username, votesFor: 1, votesNeeded: needed, totalEligible: others.length, expiresAt: expires });
      resolveKickVote(code, io, session, targetPlayerId, settings);
    });

    socket.on('castKickVote', async ({ roomCode, targetPlayerId, vote } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session) return;
      const voter = session.players.get(socket.id);
      const kickVote = session.kickVotes.get(targetPlayerId);
      if (!voter || !kickVote || voter.playerId === targetPlayerId) return;
      kickVote.votes.set(voter.playerId, !!vote);
      const settings = await GameSettings.getSingleton();
      resolveKickVote(code, io, session, targetPlayerId, settings);
    });

    // FIX: reject spectate request for solo games (nobody to watch)
    socket.on('spectateAfterElimination', ({ roomCode } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session) return;
      if (session.isSoloGame()) {
        socket.emit('error', { message: 'No other players to spectate in a solo game' });
        return;
      }
      socket.join(code);
      session.eliminatedSpecs.add(socket.id);
      socket.emit('spectatingAsEliminated', { session: session.toPublicState(true) });
    });

    socket.on('playerSkipToDoor', ({ roomCode } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session || session.roundPhase !== 'puzzle') return;
      let player = session.players.get(socket.id);
      if (!player) { const byId = session.findByPlayerId(socket.player._id.toString()); if (byId) player = byId; }
      if (!player || !player.alive || player.skippedToDoor) return;
      player.skippedToDoor = true;
      io.to(code).emit('playerSkippedToDoor', { username: player.username, skippedCount: session.getAlivePlayers().filter(p => p.skippedToDoor).length, totalAlive: session.getAlivePlayers().length });
      if (session.getAlivePlayers().every(p => p.skippedToDoor)) { clearTimeout(session.roundTimer); startDoorSelection(code, io, session); }
    });

    socket.on('playerChooseDoor', async ({ roomCode, door } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session || session.roundPhase !== 'door_selection' || !['LIVE', 'DIE'].includes(door)) return;
      let player = session.players.get(socket.id);
      if (!player) {
        const byId = session.findByPlayerId(socket.player._id.toString());
        if (byId) { session.players.delete(byId.socketId); byId.socketId = socket.id; session.players.set(socket.id, byId); player = byId; }
      }
      if (!player || !player.alive || session.choices.has(socket.id)) return;
      session.choices.set(socket.id, { door, chosenAt: Date.now() });
      const alive = session.getAlivePlayers();
      const chosen = alive.filter(p => session.choices.has(p.socketId)).length;
      io.to(code).emit('choiceUpdate', { chosenCount: chosen, totalAlive: alive.length, username: player.username });
      const room = session.getCurrentRoom();
      if (room && door === room.correctDoor) {
        const cp = [...session.choices.entries()].filter(([sid, c]) => { const p = session.players.get(sid); return p?.alive && c.door === room.correctDoor; }).length;
        const red = await calcTimerReduction(session, cp, alive.length);
        if (red > 0) io.to(code).emit('timerReduced', { reduction: red, by: player.username });
      }
      if (chosen >= alive.length) { clearTimeout(session.roundTimer); revealResults(code, io, session); }
    });

    socket.on('chatMessage', ({ roomCode, message } = {}) => {
      if (!message || message.length > 200) return;
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session) return;
      const player = session.players.get(socket.id);
      if (!player) return;
      io.to(code).emit('chatMessage', { username: player.username, message: message.trim(), timestamp: Date.now(), isVerified: player.isVerified });
    });

    socket.on('disconnect', reason => {
      setTimeout(() => logger.info(`🔌 Disconnected: ${socket.player?.username} (${reason})`), 0);
      Player.findByIdAndUpdate(socket.player?._id, { isOnline: false, lastSeen: new Date() }).exec();

      // Clean up global socket registry (only if this socket is still the
      // registered one for this player — avoids clobbering a newer connection)
      if (playerSocketRegistry.get(socket.player?._id?.toString()) === socket.id) {
        playerSocketRegistry.delete(socket.player._id.toString());
      }

      for (const [code, session] of activeSessions) {
        const player = session.players.get(socket.id);
        if (player) { handleDisconnect(socket, code, session, player, io); break; }
        if (session.spectators.has(socket.id)) { session.spectators.delete(socket.id); break; }
        if (session.eliminatedSpecs.has(socket.id)) { session.eliminatedSpecs.delete(socket.id); break; }
      }
    });
  });
}

module.exports = initSocketHandlers;
module.exports.getPlayerSocketId = getPlayerSocketId; // exposed for routes that need direct real-time delivery
