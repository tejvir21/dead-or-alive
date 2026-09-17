/**
 * socketHandlers.js — Consolidated, authoritative version
 *
 * Includes every fix from this session (rewritten fully each time since
 * prior patches may not survive resets):
 *   1. recordDailyUsage: split $push/$pull, wrapped in try/catch.
 *   2. Ready-up does NOT auto-start — host must click Start, or the
 *      auto-start timer fallback fires.
 *   3. Team modes (solo/coop/vs) with cascading vs-mode win condition.
 *   4. FAIR SCORING: vs-mode Rule-3 tiebreak and end-screen score use
 *      AVERAGE rooms-survived per player (denominator = each team's
 *      INITIAL roster size, snapshotted at game start), not raw sum.
 *   5. NEW ARCHITECTURE — Async clan battles (replaces the old live-room
 *      clan-vs-clan match entirely):
 *        - Accepting a challenge or matching via queue creates a
 *          ClanBattle: one room sequence generated ONCE (identical test
 *          for both clans), a battleWindowHours-long window (default 24h).
 *        - Each clan member independently starts their own private solo
 *          run (clanBattle:startRun) through that exact sequence,
 *          whenever they're online — no need for both sides to be present.
 *        - Winner = higher aggregate clan score (sum/average/best, per
 *          admin setting) once the window closes (or early, if everyone's
 *          played) — handled by utils/clanBattleExpiry.js.
 *        - Battle runs are solo, single-player, ephemeral sessions with
 *          randomized unguessable room codes — never listed in public
 *          lobbies, so there's no "outsiders joining" concern at all.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const Player       = require('../models/Player');
const Match        = require('../models/Match');
const Clan         = require('../models/Clan');
const ClanChallenge = require('../models/ClanChallenge');
const ClanBattle   = require('../models/ClanBattle');
const GameSettings = require('../models/GameSettings');
const { generateRoomSequence, validateDoorChoice } = require('../utils/roomGenerator');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const notify = require('../utils/notify');

const activeSessions  = new Map();
const reconnectTimers = new Map();
const playerSocketRegistry = new Map();
function getPlayerSocketId(playerId) { return playerSocketRegistry.get(playerId) || null; }

const clanMatchQueue = new Map();

class Team {
  constructor(id, name) {
    this.id = id;
    this.name = name || `Team ${id}`;
    this.playerIds = new Set();
    this.roomsSurvivedScore = 0;
    this.initialSize = 0;
    this.eliminatedAt = null;
  }
}

class GameSession {
  constructor(matchId, roomCode, createdBy, maxPlayers, minPlayers, difficultyCurve, autoStartDuration, mode, coopSubMode) {
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

    this.mode        = mode || 'solo';
    this.coopSubMode = coopSubMode || 'unity';
    this.teams       = new Map();
    this.teamChat    = [];

    this.clanBattleId = null; // NEW: set when this session is a clan-battle solo run
  }

  getAlivePlayers()   { return [...this.players.values()].filter(p => p.alive); }
  getAllPlayers()      { return [...this.players.values()]; }
  getReadyPlayers()   { return [...this.players.values()].filter(p => p.ready); }
  findByPlayerId(pid) { return [...this.players.values()].find(p => p.playerId === pid) || null; }
  getCurrentRoom()    { return this.rooms[this.currentRoomIndex] || null; }
  isTeamMode()        { return this.mode === 'coop' || this.mode === 'vs'; }
  isSoloGame()        { return this.mode === 'solo' && this.getAllPlayers().length <= 1 && this.spectators.size === 0; }

  getPlayerTeam(playerId) {
    for (const team of this.teams.values()) if (team.playerIds.has(playerId)) return team;
    return null;
  }
  getTeamAlivePlayers(teamId) {
    const team = this.teams.get(teamId);
    if (!team) return [];
    return this.getAllPlayers().filter(p => team.playerIds.has(p.playerId) && p.alive);
  }
  getActiveTeams() { return [...this.teams.values()].filter(t => this.getTeamAlivePlayers(t.id).length > 0); }

  getTeamAverageScore(team) {
    const denom = team.initialSize || team.playerIds.size || 1;
    return team.roomsSurvivedScore / denom;
  }

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
      mode: this.mode, coopSubMode: this.mode === 'coop' ? this.coopSubMode : undefined,
      isClanBattleRun: !!this.clanBattleId,
      teams: this.isTeamMode() ? [...this.teams.values()].map(t => ({
        id: t.id, name: t.name, playerIds: [...t.playerIds],
        roomsSurvivedScore: t.roomsSurvivedScore,
        averageScore: Math.round(this.getTeamAverageScore(t) * 10) / 10,
        initialSize: t.initialSize,
        eliminatedAt: t.eliminatedAt,
        aliveCount: this.getTeamAlivePlayers(t.id).length,
      })) : undefined,
      players: this.getAllPlayers().map(p => ({
        id: p.playerId, username: p.username, alive: p.alive, ready: p.ready,
        roomsSurvived: p.roomsSurvived, hasChosen: this.choices.has(p.socketId),
        isVerified: p.isVerified, skippedToDoor: p.skippedToDoor,
        teamId: this.isTeamMode() ? this.getPlayerTeam(p.playerId)?.id || null : undefined,
        clanId: p.clanId || null,
      })),
      currentRoom: spectatorMode ? this.getSpectatorRoom() : this.getSafeCurrentRoom(),
    };
  }
}

class PlayerState {
  constructor(socketId, playerId, username, isVerified, tier, isCreator, clanId) {
    this.socketId = socketId; this.playerId = playerId; this.username = username;
    this.isVerified = !!isVerified; this.tier = tier || 'free';
    this.alive = true;
    this.ready = !!isCreator;
    this.roomsSurvived = 0;
    this.skippedToDoor = false; this.joinedAt = Date.now();
    this.clanId = clanId || null;
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
  try {
    const field  = type === 'create' ? 'roomsCreatedAt' : 'roomsJoinedAt';
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await Player.findByIdAndUpdate(playerId, { $pull: { [field]: { $lt: cutoff } } });
    await Player.findByIdAndUpdate(playerId, { $push: { [field]: new Date() } });
  } catch (err) {
    logger.error('[recordDailyUsage] Failed:', { message: err.message, playerId: playerId?.toString(), type });
  }
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

function executeKick(code, io, session, targetPlayerId, reason, settings, initiatorId) {
  const target = session.findByPlayerId(targetPlayerId);
  if (!target) return;
  const sock = io.sockets.sockets.get(target.socketId);
  if (sock) { sock.emit('youWereKicked', { reason }); sock.leave(code); }

  notify(io, target.playerId, { type: 'kicked_you', title: 'Removed from room', message: `You were removed from room ${code}: ${reason}`, icon: '🚪', meta: { roomCode: code, reason } }).catch(() => {});
  if (initiatorId) notify(io, initiatorId, { type: 'you_kicked_someone', title: 'Player removed', message: `${target.username} was removed from room ${code}`, icon: '👋', meta: { roomCode: code, username: target.username } }).catch(() => {});

  const team = session.getPlayerTeam(target.playerId);
  if (team) team.playerIds.delete(target.playerId);

  if (session.status === 'waiting') {
    session.players.delete(target.socketId);
  } else {
    session.players.delete(target.socketId);
    session.choices.delete(target.socketId);
    checkRoundComplete(code, io, session);
  }

  io.to(code).emit('playerKicked', { username: target.username, reason, session: session.toPublicState() });

  if (session.createdBy === targetPlayerId) {
    const rem = [...session.players.values()];
    if (rem.length > 0) { session.createdBy = rem[0].playerId; io.to(code).emit('hostTransferred', { newHost: rem[0].username }); }
  }
}

function assignTeam(session, playerId, teamId) {
  for (const team of session.teams.values()) team.playerIds.delete(playerId);
  if (!session.teams.has(teamId)) session.teams.set(teamId, new Team(teamId));
  session.teams.get(teamId).playerIds.add(playerId);
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

    if (session.isTeamMode()) {
      for (const team of session.teams.values()) team.initialSize = team.playerIds.size;
    }

    await Match.findOneAndUpdate({ matchId: session.matchId }, { status: 'in_progress', startedAt: new Date(), totalRooms: session.rooms.length });
    io.to(code).emit('gameStarted', { totalRooms: session.rooms.length, session: session.toPublicState() });
    setTimeout(() => startRoom(code, io, session), 2000);
  } catch (err) {
    logger.error('beginGame error:', { message: err.message });
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

function checkRoundComplete(code, io, session) {
  const alive = session.getAlivePlayers();
  if (session.mode === 'coop' && session.coopSubMode === 'unity') {
    const teamHasChosen = [...session.choices.values()].length > 0;
    if (teamHasChosen) { clearTimeout(session.roundTimer); revealResults(code, io, session); }
    return;
  }
  const chosen = alive.filter(p => session.choices.has(p.socketId));
  if (alive.length > 0 && chosen.length >= alive.length) { clearTimeout(session.roundTimer); revealResults(code, io, session); }
}

async function revealResults(code, io, session) {
  clearTimeout(session.roundTimer);
  session.roundPhase = 'reveal';
  const room = session.getCurrentRoom();
  const correctDoor = room.correctDoor;
  const results = [], survivors = [], eliminated = [];
  const wasSoloGame = session.isSoloGame();

  if (session.mode === 'coop' && session.coopSubMode === 'unity') {
    const anyChoice = [...session.choices.values()][0];
    const teamSurvived = anyChoice ? validateDoorChoice(room, anyChoice.door) : false;
    const team = session.teams.get('A');
    for (const player of session.getAlivePlayers()) {
      results.push({ username: player.username, chosenDoor: anyChoice?.door || null, survived: teamSurvived, wasAuto: !!anyChoice?.auto, teamId: 'A' });
      if (teamSurvived) { player.roomsSurvived++; survivors.push(player.username); }
      else              { player.alive = false; eliminated.push(player.username); }
    }
    if (team) team.roomsSurvivedScore += teamSurvived ? session.getAlivePlayers().length : 0;
  } else {
    for (const [sid, choice] of session.choices) {
      const player = session.players.get(sid);
      if (!player || !player.alive) continue;
      const survived = validateDoorChoice(room, choice.door);
      const teamId = session.isTeamMode() ? session.getPlayerTeam(player.playerId)?.id : undefined;
      results.push({ username: player.username, chosenDoor: choice.door, survived, wasAuto: !!choice.auto, teamId });
      if (survived) { player.roomsSurvived++; survivors.push(player.username); if (teamId) session.teams.get(teamId).roomsSurvivedScore++; }
      else          { player.alive = false; eliminated.push(player.username); }
    }
  }

  await Match.findOneAndUpdate({ matchId: session.matchId }, { $push: { rooms: { roomNumber: room.roomNumber, roomId: room.roomId, clueText: room.clueText, correctDoor, difficulty: room.difficulty, survivorCount: survivors.length, eliminatedCount: eliminated.length } } });

  if (session.mode === 'vs') {
    for (const team of session.teams.values()) {
      if (team.eliminatedAt === null && session.getTeamAlivePlayers(team.id).length === 0) {
        team.eliminatedAt = session.currentRoomIndex;
        io.to(code).emit('teamEliminated', { teamId: team.id, teamName: team.name, atRoom: session.currentRoomIndex + 1 });
      }
    }
  }

  setTimeout(() => {
    io.to(code).emit('roundResult', { correctDoor, results, survivors, eliminated, session: session.toPublicState() });
    eliminated.forEach(username => {
      const elim = [...session.players.values()].find(p => p.username === username && !p.alive);
      if (elim) {
        const s = io.sockets.sockets.get(elim.socketId);
        // Clan battle solo runs are inherently 1-player — always "solo"
        // for elimination purposes, so canSpectate is naturally always
        // false there too via wasSoloGame's existing definition
        if (s) s.emit('youWereEliminated', { correctDoor, chosenDoor: session.choices.get(elim.socketId)?.door, canSpectate: !wasSoloGame });
      }
      io.to(code).emit('playerEliminated', { username });
    });
  }, 1000);

  session.revealTimer = setTimeout(async () => {
    const gameOver = await checkGameOver(code, io, session);
    if (gameOver) return;
    if (session.currentRoomIndex >= session.rooms.length - 1) return endGame(code, io, session, session.getAlivePlayers());
    session.currentRoomIndex++;
    io.to(code).emit('nextRoom', { nextRoomNumber: session.currentRoomIndex + 1, alivePlayers: session.getAlivePlayers().length, session: session.toPublicState() });
    setTimeout(() => startRoom(code, io, session), 3000);
  }, 6000);
}

async function checkGameOver(code, io, session) {
  if (session.mode === 'solo' || session.mode === 'coop') {
    const alive = session.getAlivePlayers();
    if (alive.length === 0) { await endGame(code, io, session, []); return true; }
    return false;
  }
  const activeTeams = session.getActiveTeams();
  if (activeTeams.length <= 1) {
    const winners = activeTeams.length === 1 ? session.getTeamAlivePlayers(activeTeams[0].id) : [];
    await endGame(code, io, session, winners, activeTeams[0]?.id);
    return true;
  }
  return false;
}

// ── NEW: record a clan-battle solo run once it ends, and check early finalization ──
async function recordClanBattleRun(session) {
  try {
    const battle = await ClanBattle.findById(session.clanBattleId);
    if (!battle || battle.status !== 'active') return;

    const player = session.getAllPlayers()[0]; // clan battle runs are always exactly 1 player
    if (!player) return;
    if (battle.hasPlayerPlayed(player.playerId)) return; // safety net against double-recording

    battle.runs.push({
      playerId: player.playerId, clanId: player.clanId, username: player.username,
      roomsSurvived: player.roomsSurvived, startedAt: new Date(session.puzzleStartTime || Date.now()), completedAt: new Date(),
    });
    await battle.save();

    // Early finalization: if every current member of both clans has now
    // played, finalize immediately instead of waiting for the window to close
    const [clanA, clanB] = await Promise.all([Clan.findById(battle.clanAId), Clan.findById(battle.clanBId)]);
    if (!clanA || !clanB) return;
    const aPlayedIds = new Set(battle.runs.filter(r => r.clanId.toString() === clanA._id.toString()).map(r => r.playerId.toString()));
    const bPlayedIds = new Set(battle.runs.filter(r => r.clanId.toString() === clanB._id.toString()).map(r => r.playerId.toString()));
    const aComplete = clanA.members.every(m => aPlayedIds.has(m.playerId.toString()));
    const bComplete = clanB.members.every(m => bPlayedIds.has(m.playerId.toString()));

    if (aComplete && bComplete) {
      // Defer to the shared finalize logic in utils/clanBattleExpiry.js by
      // just pulling expiresAt forward — the next hourly cron tick will
      // pick it up within the hour. For instant finalization we'd need
      // access to `io` here; keeping this simple and consistent avoids
      // duplicating the finalize logic in two places.
      battle.expiresAt = new Date();
      await battle.save();
      logger.info(`[recordClanBattleRun] Battle ${battle._id} fully played by both clans — marked for immediate finalization on next cron tick`);
    }
  } catch (err) {
    logger.error('[recordClanBattleRun] Failed:', { message: err.message, battleId: session.clanBattleId });
  }
}

async function endGame(code, io, session, winners = [], winningTeamId = null) {
  clearTimeout(session.roundTimer);
  clearTimeout(session.revealTimer);
  session.status = 'completed';
  session.roundPhase = 'idle';

  let winnerUsernames = winners.map(p => p.username);
  let finalWinningTeamId = winningTeamId;

  if (session.mode === 'vs' && !winningTeamId) {
    const activeTeams = session.getActiveTeams();
    if (activeTeams.length >= 2) {
      const teamSurvivorCounts = activeTeams.map(t => ({ team: t, aliveCount: session.getTeamAlivePlayers(t.id).length }));
      const maxAlive = Math.max(...teamSurvivorCounts.map(t => t.aliveCount));
      const tiedOnAlive = teamSurvivorCounts.filter(t => t.aliveCount === maxAlive);
      let winningTeam;
      if (tiedOnAlive.length === 1) winningTeam = tiedOnAlive[0].team;
      else winningTeam = tiedOnAlive.reduce((best, cur) =>
        session.getTeamAverageScore(cur.team) > session.getTeamAverageScore(best.team) ? cur : best, tiedOnAlive[0]).team;
      finalWinningTeamId = winningTeam.id;
      winnerUsernames = session.getTeamAlivePlayers(winningTeam.id).map(p => p.username);
    }
  }

  const updates = session.getAllPlayers().map(p => Player.findByIdAndUpdate(p.playerId, { $inc: { gamesPlayed: 1, 'stats.gamesPlayed': 1, 'stats.wins': winnerUsernames.includes(p.username) ? 1 : 0, 'stats.totalRoomsSurvived': p.roomsSurvived } }));

  // FIX: write actual per-player results onto the Match document so
  // match history can show real data (previously only playerId/username/
  // joinedAt were ever written — isWinner/roomsSurvived never existed on
  // any Match document, which is why history always showed "ELIMINATED
  // · 0 rooms" regardless of the real outcome). Requires Match.js's
  // players[] subdocument schema to declare isWinner/roomsSurvived — see
  // MATCH_PLAYERS_RESULT_FIX.md and run verify-match-schema.js to confirm.
  const finalPlayers = session.getAllPlayers().map(p => ({
    playerId: p.playerId,
    username: p.username,
    joinedAt: p.joinedAt ? new Date(p.joinedAt) : new Date(),
    isWinner: winnerUsernames.includes(p.username),
    roomsSurvived: p.roomsSurvived,
  }));

  await Promise.all([
    ...updates,
    Match.findOneAndUpdate(
      { matchId: session.matchId },
      { status: 'completed', endedAt: new Date(), winnersCount: winnerUsernames.length, players: finalPlayers }
    ),
  ]);

  // Live vs-mode team stat update (clan-affiliated players in a normal team match)
  if (session.isTeamMode() && !session.clanBattleId) {
    const clanIdsInvolved = new Set(session.getAllPlayers().map(p => p.clanId).filter(Boolean));
    for (const clanId of clanIdsInvolved) {
      const won = session.getAllPlayers().some(p => p.clanId === clanId && winnerUsernames.includes(p.username));
      const roomsSurvivedByClan = session.getAllPlayers().filter(p => p.clanId === clanId).reduce((sum, p) => sum + p.roomsSurvived, 0);
      Clan.findByIdAndUpdate(clanId, {
        $inc: {
          'stats.totalMatches': 1, 'stats.totalWins': won ? 1 : 0, 'stats.totalRoomsSurvived': roomsSurvivedByClan,
          'statsWeekly.matches': 1, 'statsWeekly.wins': won ? 1 : 0, 'statsWeekly.roomsSurvived': roomsSurvivedByClan,
          'statsMonthly.matches': 1, 'statsMonthly.wins': won ? 1 : 0, 'statsMonthly.roomsSurvived': roomsSurvivedByClan,
        },
      }).exec();
    }
  }

  // NEW: clan battle solo run — record it into the ClanBattle instead of
  // treating this like a normal solo game end
  if (session.clanBattleId) {
    await recordClanBattleRun(session);
  }

  io.to(code).emit('gameEnd', {
    winners: winnerUsernames, winningTeamId: finalWinningTeamId, mode: session.mode,
    isClanBattleRun: !!session.clanBattleId,
    teams: session.isTeamMode() ? [...session.teams.values()].map(t => ({
      id: t.id, name: t.name, roomsSurvivedScore: t.roomsSurvivedScore,
      averageScore: Math.round(session.getTeamAverageScore(t) * 10) / 10,
      initialSize: t.initialSize, eliminatedAt: t.eliminatedAt,
    })) : undefined,
    allPlayers: session.getAllPlayers().map(p => ({ username: p.username, roomsSurvived: p.roomsSurvived, alive: p.alive, teamId: session.isTeamMode() ? session.getPlayerTeam(p.playerId)?.id : undefined })),
    totalRooms: session.rooms.length,
  });

  if (!session.clanBattleId) {
    session.getAllPlayers().forEach(p => {
      const won = winnerUsernames.includes(p.username);
      notify(io, p.playerId, {
        type: won ? 'game_won' : 'game_eliminated',
        title: won ? '🏆 You escaped!' : '💀 Game over',
        message: won ? `You survived all ${session.rooms.length} rooms in match ${code}!` : `You survived ${p.roomsSurvived}/${session.rooms.length} rooms in match ${code}.`,
        icon: won ? '🏆' : '💀',
        meta: { roomCode: code, roomsSurvived: p.roomsSurvived, totalRooms: session.rooms.length },
      }).catch(() => {});
    });
  } else {
    // Clan battle run confirmation notification instead of win/loss framing
    // (the actual clan-vs-clan winner is decided later when the battle closes)
    const p = session.getAllPlayers()[0];
    if (p) {
      notify(io, p.playerId, {
        type: 'generic', title: '⚔ Battle Run Complete',
        message: `You survived ${p.roomsSurvived}/${session.rooms.length} rooms for your clan. Results are tallied once the battle window closes.`,
        icon: '⚔', meta: { battleId: session.clanBattleId, roomsSurvived: p.roomsSurvived },
      }).catch(() => {});
    }
  }

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
      checkGameOver(code, io, session);
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
    const team = session.getPlayerTeam(player.playerId);
    if (team) team.playerIds.delete(player.playerId);
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

// ── NEW: create an async ClanBattle — generates the shared room sequence
// ONCE, sets the window expiry, notifies every online member of both clans ──
async function createClanBattle(io, clanA, clanB) {
  const settings = await GameSettings.getSingleton();
  const bs = settings.clanBattleSettings || {};

  // roomGenerator.js accepts an optional 4th param (roomCountOverride)
  // added specifically for clan battles — confirmed against the actual
  // file, so clanBattleSettings.roomCount genuinely takes effect here.
  const roomSequence = await generateRoomSequence(1, [], 'stepped', bs.roomCount || 10);
  const expiresAt = new Date(Date.now() + (bs.battleWindowHours || 24) * 60 * 60 * 1000);

  const battle = await ClanBattle.create({
    clanAId: clanA._id, clanBId: clanB._id,
    difficultyCurve: 'stepped', roomSequence,
    startedAt: new Date(), expiresAt,
    scoringMode: bs.scoringMode || 'sum',
  });

  const allMembers = [...clanA.members, ...clanB.members];
  for (const m of allMembers) {
    const socketId = getPlayerSocketId(m.playerId.toString());
    notify(io, m.playerId, {
      type: 'generic', title: '⚔ Clan Battle Started!',
      message: `${clanA.tag} vs ${clanB.tag} — you have ${bs.battleWindowHours || 24}h to play your run.`,
      icon: '⚔', meta: { battleId: battle._id, clanAId: clanA._id, clanBId: clanB._id },
    }).catch(() => {});
    if (socketId) io.to(socketId).emit('clanBattleStarted', {
      battleId: battle._id, clanA: { id: clanA._id, tag: clanA.tag }, clanB: { id: clanB._id, tag: clanB.tag }, expiresAt,
    });
  }

  return battle;
}

function initSocketHandlers(io) {
  io.use(authenticateSocket);
  notify.initNotify(io, getPlayerSocketId);

  io.on('connection', socket => {
    setTimeout(() => logger.info(`🔌 Connected: ${socket.player.username} (${socket.id})`), 0);
    Player.findByIdAndUpdate(socket.player._id, { isOnline: true, lastSeen: new Date() }).exec();
    playerSocketRegistry.set(socket.player._id.toString(), socket.id);

    socket.on('createRoom', async ({ maxPlayers = 8, minPlayers = 1, difficultyCurve, autoStartDuration, mode = 'solo', coopSubMode = 'unity', teamCount = 2 } = {}) => {
      try {
        const settings = await GameSettings.getSingleton();
        if (settings.features.maintenanceMode) return socket.emit('error', { message: 'Server under maintenance.' });
        if (['coop', 'vs'].includes(mode) && settings.features?.teamModesEnabled === false) return socket.emit('error', { message: 'Team modes are currently disabled.' });

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
        const validMode = ['solo', 'coop', 'vs'].includes(mode) ? mode : 'solo';
        const validCoopSub = ['unity', 'resilience'].includes(coopSubMode) ? coopSubMode : 'unity';

        await Match.create({ matchId, roomCode, maxPlayers: safeMax, minPlayers: safeMin, createdBy: socket.player._id, players: [{ playerId: socket.player._id, username: socket.player.username, joinedAt: new Date() }], status: 'waiting', difficultyCurve: difficultyCurve || 'stepped', mode: validMode });
        await recordDailyUsage(socket.player._id, 'create');

        const session = new GameSession(matchId, roomCode, socket.player._id.toString(), safeMax, safeMin, difficultyCurve, dur, validMode, validCoopSub);
        const creatorClan = await Clan.findOne({ 'members.playerId': socket.player._id });
        const ps = new PlayerState(socket.id, socket.player._id.toString(), socket.player.username, socket.player.isVerified, tier, true, creatorClan?._id?.toString());
        session.players.set(socket.id, ps);

        if (validMode === 'coop') {
          session.teams.set('A', new Team('A', 'Team'));
          session.teams.get('A').playerIds.add(ps.playerId);
        } else if (validMode === 'vs') {
          const tc = Math.max(2, Math.min(4, parseInt(teamCount) || 2));
          for (let i = 0; i < tc; i++) session.teams.set(String.fromCharCode(65 + i), new Team(String.fromCharCode(65 + i)));
          session.teams.get('A').playerIds.add(ps.playerId);
        }

        activeSessions.set(roomCode, session);
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, session: session.toPublicState(), tierLimits: tl, tier });
        if (settings.features?.autoStartEnabled !== false && settings.autoStartTimer?.enabled !== false) startAutoStartTimer(roomCode, io, session, dur);
      } catch (err) { logger.error('createRoom error:', { message: err.message }); socket.emit('error', { message: 'Failed to create room' }); }
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
        const joinerClan = await Clan.findOne({ 'members.playerId': socket.player._id });
        const ps2 = new PlayerState(socket.id, socket.player._id.toString(), socket.player.username, socket.player.isVerified, tier2, false, joinerClan?._id?.toString());
        session.players.set(socket.id, ps2);

        if (session.mode === 'coop') {
          session.teams.get('A')?.playerIds.add(ps2.playerId);
        } else if (session.mode === 'vs') {
          const teams = [...session.teams.values()];
          const smallest = teams.reduce((a, b) => a.playerIds.size <= b.playerIds.size ? a : b);
          smallest.playerIds.add(ps2.playerId);
        }

        await recordDailyUsage(socket.player._id, 'join');
        await Match.findOneAndUpdate({ matchId: session.matchId }, { $push: { players: { playerId: socket.player._id, username: socket.player.username, joinedAt: new Date() } } });
        socket.join(code);
        socket.emit('joinedRoom', { session: session.toPublicState() });
        io.to(code).emit('playerJoined', { username: socket.player.username, session: session.toPublicState() });
      } catch (err) { logger.error('joinRoom error:', { message: err.message }); socket.emit('error', { message: 'Failed to join room' }); }
    });

    socket.on('assignTeam', ({ roomCode, targetPlayerId, teamId } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session || session.status !== 'waiting' || !session.isTeamMode()) return;
      if (session.createdBy !== socket.player._id.toString()) return socket.emit('error', { message: 'Only the host can assign teams' });
      if (!session.teams.has(teamId)) return socket.emit('error', { message: 'Invalid team' });
      assignTeam(session, targetPlayerId, teamId);
      io.to(code).emit('teamsUpdated', { session: session.toPublicState() });
    });

    socket.on('quickTeam', ({ roomCode } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session || session.status !== 'waiting' || !session.isTeamMode()) return;
      if (session.createdBy !== socket.player._id.toString()) return socket.emit('error', { message: 'Only the host can quick-team' });

      const players = [...session.players.values()];
      const byClan = new Map();
      const unclanned = [];
      players.forEach(p => { if (p.clanId) { if (!byClan.has(p.clanId)) byClan.set(p.clanId, []); byClan.get(p.clanId).push(p); } else unclanned.push(p); });

      const teamIds = [...session.teams.keys()];
      session.teams.forEach(t => t.playerIds.clear());
      let teamIdx = 0;
      for (const group of byClan.values()) { const tid = teamIds[teamIdx % teamIds.length]; group.forEach(p => session.teams.get(tid).playerIds.add(p.playerId)); teamIdx++; }
      unclanned.forEach((p, i) => { const tid = teamIds[(teamIdx + i) % teamIds.length]; session.teams.get(tid).playerIds.add(p.playerId); });

      io.to(code).emit('teamsUpdated', { session: session.toPublicState() });
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
      const allReady = session.getReadyPlayers().length >= session.players.size && session.players.size >= session.minPlayers;
      if (allReady) io.to(code).emit('allPlayersReady', { session: session.toPublicState() });
    });

    socket.on('startGame', async ({ roomCode } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session) return socket.emit('error', { message: 'Room not found' });
      if (session.createdBy !== socket.player._id.toString()) return socket.emit('error', { message: 'Only the host can start' });
      if (session.status !== 'waiting') return;
      if (session.mode === 'vs') {
        const nonEmptyTeams = [...session.teams.values()].filter(t => t.playerIds.size > 0);
        if (nonEmptyTeams.length < 2) return socket.emit('error', { message: 'Vs mode needs at least 2 teams with players' });
      }
      const ready = session.getReadyPlayers();
      if (ready.length < session.minPlayers) return socket.emit('error', { message: `Need at least ${session.minPlayers} ready player(s)` });
      const notReady = [...session.players.values()].filter(p => !p.ready);
      notReady.forEach(p => {
        session.players.delete(p.socketId);
        const t = session.getPlayerTeam(p.playerId); if (t) t.playerIds.delete(p.playerId);
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

    socket.on('spectateAfterElimination', ({ roomCode } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session) return;
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
      if (!player || !player.alive) return;

      if (session.mode === 'coop' && session.coopSubMode === 'unity') {
        if (session.choices.size > 0) return;
        session.choices.set(socket.id, { door, chosenAt: Date.now() });
        io.to(code).emit('teamChoiceMade', { by: player.username, teamId: 'A' });
        checkRoundComplete(code, io, session);
        return;
      }

      if (session.choices.has(socket.id)) return;
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
      checkRoundComplete(code, io, session);
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

    socket.on('teamChatMessage', ({ roomCode, message } = {}) => {
      if (!message || message.length > 200) return;
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session || !session.isTeamMode()) return;
      const player = session.players.get(socket.id);
      if (!player) return;
      const team = session.getPlayerTeam(player.playerId);
      if (!team) return;
      const chatMsg = { teamId: team.id, username: player.username, message: message.trim(), timestamp: Date.now() };
      session.teamChat.push(chatMsg);
      if (session.teamChat.length > 200) session.teamChat.shift();
      const teammates = [...session.players.values()].filter(p => team.playerIds.has(p.playerId));
      teammates.forEach(tm => { const s = io.sockets.sockets.get(tm.socketId); if (s) s.emit('teamChatMessage', chatMsg); });
    });

    // ── Clan challenge accept/decline → creates an async ClanBattle (not a
    // live room) if accepted ──────────────────────────────────────────────────
    socket.on('clanChallenge:respond', async ({ challengeId, accept } = {}) => {
      try {
        const challenge = await ClanChallenge.findById(challengeId);
        if (!challenge || challenge.status !== 'pending') return socket.emit('error', { message: 'Challenge not found or already resolved' });
        const targetClan = await Clan.findById(challenge.targetClanId);
        if (!targetClan) return socket.emit('error', { message: 'Target clan not found' });
        const role = targetClan.getRole(socket.player._id);
        if (!['owner', 'admin'].includes(role)) return socket.emit('error', { message: 'Only clan owner/admin can respond to challenges' });

        challenge.status = accept ? 'accepted' : 'declined';
        challenge.respondedBy = socket.player._id;
        challenge.respondedAt = new Date();

        if (accept) {
          const challengerClan = await Clan.findById(challenge.challengerClanId);
          if (!challengerClan) return socket.emit('error', { message: 'Challenger clan no longer exists' });
          const battle = await createClanBattle(io, challengerClan, targetClan);
          challenge.battleId = battle._id;
          await challenge.save();
          socket.emit('clanChallengeResolved', { accepted: true, battleId: battle._id });
        } else {
          await challenge.save();
          notify(io, challenge.sentBy, { type: 'generic', title: 'Challenge Declined', message: `${targetClan.name} declined your clan challenge.`, icon: '❌' }).catch(() => {});
          socket.emit('clanChallengeResolved', { accepted: false });
        }
      } catch (err) {
        logger.error('clanChallenge:respond error:', { message: err.message });
        socket.emit('error', { message: 'Failed to respond to challenge' });
      }
    });

    // ── Random queue → creates an async ClanBattle immediately on match ─────────
    socket.on('clanQueue:join', async () => {
      try {
        const settings = await GameSettings.getSingleton();
        if (!settings.features?.clanMatchmakingEnabled) return socket.emit('error', { message: 'Clan matchmaking is currently disabled' });
        const myClan = await Clan.findOne({ 'members.playerId': socket.player._id });
        if (!myClan) return socket.emit('error', { message: 'You must be in a clan to queue' });
        const role = myClan.getRole(socket.player._id);
        if (!['owner', 'admin'].includes(role)) return socket.emit('error', { message: 'Only clan owner/admin can queue the clan' });
        if (clanMatchQueue.has(myClan._id.toString())) return socket.emit('error', { message: 'Your clan is already in the queue' });

        const otherEntry = [...clanMatchQueue.entries()].find(([cid]) => cid !== myClan._id.toString());
        if (otherEntry) {
          const [otherClanId] = otherEntry;
          clanMatchQueue.delete(otherClanId);
          const otherClan = await Clan.findById(otherClanId);
          if (!otherClan) { clanMatchQueue.set(myClan._id.toString(), { queuedAt: Date.now(), queuedBy: socket.player._id.toString() }); return; }
          const battle = await createClanBattle(io, myClan, otherClan);
          socket.emit('clanQueueMatched', { battleId: battle._id, opponent: { id: otherClan._id, tag: otherClan.tag, name: otherClan.name } });
        } else {
          clanMatchQueue.set(myClan._id.toString(), { queuedAt: Date.now(), queuedBy: socket.player._id.toString() });
          socket.emit('clanQueueJoined', { message: 'Waiting for another clan to queue…' });
        }
      } catch (err) {
        logger.error('clanQueue:join error:', { message: err.message });
        socket.emit('error', { message: 'Failed to join matchmaking queue' });
      }
    });

    socket.on('clanQueue:leave', async () => {
      const myClan = await Clan.findOne({ 'members.playerId': socket.player._id });
      if (myClan) clanMatchQueue.delete(myClan._id.toString());
      socket.emit('clanQueueLeft', {});
    });

    // ── NEW: start an individual clan-battle run — private, single-player,
    // uses the battle's pre-generated (identical for both clans) room
    // sequence. Never appears in public lobbies (random unguessable code,
    // 1-player max, not flagged as an open/joinable room). ───────────────────
    socket.on('clanBattle:startRun', async ({ battleId } = {}) => {
      try {
        const battle = await ClanBattle.findById(battleId);
        if (!battle || battle.status !== 'active') return socket.emit('error', { message: 'Battle not found or no longer active' });
        if (battle.expiresAt < new Date()) return socket.emit('error', { message: 'This battle\'s window has closed' });

        const myClan = await Clan.findOne({ 'members.playerId': socket.player._id });
        const myClanId = myClan?._id?.toString();
        if (myClanId !== battle.clanAId.toString() && myClanId !== battle.clanBId.toString())
          return socket.emit('error', { message: 'You are not part of this clan battle' });

        if (battle.hasPlayerPlayed(socket.player._id.toString()))
          return socket.emit('error', { message: 'You have already played your run for this battle' });

        const roomCode = uuidv4().substring(0, 6).toUpperCase();
        const matchId  = uuidv4();
        await Match.create({
          matchId, roomCode, maxPlayers: 1, minPlayers: 1, createdBy: socket.player._id,
          players: [{ playerId: socket.player._id, username: socket.player.username, joinedAt: new Date() }],
          status: 'in_progress', difficultyCurve: battle.difficultyCurve, mode: 'solo',
          isClanBattleRun: true, // never shown in public lobbies — see routes/game.js /lobbies filter
        });

        const session = new GameSession(matchId, roomCode, socket.player._id.toString(), 1, 1, battle.difficultyCurve, 0, 'solo', undefined);
        session.rooms = battle.roomSequence; // identical sequence for every participant — no fresh generation here
        session.clanBattleId = battle._id.toString();
        session.status = 'in_progress';
        const ps = new PlayerState(socket.id, socket.player._id.toString(), socket.player.username, socket.player.isVerified, getPlayerTier(socket.player), true, myClanId);
        session.players.set(socket.id, ps);
        activeSessions.set(roomCode, session);
        socket.join(roomCode);

        await Match.findOneAndUpdate({ matchId }, { totalRooms: session.rooms.length });
        socket.emit('gameStarted', { totalRooms: session.rooms.length, session: session.toPublicState() });
        setTimeout(() => startRoom(roomCode, io, session), 1500);
      } catch (err) {
        logger.error('clanBattle:startRun error:', { message: err.message });
        socket.emit('error', { message: 'Failed to start your battle run' });
      }
    });

    socket.on('disconnect', reason => {
      setTimeout(() => logger.info(`🔌 Disconnected: ${socket.player?.username} (${reason})`), 0);
      Player.findByIdAndUpdate(socket.player?._id, { isOnline: false, lastSeen: new Date() }).exec();
      if (playerSocketRegistry.get(socket.player?._id?.toString()) === socket.id) playerSocketRegistry.delete(socket.player._id.toString());
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
module.exports.getPlayerSocketId = getPlayerSocketId;
