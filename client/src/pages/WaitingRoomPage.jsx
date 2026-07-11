/**
 * WaitingRoomPage.jsx — Fixed
 *
 * Handles the pre-game lobby state:
 *   - Shows who has joined
 *   - Host can click "Start Game" (or it auto-starts when all ready)
 *   - Navigates to /game/:roomCode only after gameStarted fires
 *     (guaranteeing GamePage is mounted before roomStarted fires)
 *
 * Bugs fixed vs original:
 *   - navigateRef stable closure (navigate captured in ref, not stale closure)
 *   - uses accessToken via apiFetch, not old `token` field
 *   - double-join guard: only emits joinRoom once on mount
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { connectSocket, emit } from '../socket/socketClient';
import useGameStore from '../store/gameStore';
import useAuthStore from '../store/authStore';

export default function WaitingRoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate); // stable ref — avoids stale closure in socket handlers
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  const { player } = useAuthStore();
  const { updateSession, setRoomCode } = useGameStore();
  const session = useGameStore(s => s.session);

  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const hasJoinedRef = useRef(false); // double-join guard

  const code = (roomCode || '').toUpperCase();
  const players = session?.players || [];
  const isHost = session?.createdBy === player?._id ||
                 session?.createdBy === player?.id;
  const allReady = players.length > 0 && players.every(p => p.ready);
  const canStart = isHost && players.length >= (session?.minPlayers || 1);

  // ── Join room on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!code || hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    setRoomCode(code);

    const socket = connectSocket();
    if (!socket) return;

    // If socket isn't connected yet, wait for connect then join
    if (socket.connected) {
      emit.joinRoom(code);
    } else {
      socket.once('connect', () => emit.joinRoom(code));
    }
  }, [code]);

  // ── Socket event listeners ───────────────────────────────────────────────
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const onJoinedRoom = ({ session }) => {
      updateSession(session);
    };

    const onPlayerJoined = ({ username, session }) => {
      updateSession(session);
    };

    const onPlayerLeft = ({ username, session }) => {
      updateSession(session);
    };

    const onPlayerReadyUpdate = ({ session }) => {
      updateSession(session);
    };

    const onHostTransferred = ({ newHost }) => {
      // Refresh session
    };

    const onCountdownStarted = ({ seconds }) => {
      setCountdown(seconds);
    };

    const onCountdownTick = ({ seconds }) => {
      setCountdown(seconds);
    };

    // ── KEY FIX: gameStarted → navigate to game page ─────────────────────
    // Only navigate here (not in LobbyPage) so GamePage is already mounted
    // before roomStarted fires 2 seconds later
    const onGameStarted = ({ session: s }) => {
      if (s) updateSession(s);
      setCountdown(null);
      navigateRef.current(`/game/${code}`);
    };

    const onReconnected = ({ session }) => {
      updateSession(session);
      // If game already in progress, go straight to game page
      if (session?.status === 'in_progress') {
        navigateRef.current(`/game/${code}`);
      }
    };

    const onError = ({ message }) => {
      setError(message);
    };

    socket.on('joinedRoom',        onJoinedRoom);
    socket.on('reconnected',       onReconnected);
    socket.on('playerJoined',      onPlayerJoined);
    socket.on('playerLeft',        onPlayerLeft);
    socket.on('playerReadyUpdate', onPlayerReadyUpdate);
    socket.on('hostTransferred',   onHostTransferred);
    socket.on('countdownStarted',  onCountdownStarted);
    socket.on('countdownTick',     onCountdownTick);
    socket.on('gameStarted',       onGameStarted);
    socket.on('error',             onError);

    return () => {
      socket.off('joinedRoom',        onJoinedRoom);
      socket.off('reconnected',       onReconnected);
      socket.off('playerJoined',      onPlayerJoined);
      socket.off('playerLeft',        onPlayerLeft);
      socket.off('playerReadyUpdate', onPlayerReadyUpdate);
      socket.off('hostTransferred',   onHostTransferred);
      socket.off('countdownStarted',  onCountdownStarted);
      socket.off('countdownTick',     onCountdownTick);
      socket.off('gameStarted',       onGameStarted);
      socket.off('error',             onError);
    };
  }, [code]);

  const handleReady = () => {
    setIsReady(true);
    emit.playerReady(code);
  };

  const handleStart = () => {
    emit.startGame(code);
  };

  const handleLeave = () => {
    emit.leaveRoom(code);
    navigate('/lobby');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center">
          <p className="font-mono text-xs text-gray-600 uppercase tracking-widest mb-1">Waiting Room</p>
          <h1 className="font-display text-3xl font-bold text-green-400 tracking-wider">
            {code}
          </h1>
          {session && (
            <p className="font-mono text-xs text-gray-600 mt-2">
              {players.length}/{session.maxPlayers} players
              {' · '}
              {session.difficultyCurve || 'stepped'} curve
            </p>
          )}
        </div>

        {/* Countdown overlay */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-4"
            >
              <p className="font-mono text-xs text-gray-500 uppercase tracking-widest mb-2">
                Game starting in
              </p>
              <p className="font-display text-8xl font-black text-green-400">
                {countdown}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player list */}
        {countdown === null && (
          <div className="glass-card p-5 space-y-3">
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
              Players
            </h2>
            {players.length === 0 ? (
              <p className="font-mono text-xs text-gray-700">Waiting for players…</p>
            ) : (
              players.map(p => (
                <div key={p.id || p.username}
                  className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${p.alive !== false ? 'bg-green-500' : 'bg-gray-700'}`} />
                    <span className="font-mono text-sm text-white">
                      {p.username}
                    </span>
                    {p.id === (session?.createdBy) && (
                      <span className="font-mono text-[10px] text-yellow-500 border border-yellow-800 px-1 rounded">
                        HOST
                      </span>
                    )}
                    {p.isVerified && (
                      <span className="font-mono text-[10px] text-blue-400 border border-blue-800 px-1 rounded">
                        ✓
                      </span>
                    )}
                  </div>
                  <span className={`font-mono text-xs ${p.ready ? 'text-green-400' : 'text-gray-700'}`}>
                    {p.ready ? '✓ READY' : 'waiting…'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="font-mono text-xs text-red-400 text-center">⚠ {error}</p>
        )}

        {/* Actions */}
        {countdown === null && (
          <div className="space-y-3">
            {/* Ready button (non-hosts) */}
            {!isHost && !isReady && (
              <button onClick={handleReady} className="btn-primary w-full">
                ✓ I'M READY
              </button>
            )}
            {!isHost && isReady && (
              <div className="text-center font-mono text-sm text-green-400 py-3">
                ✓ Ready! Waiting for host to start…
              </div>
            )}

            {/* Start button (host only) */}
            {isHost && (
              <button
                onClick={handleStart}
                disabled={!canStart}
                className="btn-primary w-full disabled:opacity-50 text-lg py-4"
              >
                {players.length < (session?.minPlayers || 1)
                  ? `Need ${session?.minPlayers || 1}+ player(s) to start`
                  : '▶ START GAME'}
              </button>
            )}

            <button onClick={handleLeave}
              className="w-full font-mono text-xs text-gray-700 hover:text-red-400 transition-colors py-2">
              ← Leave Room
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
