/**
 * Socket Client
 * Singleton socket.io client with all game event handlers wired to Zustand stores
 */
import { io } from 'socket.io-client';
import useGameStore from '../store/gameStore';
import useAuthStore from '../store/authStore';

let socket = null;

/**
 * Connect to server and register all event listeners
 */
export function connectSocket() {
  const token = useAuthStore.getState().token;
  if (!token) return null;
  if (socket?.connected) return socket;

  socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // ── Connection events ────────────────────────────────────────────────────────
  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.warn('⚠️ Socket disconnected:', reason);
    useGameStore.getState().showNotification('Connection lost. Reconnecting…', 'warning');
  });

  socket.on('connect_error', (err) => {
    console.error('Socket error:', err.message);
    useGameStore.getState().showNotification('Connection error: ' + err.message, 'error');
  });

  socket.on('reconnect', () => {
    useGameStore.getState().showNotification('Reconnected!', 'success');
  });

  // ── Room events ──────────────────────────────────────────────────────────────
  socket.on('roomCreated', ({ roomCode, session }) => {
    const store = useGameStore.getState();
    store.setRoomCode(roomCode);
    store.updateSession(session);
  });

  socket.on('joinedRoom', ({ session }) => {
    useGameStore.getState().updateSession(session);
  });

  socket.on('reconnected', ({ session }) => {
    useGameStore.getState().updateSession(session);
    useGameStore.getState().showNotification('Reconnected to game!', 'success');
  });

  socket.on('playerJoined', ({ username, session }) => {
    useGameStore.getState().updateSession(session);
    useGameStore.getState().showNotification(`${username} joined the room`, 'info');
  });

  socket.on('playerLeft', ({ username, session }) => {
    useGameStore.getState().updateSession(session);
    useGameStore.getState().showNotification(`${username} left the room`, 'warning');
  });

  socket.on('hostTransferred', ({ newHost }) => {
    useGameStore.getState().showNotification(`${newHost} is now the host`, 'info');
  });

  socket.on('playerReadyUpdate', ({ username, session }) => {
    useGameStore.getState().updateSession(session);
  });

  // ── Countdown ────────────────────────────────────────────────────────────────
  socket.on('countdownStarted', ({ seconds }) => {
    useGameStore.getState().setCountdown(seconds);
  });

  socket.on('countdownTick', ({ seconds }) => {
    useGameStore.getState().setCountdown(seconds);
  });

  // ── Game start ───────────────────────────────────────────────────────────────
  socket.on('gameStarted', ({ totalRooms, session }) => {
    const store = useGameStore.getState();
    // Update totalRooms in store; navigation is handled by WaitingRoomPage listener
    if (totalRooms > 0) {
      useGameStore.setState({ totalRooms });
    }
    if (session) store.updateSession(session);
  });

  // ── Room puzzle phase ────────────────────────────────────────────────────────
  socket.on('roomStarted', (roomData) => {
    const store = useGameStore.getState();
    store.clearRoundState();
    store.stopTimer();
    useGameStore.setState({
      currentRoom: roomData,
      roundPhase: 'puzzle',
      currentRoomIndex: (roomData.roomNumber || 1) - 1,
      totalRooms: roomData.totalRooms || useGameStore.getState().totalRooms,
    });
    // Use server-provided timerSeconds (puzzle phase = 30s by default)
    store.startTimer(roomData.timerSeconds || 30);
  });

  // ── Door selection phase ─────────────────────────────────────────────────────
  socket.on('doorSelectionStarted', ({ timerSeconds }) => {
    const store = useGameStore.getState();
    store.stopTimer();
    useGameStore.setState({ roundPhase: 'door_selection' });
    store.startTimer(timerSeconds || 30);
  });

  // ── Choice update (how many chose) ───────────────────────────────────────────
  socket.on('choiceUpdate', ({ chosenCount, totalAlive, username }) => {
    useGameStore.setState({ chosenCount });
  });

  // ── Round result reveal ───────────────────────────────────────────────────────
  socket.on('roundResult', (results) => {
    const store = useGameStore.getState();
    store.stopTimer();
    // Update session players list (alive status changed) but keep roundPhase = 'reveal'
    if (results.session) {
      useGameStore.setState({
        session: results.session,
        // Explicitly keep reveal phase — don't let updateSession's logic override it
        roundPhase: 'reveal',
      });
    }
    store.setRoundResults(results);
  });

  socket.on('playerEliminated', ({ username }) => {
    useGameStore.getState().showNotification(`💀 ${username} was eliminated!`, 'elimination');
  });

  // ── Next room transition ──────────────────────────────────────────────────────
  socket.on('nextRoom', ({ nextRoomNumber, alivePlayers }) => {
    useGameStore.setState({ roundPhase: 'transition' });
    useGameStore.getState().showNotification(
      `Room ${nextRoomNumber} — ${alivePlayers} survivors remain`, 'info'
    );
  });

  // ── Game end ──────────────────────────────────────────────────────────────────
  socket.on('gameEnd', (data) => {
    useGameStore.getState().stopTimer();
    useGameStore.getState().setGameEndData(data);
  });

  // ── Chat ──────────────────────────────────────────────────────────────────────
  socket.on('chatMessage', (msg) => {
    useGameStore.getState().addChatMessage(msg);
  });

  // ── Spectator ─────────────────────────────────────────────────────────────────
  socket.on('joinedAsSpectator', ({ session }) => {
    useGameStore.getState().updateSession(session);
    useGameStore.getState().showNotification('Joined as spectator', 'info');
  });

  // ── Server errors ─────────────────────────────────────────────────────────────
  socket.on('error', ({ message }) => {
    useGameStore.getState().showNotification(message, 'error');
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ── Emit helpers ──────────────────────────────────────────────────────────────

export const emit = {
  createRoom: (opts) => socket?.emit('createRoom', opts),
  joinRoom: (roomCode, spectate = false) => socket?.emit('joinRoom', { roomCode, spectate }),
  leaveRoom: (roomCode) => socket?.emit('leaveRoom', { roomCode }),
  playerReady: (roomCode) => socket?.emit('playerReady', { roomCode }),
  startGame: (roomCode) => socket?.emit('startGame', { roomCode }),
  chooseDoor: (roomCode, door) => socket?.emit('playerChooseDoor', { roomCode, door }),
  sendChat: (roomCode, message) => socket?.emit('chatMessage', { roomCode, message }),
};
