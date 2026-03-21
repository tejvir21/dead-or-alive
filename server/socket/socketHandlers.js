/**
 * Socket.io Game Engine
 * Handles all real-time multiplayer events for Dead or Alive: Logic Escape
 *
 * Event flow:
 * createRoom → joinRoom → playerReady → startGame → [room loop] → gameEnd
 */

const jwt = require('jsonwebtoken');
const Player = require('../models/Player');
const Match = require('../models/Match');
const Clue = require('../models/Clue');
const { generateRoomSequence, validateDoorChoice } = require('../utils/roomGenerator');
const { v4: uuidv4 } = require('uuid');

// ─── In-memory game state (fast access, synced to DB periodically) ─────────────
// Key: roomCode, Value: GameSession
const activeSessions = new Map();

/**
 * GameSession - full in-memory state for one match
 */
class GameSession {
  constructor(matchId, roomCode, createdBy, maxPlayers, minPlayers) {
    this.matchId = matchId;
    this.roomCode = roomCode;
    this.createdBy = createdBy;
    this.maxPlayers = maxPlayers;
    this.minPlayers = minPlayers;
    this.status = 'waiting'; // waiting | countdown | in_progress | completed
    this.players = new Map(); // socketId → PlayerState
    this.spectators = new Set(); // socketIds
    this.rooms = []; // generated room configs (with correctDoor)
    this.currentRoomIndex = 0;
    this.roundPhase = 'idle'; // idle | puzzle | door_selection | reveal | transition
    this.roundTimer = null;
    this.revealTimer = null;
    this.choices = new Map(); // socketId → 'LIVE'|'DIE'
    this.startCountdown = null;
  }

  getAlivePlayers() {
    return [...this.players.values()].filter((p) => p.alive);
  }

  getAllPlayers() {
    return [...this.players.values()];
  }

  getCurrentRoom() {
    return this.rooms[this.currentRoomIndex] || null;
  }

  // Safe room data (no correctDoor) for clients
  getSafeCurrentRoom() {
    const room = this.getCurrentRoom();
    if (!room) return null;
    const { correctDoor, answerRule, resolvedVars, clueSeed, ...safe } = room;
    return safe;
  }

  // Serialize for client state sync
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
      players: this.getAllPlayers().map((p) => ({
        id: p.playerId,
        username: p.username,
        alive: p.alive,
        ready: p.ready,
        roomsSurvived: p.roomsSurvived,
        hasChosen: this.choices.has(p.socketId),
      })),
      currentRoom: this.getSafeCurrentRoom(),
    };
  }
}

/**
 * PlayerState - one player in a session
 */
class PlayerState {
  constructor(socketId, playerId, username) {
    this.socketId = socketId;
    this.playerId = playerId;
    this.username = username;
    this.alive = true;
    this.ready = false;
    this.roomsSurvived = 0;
    this.joinedAt = Date.now();
  }
}

// ─── Socket Authentication Middleware ─────────────────────────────────────────
async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
    const player = await Player.findById(decoded.id).select('-password');
    if (!player) return next(new Error('Player not found'));

    socket.player = player;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
}

// ─── Main Socket Handler ──────────────────────────────────────────────────────
function initSocketHandlers(io) {
  // Auth middleware for all socket connections
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`🔌 Player connected: ${socket.player.username} (${socket.id})`);

    // Update online status
    Player.findByIdAndUpdate(socket.player._id, { isOnline: true, lastSeen: new Date() }).exec();

    // ── createRoom ──────────────────────────────────────────────────────────
    socket.on('createRoom', async ({ maxPlayers = 8, minPlayers = 2 }) => {
      try {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const matchId = uuidv4();

        // Allow min 1 so hosts can test solo; clamp max to 8
        const safeMax = Math.min(8, Math.max(1, maxPlayers));
        const safeMin = Math.min(safeMax, Math.max(1, minPlayers));

        // Persist to DB
        const match = await Match.create({
          matchId,
          roomCode,
          maxPlayers: safeMax,
          minPlayers: safeMin,
          createdBy: socket.player._id,
          players: [{ playerId: socket.player._id, username: socket.player.username, joinedAt: new Date() }],
          status: 'waiting',
        });

        // Create in-memory session
        const session = new GameSession(matchId, roomCode, socket.player._id.toString(), safeMax, safeMin);
        const ps = new PlayerState(socket.id, socket.player._id.toString(), socket.player.username);
        ps.ready = false;
        session.players.set(socket.id, ps);
        activeSessions.set(roomCode, session);

        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, session: session.toPublicState() });
        console.log(`🏠 Room created: ${roomCode} by ${socket.player.username}`);
      } catch (err) {
        socket.emit('error', { message: 'Failed to create room: ' + err.message });
      }
    });

    // ── joinRoom ────────────────────────────────────────────────────────────
    socket.on('joinRoom', async ({ roomCode, spectate = false }) => {
      try {
        const code = roomCode.toUpperCase();
        const session = activeSessions.get(code);

        if (!session) return socket.emit('error', { message: 'Room not found' });
        if (session.status !== 'waiting' && !spectate) {
          // Allow joining as spectator if game is in progress
          return socket.emit('error', { message: 'Game already in progress. Join as spectator?' });
        }
        if (!spectate && session.players.size >= session.maxPlayers) {
          return socket.emit('error', { message: 'Room is full' });
        }

        // Check if player already in room (reconnection)
        const existingEntry = [...session.players.values()].find(
          (p) => p.playerId === socket.player._id.toString()
        );

        if (existingEntry && !spectate) {
          // Reconnection: update socket ID
          session.players.delete(existingEntry.socketId);
          existingEntry.socketId = socket.id;
          session.players.set(socket.id, existingEntry);
          socket.join(code);
          socket.emit('reconnected', { session: session.toPublicState() });
          io.to(code).emit('playerReconnected', { username: socket.player.username });
          return;
        }

        socket.join(code);

        if (spectate) {
          session.spectators.add(socket.id);
          socket.emit('joinedAsSpectator', { session: session.toPublicState() });
          io.to(code).emit('spectatorJoined', { username: socket.player.username });
          return;
        }

        const ps = new PlayerState(socket.id, socket.player._id.toString(), socket.player.username);
        session.players.set(socket.id, ps);

        // Update DB
        await Match.findOneAndUpdate(
          { matchId: session.matchId },
          { $push: { players: { playerId: socket.player._id, username: socket.player.username, joinedAt: new Date() } } }
        );

        socket.emit('joinedRoom', { session: session.toPublicState() });
        io.to(code).emit('playerJoined', {
          username: socket.player.username,
          session: session.toPublicState(),
        });

        console.log(`👤 ${socket.player.username} joined room ${code}`);
      } catch (err) {
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // ── leaveRoom ───────────────────────────────────────────────────────────
    socket.on('leaveRoom', ({ roomCode }) => {
      handlePlayerLeave(socket, roomCode, io);
    });

    // ── playerReady ─────────────────────────────────────────────────────────
    socket.on('playerReady', ({ roomCode }) => {
      const session = activeSessions.get(roomCode?.toUpperCase());
      if (!session) return;

      const player = session.players.get(socket.id);
      if (!player) return;

      player.ready = true;

      io.to(roomCode.toUpperCase()).emit('playerReadyUpdate', {
        username: player.username,
        session: session.toPublicState(),
      });

      // Auto-start if all players ready and minimum reached
      const allReady = session.getAlivePlayers().every((p) => p.ready);
      const enoughPlayers = session.players.size >= session.minPlayers;

      if (allReady && enoughPlayers && session.status === 'waiting') {
        startCountdown(roomCode.toUpperCase(), io, session);
      }
    });

    // ── startGame (host override) ────────────────────────────────────────────
    socket.on('startGame', async ({ roomCode }) => {
      const code = roomCode.toUpperCase();
      const session = activeSessions.get(code);
      if (!session) return socket.emit('error', { message: 'Room not found' });
      if (session.createdBy !== socket.player._id.toString()) {
        return socket.emit('error', { message: 'Only the host can start the game' });
      }
      if (session.status === 'countdown' || session.status === 'in_progress') {
        return; // already starting, ignore duplicate clicks
      }
      if (session.status !== 'waiting') return;

      const playerCount = session.players.size;
      if (playerCount < session.minPlayers) {
        return socket.emit('error', {
          message: `Need at least ${session.minPlayers} player(s) to start. Currently ${playerCount}.`,
        });
      }

      startCountdown(code, io, session);
    });

    // ── playerChooseDoor ─────────────────────────────────────────────────────
    socket.on('playerChooseDoor', ({ roomCode, door }) => {
      const code = roomCode.toUpperCase();
      const session = activeSessions.get(code);
      if (!session) return;
      if (session.roundPhase !== 'door_selection') {
        return socket.emit('error', { message: 'Not in door selection phase' });
      }

      const player = session.players.get(socket.id);
      if (!player || !player.alive) return;
      if (!['LIVE', 'DIE'].includes(door)) return;
      if (session.choices.has(socket.id)) return; // Already chose

      // Record choice with timestamp for anti-cheat
      session.choices.set(socket.id, { door, chosenAt: Date.now() });

      // Tell everyone how many have chosen (not WHO chose what until reveal)
      const chosenCount = [...session.choices.keys()].filter(
        (sid) => session.players.get(sid)?.alive
      ).length;
      const totalAlive = session.getAlivePlayers().length;

      io.to(code).emit('choiceUpdate', {
        chosenCount,
        totalAlive,
        username: player.username, // just show they chose, not what
      });

      // If everyone chose, reveal early
      if (chosenCount >= totalAlive) {
        clearTimeout(session.roundTimer);
        revealResults(code, io, session);
      }
    });

    // ── chatMessage (lobby chat) ─────────────────────────────────────────────
    socket.on('chatMessage', ({ roomCode, message }) => {
      if (!message || message.length > 200) return;
      const session = activeSessions.get(roomCode?.toUpperCase());
      if (!session) return;
      const player = session.players.get(socket.id);
      if (!player) return;

      io.to(roomCode.toUpperCase()).emit('chatMessage', {
        username: player.username,
        message: message.trim(),
        timestamp: Date.now(),
      });
    });

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Disconnected: ${socket.player?.username} (${reason})`);
      Player.findByIdAndUpdate(socket.player?._id, { isOnline: false, lastSeen: new Date() }).exec();

      // Find which room this socket was in and handle leave
      for (const [code, session] of activeSessions) {
        if (session.players.has(socket.id) || session.spectators.has(socket.id)) {
          handlePlayerLeave(socket, code, io);
          break;
        }
      }
    });
  });
}

// ─── Game Flow Functions ──────────────────────────────────────────────────────

/**
 * Starts the pre-game countdown (5 seconds)
 */
function startCountdown(roomCode, io, session) {
  if (session.status !== 'waiting') return;
  session.status = 'countdown';

  io.to(roomCode).emit('countdownStarted', { seconds: 5 });

  let count = 5;
  const interval = setInterval(() => {
    count--;
    io.to(roomCode).emit('countdownTick', { seconds: count });

    if (count <= 0) {
      clearInterval(interval);
      // Small delay so clients see "GO!" before navigation
      setTimeout(() => beginGame(roomCode, io, session), 800);
    }
  }, 1000);
}

/**
 * Generates rooms and begins the game
 */
async function beginGame(roomCode, io, session) {
  try {
    session.status = 'in_progress';

    // Emit gameStarted FIRST so all clients navigate to game page immediately
    io.to(roomCode).emit('gameStarted', {
      totalRooms: 0, // will be updated once rooms are generated
      session: session.toPublicState(),
    });

    // Collect all player recent clue IDs for anti-repetition
    const playerIds = [...session.players.values()].map((p) => p.playerId);
    const players = await Player.find({ _id: { $in: playerIds } });
    const excludeClueIds = players.flatMap((p) => p.getRecentClueIds());

    // Generate room sequence
    session.rooms = await generateRoomSequence(session.players.size, excludeClueIds);

    await Match.findOneAndUpdate(
      { matchId: session.matchId },
      { status: 'in_progress', startedAt: new Date(), totalRooms: session.rooms.length }
    );

    // Start first room after clients have had time to navigate (2s)
    setTimeout(() => startRoom(roomCode, io, session), 2000);
  } catch (err) {
    console.error('beginGame error:', err);
    io.to(roomCode).emit('error', { message: 'Failed to start game: ' + err.message });
    session.status = 'waiting'; // roll back so host can retry
  }
}

/**
 * Presents a room's puzzle to players
 */
function startRoom(roomCode, io, session) {
  session.choices.clear();
  session.roundPhase = 'puzzle';

  const room = session.getCurrentRoom();
  if (!room) return endGame(roomCode, io, session);

  io.to(roomCode).emit('roomStarted', {
    roomNumber: room.roomNumber,
    environment: room.environment,
    clueCategory: room.clueCategory,
    clueText: room.clueText,
    flavorText: room.flavorText,
    ambientObjects: room.ambientObjects,
    timerSeconds: room.timerSeconds,
    totalRooms: session.rooms.length,
    session: session.toPublicState(),
  });

  // After puzzle phase, move to door selection
  // Use the room's configured timer (default 30s)
  const puzzleMs = (room.timerSeconds || 30) * 1000;
  session.roundTimer = setTimeout(() => {
    startDoorSelection(roomCode, io, session);
  }, puzzleMs);
}

/**
 * Players now choose a door (30 seconds)
 */
function startDoorSelection(roomCode, io, session) {
  clearTimeout(session.roundTimer);
  session.roundPhase = 'door_selection';

  const room = session.getCurrentRoom();
  const doorTimer = (room?.doorTimerSeconds || 30);

  io.to(roomCode).emit('doorSelectionStarted', {
    timerSeconds: doorTimer,
    session: session.toPublicState(),
  });

  // Auto-reveal when timer expires
  session.roundTimer = setTimeout(() => {
    // Assign random doors to players who didn't choose
    for (const player of session.getAlivePlayers()) {
      if (!session.choices.has(player.socketId)) {
        const randomDoor = Math.random() > 0.5 ? 'LIVE' : 'DIE';
        session.choices.set(player.socketId, { door: randomDoor, chosenAt: Date.now(), auto: true });
      }
    }
    revealResults(roomCode, io, session);
  }, doorTimer * 1000);
}

/**
 * Reveals results, eliminates players, prepares next room
 */
async function revealResults(roomCode, io, session) {
  clearTimeout(session.roundTimer);
  session.roundPhase = 'reveal';

  const room = session.getCurrentRoom();
  const correctDoor = room.correctDoor;

  const results = [];
  const survivors = [];
  const eliminated = [];

  for (const [socketId, choiceData] of session.choices) {
    const player = session.players.get(socketId);
    if (!player || !player.alive) continue;

    const survived = validateDoorChoice(room, choiceData.door);

    results.push({
      username: player.username,
      chosenDoor: choiceData.door,
      survived,
      wasAuto: choiceData.auto || false,
    });

    if (survived) {
      player.roomsSurvived++;
      survivors.push(player.username);
    } else {
      player.alive = false;
      eliminated.push(player.username);
    }
  }

  // Update DB match rooms log
  await Match.findOneAndUpdate(
    { matchId: session.matchId },
    {
      $push: {
        rooms: {
          roomNumber: room.roomNumber,
          roomId: room.roomId,
          clueId: room.clueId,
          clueText: room.clueText,
          correctDoor,
          difficulty: room.difficulty,
          survivorCount: survivors.length,
          eliminatedCount: eliminated.length,
        },
      },
    }
  );

  // Emit result reveal with a small delay for dramatic effect
  setTimeout(() => {
    io.to(roomCode).emit('roundResult', {
      correctDoor,
      results,
      survivors,
      eliminated,
      session: session.toPublicState(),
    });

    // Emit elimination events
    for (const username of eliminated) {
      io.to(roomCode).emit('playerEliminated', { username });
    }
  }, 1000); // 1s delay for dramatic effect (anti-cheat: delay prevents timing attacks)

  // Decide next step after reveal display
  session.revealTimer = setTimeout(async () => {
    const alivePlayers = session.getAlivePlayers();

    if (alivePlayers.length === 0) {
      // Everyone eliminated
      endGame(roomCode, io, session);
    } else if (session.currentRoomIndex >= session.rooms.length - 1) {
      // All rooms cleared
      endGame(roomCode, io, session, alivePlayers);
    } else {
      // Next room
      session.currentRoomIndex++;
      io.to(roomCode).emit('nextRoom', {
        nextRoomNumber: session.currentRoomIndex + 1,
        alivePlayers: alivePlayers.length,
        session: session.toPublicState(),
      });
      setTimeout(() => startRoom(roomCode, io, session), 3000);
    }
  }, 6000); // 6s to show results
}

/**
 * Ends the game, saves stats
 */
async function endGame(roomCode, io, session, winners = []) {
  clearTimeout(session.roundTimer);
  clearTimeout(session.revealTimer);
  session.status = 'completed';
  session.roundPhase = 'idle';

  const winnerUsernames = winners.map((p) => p.username);

  // Persist match completion
  const playerUpdates = [];

  for (const player of session.getAllPlayers()) {
    const isWinner = winnerUsernames.includes(player.username);

    playerUpdates.push(
      Player.findByIdAndUpdate(player.playerId, {
        $inc: {
          gamesPlayed: 1,
          'stats.gamesPlayed': 1,
          'stats.wins': isWinner ? 1 : 0,
          'stats.totalRoomsSurvived': player.roomsSurvived,
          'stats.totalEliminations': isWinner ? 0 : 1,
        },
      })
    );
  }

  await Promise.all([
    ...playerUpdates,
    Match.findOneAndUpdate(
      { matchId: session.matchId },
      {
        status: 'completed',
        endedAt: new Date(),
        winnersCount: winners.length,
        'players.$[].isWinner': false, // reset, then set below
      }
    ),
  ]);

  io.to(roomCode).emit('gameEnd', {
    winners: winnerUsernames,
    allPlayers: session.getAllPlayers().map((p) => ({
      username: p.username,
      roomsSurvived: p.roomsSurvived,
      alive: p.alive,
    })),
    totalRooms: session.rooms.length,
  });

  // Clean up session after delay
  setTimeout(() => {
    activeSessions.delete(roomCode);
    console.log(`🗑️ Session ${roomCode} cleaned up`);
  }, 60000);
}

/**
 * Handles a player leaving a room
 */
function handlePlayerLeave(socket, roomCode, io) {
  const code = typeof roomCode === 'string' ? roomCode.toUpperCase() : roomCode;
  const session = activeSessions.get(code);
  if (!session) return;

  const player = session.players.get(socket.id);
  session.spectators.delete(socket.id);

  if (player) {
    session.players.delete(socket.id);
    socket.leave(code);

    io.to(code).emit('playerLeft', {
      username: player.username,
      session: session.toPublicState(),
    });

    // If host leaves, transfer host or end session
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

module.exports = initSocketHandlers;
