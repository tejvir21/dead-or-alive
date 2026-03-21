/**
 * WaitingRoomPage — Pre-game lobby where players get ready
 */
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../store/gameStore';
import useAuthStore from '../store/authStore';
import { emit, getSocket } from '../socket/socketClient';
import Chat from '../components/lobby/Chat';

export default function WaitingRoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate); // stable ref to avoid stale closure
  navigateRef.current = navigate;

  const { player } = useAuthStore();
  const {
    session, countdown, resetGame, setCountdown,
  } = useGameStore();

  const [isReady, setIsReady] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) { navigateRef.current('/lobby'); return; }

    // Join room if we don't have session (e.g. direct URL or page refresh)
    if (!session && !joining) {
      setJoining(true);
      emit.joinRoom(roomCode);
    }

    // Navigate to game page when server fires gameStarted
    const onGameStarted = () => {
      navigateRef.current(`/game/${roomCode}`);
    };

    const onCountdownStarted = ({ seconds }) => setCountdown(seconds);
    const onCountdownTick = ({ seconds }) => setCountdown(seconds);

    socket.on('gameStarted', onGameStarted);
    socket.on('countdownStarted', onCountdownStarted);
    socket.on('countdownTick', onCountdownTick);

    return () => {
      socket.off('gameStarted', onGameStarted);
      socket.off('countdownStarted', onCountdownStarted);
      socket.off('countdownTick', onCountdownTick);
    };
  }, [roomCode]); // only re-run if roomCode changes

  const players = session?.players || [];
  const minPlayers = session?.minPlayers ?? 1;

  // Host = first player in list whose id matches ours, or createdBy matches
  const myEntry = players.find(p => p.username === player?.username);
  const isHost = session?.createdBy === player?.id
    || (players.length > 0 && players[0]?.username === player?.username);

  const canStart = players.length >= minPlayers;

  const handleReady = () => {
    if (isReady) return;
    setIsReady(true);
    emit.playerReady(roomCode);
  };

  const handleStart = () => {
    emit.startGame(roomCode);
  };

  const handleLeave = () => {
    emit.leaveRoom(roomCode);
    resetGame();
    navigateRef.current('/lobby');
  };

  return (
    <div className="min-h-screen bg-void-900 flex flex-col">
      <div
        className="fixed inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,255,136,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="font-mono text-xs text-gray-600 mb-1">WAITING ROOM</p>
            <h1 className="font-display text-4xl tracking-wider">
              <span className="text-gray-600">ROOM </span>
              <span className="neon-text tracking-[0.2em]">{roomCode}</span>
            </h1>
          </div>
          <button onClick={handleLeave} className="btn-ghost text-sm text-red-400/70 hover:text-red-400">
            LEAVE
          </button>
        </div>

        {/* Countdown overlay */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            >
              <motion.div
                key={countdown}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                {countdown > 0 ? (
                  <>
                    <div className="font-display text-[160px] neon-text leading-none">{countdown}</div>
                    <div className="font-display text-2xl tracking-[0.4em] text-white/50">GET READY</div>
                  </>
                ) : (
                  <div className="font-display text-[80px] neon-text leading-none tracking-wider">GO!</div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
          {/* Players list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl tracking-wider text-white">
                  PLAYERS{' '}
                  <span className="text-green-500">{players.length}</span>
                  <span className="text-gray-600">/{session?.maxPlayers || 8}</span>
                </h2>
                <span className="font-mono text-xs text-gray-600">
                  Min {minPlayers} to start
                </span>
              </div>

              <div className="space-y-2">
                {players.map((p, i) => (
                  <motion.div
                    key={p.id || p.username}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center justify-between px-4 py-3 rounded border ${
                      p.username === player?.username
                        ? 'bg-green-900/20 border-green-700/40'
                        : 'bg-white/3 border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${p.ready ? 'bg-green-400' : 'bg-gray-600'}`} />
                      <span className="font-body font-semibold text-white">
                        {p.username}
                        {p.username === player?.username && (
                          <span className="ml-2 text-xs text-gray-500">(you)</span>
                        )}
                      </span>
                      {i === 0 && (
                        <span className="text-xs font-mono text-yellow-500/70 border border-yellow-700/40 px-1 rounded">HOST</span>
                      )}
                    </div>
                    <span className={`text-xs font-mono ${p.ready ? 'text-green-400' : 'text-gray-600'}`}>
                      {p.ready ? '✓ READY' : 'NOT READY'}
                    </span>
                  </motion.div>
                ))}

                {/* Empty slots */}
                {Array.from({ length: Math.max(0, (session?.maxPlayers || 8) - players.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center px-4 py-3 rounded border border-white/5 border-dashed">
                    <div className="w-2 h-2 rounded-full bg-gray-800 mr-3" />
                    <span className="font-mono text-xs text-gray-700">WAITING FOR PLAYER…</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 flex-wrap">
              {/* Ready button — show if not yet ready */}
              {!isReady && !myEntry?.ready && (
                <button onClick={handleReady} className="btn-primary flex-1 min-w-[140px]">
                  ✓ READY UP
                </button>
              )}

              {/* Ready state display */}
              {(isReady || myEntry?.ready) && (
                <div className="flex-1 glass-card px-6 py-3 text-center font-display tracking-wider text-green-400 border border-green-700/40">
                  ✓ READY
                </div>
              )}

              {/* Host start button — always visible to host when enough players */}
              {isHost && canStart && (
                <button onClick={handleStart} className="btn-primary flex-1 min-w-[140px]">
                  ▶ START GAME
                </button>
              )}
            </div>

            {/* Not enough players warning */}
            {isHost && !canStart && (
              <p className="font-mono text-xs text-gray-600 text-center">
                Need {minPlayers - players.length} more player(s) to start
              </p>
            )}
          </div>

          {/* Chat */}
          <div className="lg:col-span-1">
            <Chat roomCode={roomCode} />
          </div>
        </div>
      </div>
    </div>
  );
}

