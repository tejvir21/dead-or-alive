/**
 * socketHandlers.js — Phase 1 Fixed
 *
 * Root cause of "chose correct door but got eliminated":
 *
 *   playerChooseDoor looked up the player ONLY by socket.id.
 *   If the socket.id changed between session registration and the door click
 *   (due to an unnecessary joinRoom re-emit from GamePage), the lookup
 *   returned null and the choice was silently dropped. Timer expired,
 *   server auto-assigned a random door, wrong door = eliminated.
 *
 * Fixes:
 *   1. playerChooseDoor: falls back to playerId lookup if socket.id misses,
 *      then corrects the session.players map entry in-place.
 *   2. joinRoom: active players (already in session.players) are NEVER
 *      demoted to spectator, even if the game is in_progress.
 *   3. beginGame: emits gameStarted AFTER rooms are generated so the
 *      client has totalRooms immediately.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const Player = require('../models/Player');
const Match = require('../models/Match');
const GameSettings = require('../models/GameSettings');
const { generateRoomSequence, validateDoorChoice } = require('../utils/roomGenerator');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const activeSessions = new Map();
const reconnectTimers = new Map();

class GameSession {
  constructor(matchId, roomCode, createdBy, maxPlayers, minPlayers, difficultyCurve) {
    this.matchId = matchId;
    this.roomCode = roomCode;
    this.createdBy = createdBy;
    this.maxPlayers = maxPlayers;
    this.minPlayers = minPlayers;
    this.difficultyCurve = difficultyCurve || 'stepped';
    this.status = 'waiting';
    this.players = new Map();
    this.spectators = new Set();
    this.rooms = [];
    this.currentRoomIndex = 0;
    this.roundPhase = 'idle';
    this.roundTimer = null;
    this.revealTimer = null;
    this.choices = new Map();
    this.puzzleStartTime = null;
    this.doorStartTime = null;
  }

  getAlivePlayers()  { return [...this.players.values()].filter(p => p.alive); }
  getAllPlayers()     { return [...this.players.values()]; }
  getCurrentRoom()   { return this.rooms[this.currentRoomIndex] || null; }

  // Find a player by playerId regardless of current socketId
  findPlayerByPlayerId(playerId) {
    return [...this.players.values()].find(p => p.playerId === playerId) || null;
  }

  getSafeCurrentRoom() {
    const r = this.getCurrentRoom();
    if (!r) return null;
    const { correctDoor, answerRule, resolvedVars, clueSeed, ...safe } = r;
    return safe;
  }

  toPublicState() {
    return {
      roomCode: this.roomCode,
      status: this.status,
      roundPhase: this.roundPhase,
      currentRoomIndex: this.currentRoomIndex,
      totalRooms: this.rooms.length,
      minPlayers: this.minPlayers,
      maxPlayers: this.maxPlayers,
      createdBy: this.createdBy,
      difficultyCurve: this.difficultyCurve,
      players: this.getAllPlayers().map(p => ({
        id: p.playerId,
        username: p.username,
        alive: p.alive,
        ready: p.ready,
        roomsSurvived: p.roomsSurvived,
        hasChosen: this.choices.has(p.socketId),
        isVerified: p.isVerified,
        skippedToDoor: p.skippedToDoor,
      })),
      currentRoom: this.getSafeCurrentRoom(),
    };
  }
}

class PlayerState {
  constructor(socketId, playerId, username, isVerified) {
    this.socketId = socketId;
    this.playerId = playerId;
    this.username = username;
    this.isVerified = !!isVerified;
    this.alive = true;
    this.ready = false;
    this.roomsSurvived = 0;
    this.skippedToDoor = false;
    this.joinedAt = Date.now();
  }
}

async function authenticateSocket(socket, next) {
  try {
    const token = (socket.handshake.auth?.token || socket.handshake.headers?.authorization || '')
      .replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const player = await Player.findById(decoded.id).select('-password -otp');
    if (!player) return next(new Error('Player not found'));
    if (player.isBanned && (!player.banUntil || player.banUntil > new Date()))
      return next(new Error('Account banned'));
    socket.player = player;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return next(new Error('Token expired'));
    next(new Error('Invalid token'));
  }
}

async function calcTimerReduction(session, correctPickers, totalAlive) {
  const settings = await GameSettings.getSingleton();
  if (!settings.timerReductionEnabled) return 0;
  const baseFactor = settings.timerReductionFactor || 0.3;
  const doorTimer  = settings.doorTimerSeconds || 30;
  const elapsed    = (Date.now() - (session.doorStartTime || Date.now())) / 1000;
  const remaining  = Math.max(0, doorTimer - elapsed);
  const speedFactor   = Math.max(0, (doorTimer - elapsed) / doorTimer);
  const percentFactor = totalAlive > 0 ? correctPickers / totalAlive : 0;
  return Math.round(remaining * percentFactor * speedFactor * baseFactor);
}

function initSocketHandlers(io) {
  io.use(authenticateSocket);

  io.on('connection', socket => {
    // socket.id is reliably available after next tick in some versions
    setTimeout(() => logger.info(`🔌 Connected: ${socket.player.username} (${socket.id})`), 0);
    Player.findByIdAndUpdate(socket.player._id, { isOnline: true, lastSeen: new Date() }).exec();

    // ── createRoom ────────────────────────────────────────────────────────────
    socket.on('createRoom', async ({ maxPlayers = 8, minPlayers = 1, difficultyCurve, isPasswordProtected } = {}) => {
      try {
        const settings = await GameSettings.getSingleton();
        if (settings.features.maintenanceMode)
          return socket.emit('error', { message: 'Server is under maintenance.' });

        const playerMaxAllowed = socket.player.maxPlayers(settings);
        const safeMax = Math.min(playerMaxAllowed, Math.max(1, parseInt(maxPlayers) || 8));
        const safeMin = Math.min(safeMax, Math.max(1, parseInt(minPlayers) || 1));

        const roomCode = uuidv4().substring(0, 6).toUpperCase();
        const matchId  = uuidv4();

        await Match.create({
          matchId, roomCode,
          maxPlayers: safeMax, minPlayers: safeMin,
          createdBy: socket.player._id,
          players: [{ playerId: socket.player._id, username: socket.player.username, joinedAt: new Date() }],
          status: 'waiting',
          difficultyCurve: difficultyCurve || 'stepped',
          isPasswordProtected: !!isPasswordProtected,
        });

        const session = new GameSession(matchId, roomCode, socket.player._id.toString(), safeMax, safeMin, difficultyCurve);
        const ps = new PlayerState(socket.id, socket.player._id.toString(), socket.player.username, socket.player.isVerified);
        session.players.set(socket.id, ps);
        activeSessions.set(roomCode, session);

        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, session: session.toPublicState() });
      } catch (err) {
        logger.error('createRoom error:', err);
        socket.emit('error', { message: 'Failed to create room' });
      }
    });

    // ── joinRoom ──────────────────────────────────────────────────────────────
    socket.on('joinRoom', async ({ roomCode, spectate = false } = {}) => {
      try {
        const code = (roomCode || '').toUpperCase();
        const session = activeSessions.get(code);
        if (!session) return socket.emit('error', { message: 'Room not found' });

        // ── FIX: Reconnection check BEFORE spectator check ────────────────────
        // Active players must NEVER be demoted to spectators, even during
        // in_progress games. Check by playerId (not socket.id) so it survives
        // socket reconnects and client-side navigation.
        const existing = session.findPlayerByPlayerId(socket.player._id.toString());
        if (existing) {
          const timerKey = `${code}:${socket.player._id}`;
          const reconnTimer = reconnectTimers.get(timerKey);
          if (reconnTimer) {
            clearTimeout(reconnTimer);
            reconnectTimers.delete(timerKey);
          }

          // Reattach socket — update the map key to the current socket.id
          if (existing.socketId !== socket.id) {
            session.players.delete(existing.socketId);
            existing.socketId = socket.id;
            session.players.set(socket.id, existing);
          }

          socket.join(code);
          socket.emit('reconnected', { session: session.toPublicState() });
          io.to(code).emit('playerReconnected', { username: socket.player.username, session: session.toPublicState() });

          // Resend current state with REMAINING time (not full duration)
          // so a mid-game refresh doesn't restart the timer from 30s
          if (session.status === 'in_progress') {
            const room = session.getSafeCurrentRoom();
            const settings = await GameSettings.getSingleton();

            if (room && session.roundPhase === 'puzzle') {
              const fullTimer = settings.puzzleTimerSeconds || 30;
              const elapsed   = Math.floor((Date.now() - (session.puzzleStartTime || Date.now())) / 1000);
              const remaining = Math.max(1, fullTimer - elapsed);
              socket.emit('roomStarted', { ...room, totalRooms: session.rooms.length, timerSeconds: remaining });

            } else if (session.roundPhase === 'door_selection') {
              const fullTimer = settings.doorTimerSeconds || 30;
              const elapsed   = Math.floor((Date.now() - (session.doorStartTime || Date.now())) / 1000);
              const remaining = Math.max(1, fullTimer - elapsed);
              socket.emit('doorSelectionStarted', { timerSeconds: remaining, session: session.toPublicState() });
            }
          }
          return;
        }

        // ── Spectator (game already started, not an active player) ────────────
        if (spectate || session.status === 'in_progress') {
          socket.join(code);
          session.spectators.add(socket.id);
          socket.emit('joinedAsSpectator', { session: session.toPublicState() });
          io.to(code).emit('spectatorJoined', { username: socket.player.username });
          return;
        }

        // ── Normal join ───────────────────────────────────────────────────────
        if (session.status !== 'waiting')
          return socket.emit('error', { message: 'Game already started.' });
        if (session.players.size >= session.maxPlayers)
          return socket.emit('error', { message: 'Room is full' });

        const ps = new PlayerState(socket.id, socket.player._id.toString(), socket.player.username, socket.player.isVerified);
        session.players.set(socket.id, ps);

        await Match.findOneAndUpdate(
          { matchId: session.matchId },
          { $push: { players: { playerId: socket.player._id, username: socket.player.username, joinedAt: new Date() } } }
        );

        socket.join(code);
        socket.emit('joinedRoom', { session: session.toPublicState() });
        io.to(code).emit('playerJoined', { username: socket.player.username, session: session.toPublicState() });
      } catch (err) {
        logger.error('joinRoom error:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // ── leaveRoom ─────────────────────────────────────────────────────────────
    socket.on('leaveRoom', ({ roomCode } = {}) => {
      handleLeave(socket, (roomCode || '').toUpperCase(), io, false);
    });

    // ── playerReady ───────────────────────────────────────────────────────────
    socket.on('playerReady', ({ roomCode } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session) return;
      const player = session.players.get(socket.id);
      if (!player) return;
      player.ready = true;
      io.to(code).emit('playerReadyUpdate', { username: player.username, session: session.toPublicState() });
      const allReady = session.getAlivePlayers().every(p => p.ready);
      if (allReady && session.players.size >= session.minPlayers && session.status === 'waiting') {
        startCountdown(code, io, session);
      }
    });

    // ── startGame ─────────────────────────────────────────────────────────────
    socket.on('startGame', ({ roomCode } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session) return socket.emit('error', { message: 'Room not found' });
      if (session.createdBy !== socket.player._id.toString())
        return socket.emit('error', { message: 'Only the host can start' });
      if (session.status !== 'waiting') return;
      if (session.players.size < session.minPlayers)
        return socket.emit('error', { message: `Need at least ${session.minPlayers} player(s)` });
      startCountdown(code, io, session);
    });

    // ── playerSkipToDoor ──────────────────────────────────────────────────────
    socket.on('playerSkipToDoor', ({ roomCode } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session || session.roundPhase !== 'puzzle') return;
      const player = session.players.get(socket.id)
        || session.findPlayerByPlayerId(socket.player._id.toString());
      if (!player || !player.alive || player.skippedToDoor) return;
      player.skippedToDoor = true;
      io.to(code).emit('playerSkippedToDoor', {
        username: player.username,
        skippedCount: session.getAlivePlayers().filter(p => p.skippedToDoor).length,
        totalAlive: session.getAlivePlayers().length,
      });
      const allSkipped = session.getAlivePlayers().every(p => p.skippedToDoor);
      if (allSkipped) {
        clearTimeout(session.roundTimer);
        startDoorSelection(code, io, session);
      }
    });

    // ── playerChooseDoor ──────────────────────────────────────────────────────
    socket.on('playerChooseDoor', async ({ roomCode, door } = {}) => {
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session || session.roundPhase !== 'door_selection') return;
      if (!['LIVE', 'DIE'].includes(door)) return;

      // ── FIX: look up by socket.id first, fall back to playerId ───────────
      // This prevents silent drops when socket.id changed between registration
      // and the door click (e.g. due to an unnecessary joinRoom re-emit).
      let player = session.players.get(socket.id);
      if (!player) {
        // Fallback: find by playerId and correct the map entry
        const byId = session.findPlayerByPlayerId(socket.player._id.toString());
        if (byId) {
          logger.warn(`[choiceDoor] socket.id mismatch for ${socket.player.username} — correcting entry`);
          session.players.delete(byId.socketId);
          byId.socketId = socket.id;
          session.players.set(socket.id, byId);
          player = byId;
        }
      }

      if (!player || !player.alive) return;
      // Don't allow choosing twice
      if (session.choices.has(socket.id)) return;

      const chosenAt = Date.now();
      session.choices.set(socket.id, { door, chosenAt });

      const alivePlayers = session.getAlivePlayers();
      const chosenCount  = alivePlayers.filter(p => session.choices.has(p.socketId)).length;

      io.to(code).emit('choiceUpdate', {
        chosenCount,
        totalAlive: alivePlayers.length,
        username: player.username,
      });

      // Timer reduction on correct early pick
      const room = session.getCurrentRoom();
      if (room && door === room.correctDoor) {
        const correctPickers = [...session.choices.entries()]
          .filter(([sid, c]) => { const p = session.players.get(sid); return p?.alive && c.door === room.correctDoor; })
          .length;
        const reduction = await calcTimerReduction(session, correctPickers, alivePlayers.length);
        if (reduction > 0) io.to(code).emit('timerReduced', { reduction, by: player.username });
      }

      // All chose → reveal immediately
      if (chosenCount >= alivePlayers.length) {
        clearTimeout(session.roundTimer);
        revealResults(code, io, session);
      }
    });

    // ── chatMessage ───────────────────────────────────────────────────────────
    socket.on('chatMessage', ({ roomCode, message } = {}) => {
      if (!message || message.length > 200) return;
      const code = (roomCode || '').toUpperCase();
      const session = activeSessions.get(code);
      if (!session) return;
      const player = session.players.get(socket.id);
      if (!player) return;
      io.to(code).emit('chatMessage', {
        username: player.username,
        message: message.trim(),
        timestamp: Date.now(),
        isVerified: player.isVerified,
      });
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', reason => {
      setTimeout(() => logger.info(`🔌 Disconnected: ${socket.player?.username} (${reason})`), 0);
      Player.findByIdAndUpdate(socket.player?._id, { isOnline: false, lastSeen: new Date() }).exec();

      for (const [code, session] of activeSessions) {
        const player = session.players.get(socket.id);
        if (player) { handleDisconnect(socket, code, session, player, io); break; }
        if (session.spectators.has(socket.id)) { session.spectators.delete(socket.id); break; }
      }
    });
  });
}

function handleDisconnect(socket, code, session, player, io) {
  if (session.status === 'waiting') { handleLeave(socket, code, io, true); return; }

  const graceSeconds = player.isVerified
    ? parseInt(process.env.RECONNECT_GRACE_SECONDS_VERIFIED || 60)
    : parseInt(process.env.RECONNECT_GRACE_SECONDS_NORMAL   || 30);

  io.to(code).emit('playerDisconnected', {
    username: player.username, graceSeconds,
    message: `${player.username} disconnected. ${graceSeconds}s to reconnect.`,
  });

  const timerKey = `${code}:${player.playerId}`;
  const t = setTimeout(() => {
    const stillDisconnected = !io.sockets.sockets.get(socket.id);
    if (stillDisconnected && session.players.has(socket.id)) {
      if (session.roundPhase === 'door_selection' && !session.choices.has(socket.id)) {
        const randomDoor = Math.random() > 0.5 ? 'LIVE' : 'DIE';
        session.choices.set(socket.id, { door: randomDoor, chosenAt: Date.now(), auto: true });
      }
      player.alive = false;
      session.players.delete(socket.id);
      io.to(code).emit('playerEliminated', { username: player.username, reason: 'disconnected' });
      if (session.getAlivePlayers().length === 0) endGame(code, io, session);
    }
    reconnectTimers.delete(timerKey);
  }, graceSeconds * 1000);

  reconnectTimers.set(timerKey, t);
}

function handleLeave(socket, code, io, isDisconnect) {
  const session = activeSessions.get(code);
  if (!session) return;
  const player = session.players.get(socket.id);
  session.spectators.delete(socket.id);
  if (player) {
    session.players.delete(socket.id);
    if (!isDisconnect) socket.leave(code);
    io.to(code).emit('playerLeft', { username: player.username, session: session.toPublicState() });
    if (session.createdBy === player.playerId && session.status === 'waiting') {
      const remaining = [...session.players.values()];
      if (remaining.length === 0) {
        activeSessions.delete(code);
        Match.findOneAndUpdate({ matchId: session.matchId }, { status: 'abandoned' }).exec();
      } else {
        session.createdBy = remaining[0].playerId;
        io.to(code).emit('hostTransferred', { newHost: remaining[0].username });
      }
    }
  }
}

function startCountdown(code, io, session) {
  if (session.status !== 'waiting') return;
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

    const playerIds = [...session.players.values()].map(p => p.playerId);
    const players   = await Player.find({ _id: { $in: playerIds } });
    const excludeIds = players.flatMap(p => p.getRecentClueIds ? p.getRecentClueIds() : []);

    session.rooms = await generateRoomSequence(session.players.size, excludeIds, session.difficultyCurve);

    await Match.findOneAndUpdate(
      { matchId: session.matchId },
      { status: 'in_progress', startedAt: new Date(), totalRooms: session.rooms.length }
    );

    // FIX: emit gameStarted AFTER rooms are generated so totalRooms is correct
    io.to(code).emit('gameStarted', { totalRooms: session.rooms.length, session: session.toPublicState() });

    setTimeout(() => startRoom(code, io, session), 2000);
  } catch (err) {
    logger.error('beginGame error:', err);
    io.to(code).emit('error', { message: 'Failed to start game: ' + err.message });
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

  const settings = await GameSettings.getSingleton();
  const timerSecs = settings.puzzleTimerSeconds || 30;

  io.to(code).emit('roomStarted', {
    roomNumber: room.roomNumber, environment: room.environment,
    clueCategory: room.clueCategory, clueText: room.clueText,
    flavorText: room.flavorText, hints: room.hints,
    ambientObjects: room.ambientObjects,
    timerSeconds: timerSecs, totalRooms: session.rooms.length,
    difficulty: room.difficulty, session: session.toPublicState(),
  });

  session.roundTimer = setTimeout(() => startDoorSelection(code, io, session), timerSecs * 1000);
}

async function startDoorSelection(code, io, session) {
  clearTimeout(session.roundTimer);
  session.roundPhase = 'door_selection';
  session.doorStartTime = Date.now();

  const settings = await GameSettings.getSingleton();
  const doorTimer = settings.doorTimerSeconds || 30;

  io.to(code).emit('doorSelectionStarted', { timerSeconds: doorTimer, session: session.toPublicState() });

  session.roundTimer = setTimeout(() => {
    for (const player of session.getAlivePlayers()) {
      if (!session.choices.has(player.socketId)) {
        session.choices.set(player.socketId, {
          door: Math.random() > 0.5 ? 'LIVE' : 'DIE',
          chosenAt: Date.now(), auto: true,
        });
      }
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

  for (const [sid, choice] of session.choices) {
    const player = session.players.get(sid);
    if (!player || !player.alive) continue;
    const survived = validateDoorChoice(room, choice.door);
    results.push({ username: player.username, chosenDoor: choice.door, survived, wasAuto: !!choice.auto });
    if (survived) { player.roomsSurvived++; survivors.push(player.username); }
    else           { player.alive = false;  eliminated.push(player.username); }
  }

  await Match.findOneAndUpdate({ matchId: session.matchId }, {
    $push: {
      rooms: {
        roomNumber: room.roomNumber, roomId: room.roomId, clueId: room.clueId,
        clueText: room.clueText, correctDoor, difficulty: room.difficulty,
        survivorCount: survivors.length, eliminatedCount: eliminated.length,
      },
    },
  });

  setTimeout(() => {
    io.to(code).emit('roundResult', { correctDoor, results, survivors, eliminated, session: session.toPublicState() });
    for (const username of eliminated) io.to(code).emit('playerEliminated', { username });
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
  const updates = session.getAllPlayers().map(player => {
    const isWinner = winnerUsernames.includes(player.username);
    return Player.findByIdAndUpdate(player.playerId, {
      $inc: {
        gamesPlayed: 1, 'stats.gamesPlayed': 1,
        'stats.wins': isWinner ? 1 : 0,
        'stats.totalRoomsSurvived': player.roomsSurvived,
        'stats.totalEliminations': isWinner ? 0 : 1,
      },
    });
  });

  await Promise.all([
    ...updates,
    Match.findOneAndUpdate({ matchId: session.matchId }, { status: 'completed', endedAt: new Date(), winnersCount: winners.length }),
  ]);

  io.to(code).emit('gameEnd', {
    winners: winnerUsernames,
    allPlayers: session.getAllPlayers().map(p => ({ username: p.username, roomsSurvived: p.roomsSurvived, alive: p.alive })),
    totalRooms: session.rooms.length,
  });

  setTimeout(() => { activeSessions.delete(code); logger.info(`🗑️  Session ${code} cleaned up`); }, 120000);
}

module.exports = initSocketHandlers;
