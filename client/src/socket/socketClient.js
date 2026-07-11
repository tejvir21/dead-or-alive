/**
 * socketClient.js — Fixed
 *
 * Fixes:
 *   1. "Socket connected: undefined" — log socket.id after a tick
 *   2. Double-connection — checks socket.connected AND socket.active
 *   3. auth is a function so socket.io calls it fresh on every reconnect
 */
import { io } from 'socket.io-client';
import useGameStore from '../store/gameStore';
import useAuthStore from '../store/authStore';
import { isExpiringSoon } from '../utils/jwt';

let socket = null;
let tokenRefreshErrorCount = 0;

async function resolveToken() {
  const { accessToken, refreshAccessToken } = useAuthStore.getState();
  if (!accessToken) return null;
  if (isExpiringSoon(accessToken, 30000)) {
    try { return await refreshAccessToken(); } catch (_) { return accessToken; }
  }
  return accessToken;
}

export function connectSocket() {
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) return null;

  // Guard against double-connect
  if (socket && (socket.connected || socket.active)) return socket;

  // Clean up dead socket before creating new one
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
    auth: async (cb) => {
      const token = await resolveToken();
      cb({ token: token ? `Bearer ${token}` : undefined });
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => {
    // socket.id may not be set synchronously in some socket.io versions
    setTimeout(() => console.log('✅ Socket connected:', socket?.id), 0);
    tokenRefreshErrorCount = 0;
  });

  socket.on('disconnect', (reason) => {
    console.warn('⚠️ Socket disconnected:', reason);
    if (reason !== 'io client disconnect') {
      useGameStore.getState().showNotification?.('Connection lost. Reconnecting…', 'warning');
    }
  });

  socket.on('reconnect', (attempt) => {
    useGameStore.getState().showNotification?.('Reconnected!', 'success');
  });

  socket.on('connect_error', async (err) => {
    const msg = err?.message || '';
    if (/token expired|invalid token|authentication required/i.test(msg)) {
      tokenRefreshErrorCount += 1;
      if (tokenRefreshErrorCount > 3) {
        useGameStore.getState().showNotification?.('Session expired. Please sign in again.', 'error');
        disconnectSocket();
        return;
      }
      try {
        await useAuthStore.getState().refreshAccessToken();
        socket.connect();
      } catch (_) {}
    }
  });

  socket.on('playerJoined',      ({ username, session }) => {
    useGameStore.getState().updateSession?.(session);
    useGameStore.getState().showNotification?.(`${username} joined`, 'info');
  });
  socket.on('playerLeft',        ({ username, session }) => {
    useGameStore.getState().updateSession?.(session);
    useGameStore.getState().showNotification?.(`${username} left`, 'warning');
  });
  socket.on('playerDisconnected',({ username, graceSeconds }) => {
    useGameStore.getState().showNotification?.(`${username} disconnected (${graceSeconds}s to reconnect)`, 'warning');
  });
  socket.on('playerReconnected', ({ username, session }) => {
    useGameStore.getState().updateSession?.(session);
    useGameStore.getState().showNotification?.(`${username} reconnected`, 'success');
  });
  socket.on('hostTransferred',   ({ newHost }) => {
    useGameStore.getState().showNotification?.(`${newHost} is now the host`, 'info');
  });
  socket.on('countdownStarted',  ({ seconds }) => {
    useGameStore.getState().setCountdown?.(seconds);
  });
  socket.on('countdownTick',     ({ seconds }) => {
    useGameStore.getState().setCountdown?.(seconds);
  });
  socket.on('error',             ({ message }) => {
    useGameStore.getState().showNotification?.(message, 'error');
  });

  return socket;
}

export function getSocket()      { return socket; }
export function disconnectSocket() {
  if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
}

export const emit = {
  createRoom:  (opts)                  => socket?.emit('createRoom', opts),
  joinRoom:    (roomCode, spectate=false) => socket?.emit('joinRoom', { roomCode, spectate }),
  leaveRoom:   (roomCode)              => socket?.emit('leaveRoom', { roomCode }),
  playerReady: (roomCode)              => socket?.emit('playerReady', { roomCode }),
  startGame:   (roomCode)              => socket?.emit('startGame', { roomCode }),
  skipToDoor:  (roomCode)              => socket?.emit('playerSkipToDoor', { roomCode }),
  chooseDoor:  (roomCode, door)        => socket?.emit('playerChooseDoor', { roomCode, door }),
  sendChat:    (roomCode, message)     => socket?.emit('chatMessage', { roomCode, message }),
};
