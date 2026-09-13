/**
 * WaitingRoomPage.jsx — Rebuilt
 * New: ready/not-ready status display, auto-start countdown timer,
 * timer duration control (host, tier-limited), vote kick UI
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { connectSocket, emit } from '../socket/socketClient';
import useGameStore from '../store/gameStore';
import useAuthStore from '../store/authStore';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function WaitingRoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  const { player } = useAuthStore();
  const { updateSession, setRoomCode } = useGameStore();
  const session = useGameStore(s => s.session);

  const [countdown, setCountdown] = useState(null);
  const [error, setError]         = useState('');
  const [autoStartRemaining, setAutoStartRemaining] = useState(null);
  const [tierLimits, setTierLimits] = useState({ min: 180, max: 180 });
  const [showTimerEdit, setShowTimerEdit] = useState(false);
  const [customDuration, setCustomDuration] = useState(180);

  // Kick vote state
  const [activeKickVote, setActiveKickVote] = useState(null); // { targetId, target, votesFor, votesNeeded, expiresAt }
  const [kickTargetSelect, setKickTargetSelect] = useState(null);

  const hasJoinedRef = useRef(false);
  const code = (roomCode || '').toUpperCase();
  const players  = session?.players || [];
  const myEntry  = players.find(p => p.id === player?._id || p.id === player?.id);
  const isReady  = myEntry?.ready || false;
  const isHost   = session?.createdBy === player?._id || session?.createdBy === player?.id;
  const readyCount = players.filter(p => p.ready).length;
  const canStart = isHost && readyCount >= (session?.minPlayers || 1);
  const canVoteKick = players.length >= 3; // min quorum

  // ── Join on mount ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!code || hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    setRoomCode(code);
    const socket = connectSocket();
    if (!socket) return;
    if (socket.connected) emit.joinRoom(code);
    else socket.once('connect', () => emit.joinRoom(code));
  }, [code]);

  // ── Auto-start countdown ticker ─────────────────────────────────────────────
  useEffect(() => {
    if (autoStartRemaining === null) return;
    if (autoStartRemaining <= 0) return;
    const t = setInterval(() => setAutoStartRemaining(r => (r !== null && r > 0 ? r - 1 : r)), 1000);
    return () => clearInterval(t);
  }, [autoStartRemaining !== null]);

  // ── Socket listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const onJoinedOrCreated = ({ session: s, tierLimits: tl }) => {
      if (s) updateSession(s);
      if (tl) { setTierLimits(tl); setCustomDuration(s?.autoStartDuration || tl.min); }
    };
    const onReconnected = ({ session: s }) => {
      updateSession(s);
      if (s?.status === 'in_progress') navigateRef.current(`/game/${code}`);
    };
    const onPlayerJoined = ({ session: s }) => updateSession(s);
    const onPlayerLeft   = ({ session: s }) => updateSession(s);
    const onReadyUpdate  = ({ session: s }) => updateSession(s);
    const onHostTransferred = () => {};

    const onAutoStartTimerBegun = ({ duration, expiresAt }) => {
      setAutoStartRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };
    const onAutoStartCancelled = ({ reason }) => {
      setError(reason);
      setAutoStartRemaining(null);
    };
    const onAutoStarting = () => setAutoStartRemaining(null);
    const onPlayerRemovedAutoStart = ({ username }) => {
      setError(`${username} was removed (not ready)`);
      setTimeout(() => setError(''), 4000);
    };
    const onAutoStartDurationSet = ({ duration }) => {
      setCustomDuration(duration);
      setShowTimerEdit(false);
    };

    const onYouWereKicked = ({ reason }) => {
      alert(`You were removed from the room: ${reason}`);
      navigateRef.current('/lobby');
    };

    const onKickVoteStarted = (data) => setActiveKickVote(data);
    const onKickVoteUpdate  = (data) => setActiveKickVote(prev => prev ? { ...prev, ...data } : data);
    const onKickVoteFailed  = () => { setActiveKickVote(null); };
    const onKickVoteExpired = () => { setActiveKickVote(null); };
    const onPlayerKicked = ({ session: s }) => { updateSession(s); setActiveKickVote(null); };

    const onCountdownStarted = ({ seconds }) => setCountdown(seconds);
    const onCountdownTick    = ({ seconds }) => setCountdown(seconds);
    const onGameStarted = ({ session: s }) => {
      if (s) updateSession(s);
      setCountdown(null);
      navigateRef.current(`/game/${code}`);
    };
    const onError = ({ message }) => setError(message);

    socket.on('joinedRoom', onJoinedOrCreated);
    socket.on('roomCreated', onJoinedOrCreated);
    socket.on('reconnected', onReconnected);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('playerLeft', onPlayerLeft);
    socket.on('playerReadyUpdate', onReadyUpdate);
    socket.on('hostTransferred', onHostTransferred);
    socket.on('autoStartTimerBegun', onAutoStartTimerBegun);
    socket.on('autoStartCancelled', onAutoStartCancelled);
    socket.on('autoStarting', onAutoStarting);
    socket.on('playerRemovedAutoStart', onPlayerRemovedAutoStart);
    socket.on('autoStartDurationSet', onAutoStartDurationSet);
    socket.on('youWereKicked', onYouWereKicked);
    socket.on('kickVoteStarted', onKickVoteStarted);
    socket.on('kickVoteUpdate', onKickVoteUpdate);
    socket.on('kickVoteFailed', onKickVoteFailed);
    socket.on('kickVoteExpired', onKickVoteExpired);
    socket.on('playerKicked', onPlayerKicked);
    socket.on('countdownStarted', onCountdownStarted);
    socket.on('countdownTick', onCountdownTick);
    socket.on('gameStarted', onGameStarted);
    socket.on('error', onError);

    return () => {
      socket.off('joinedRoom', onJoinedOrCreated);
      socket.off('roomCreated', onJoinedOrCreated);
      socket.off('reconnected', onReconnected);
      socket.off('playerJoined', onPlayerJoined);
      socket.off('playerLeft', onPlayerLeft);
      socket.off('playerReadyUpdate', onReadyUpdate);
      socket.off('hostTransferred', onHostTransferred);
      socket.off('autoStartTimerBegun', onAutoStartTimerBegun);
      socket.off('autoStartCancelled', onAutoStartCancelled);
      socket.off('autoStarting', onAutoStarting);
      socket.off('playerRemovedAutoStart', onPlayerRemovedAutoStart);
      socket.off('autoStartDurationSet', onAutoStartDurationSet);
      socket.off('youWereKicked', onYouWereKicked);
      socket.off('kickVoteStarted', onKickVoteStarted);
      socket.off('kickVoteUpdate', onKickVoteUpdate);
      socket.off('kickVoteFailed', onKickVoteFailed);
      socket.off('kickVoteExpired', onKickVoteExpired);
      socket.off('playerKicked', onPlayerKicked);
      socket.off('countdownStarted', onCountdownStarted);
      socket.off('countdownTick', onCountdownTick);
      socket.off('gameStarted', onGameStarted);
      socket.off('error', onError);
    };
  }, [code]);

  const handleReady    = () => emit.playerReady?.(code) || connectSocket()?.emit('playerReady', { roomCode: code });
  const handleStart    = () => connectSocket()?.emit('startGame', { roomCode: code });
  const handleLeave    = () => { connectSocket()?.emit('leaveRoom', { roomCode: code }); navigate('/lobby'); };
  const handleSetTimer = () => connectSocket()?.emit('setAutoStartDuration', { roomCode: code, duration: customDuration });

  const handleInitiateKick = (targetId) => {
    connectSocket()?.emit('initiateKickVote', { roomCode: code, targetPlayerId: targetId });
    setKickTargetSelect(null);
  };
  const handleCastVote = (vote) => {
    if (!activeKickVote) return;
    connectSocket()?.emit('castKickVote', { roomCode: code, targetPlayerId: activeKickVote.targetId, vote });
  };

  const myVoteCast = activeKickVote && myEntry?.id !== activeKickVote.targetId;
  const isTargetOfVote = activeKickVote?.targetId === (myEntry?.id);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center">
          <p className="font-mono text-xs text-gray-600 uppercase tracking-widest mb-1">Waiting Room</p>
          <h1 className="font-display text-3xl font-bold text-green-400 tracking-wider">{code}</h1>
          {session && (
            <p className="font-mono text-xs text-gray-600 mt-2">
              {players.length}/{session.maxPlayers} players · {readyCount} ready
              {' · '}{session.difficultyCurve || 'stepped'} curve
            </p>
          )}
        </div>

        {/* Auto-start timer bar */}
        {autoStartRemaining !== null && countdown === null && (
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-gray-500 uppercase tracking-wider">⏱ Auto-start in</p>
              <span className={`font-mono text-lg font-bold ${autoStartRemaining <= 30 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
                {formatTime(autoStartRemaining)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <motion.div className="h-full bg-yellow-500"
                animate={{ width: `${(autoStartRemaining / customDuration) * 100}%` }}
                transition={{ ease: 'linear' }}/>
            </div>
            <p className="font-mono text-[10px] text-gray-700">
              If timer expires, ready players start automatically; not-ready players are removed.
            </p>

            {/* Host can adjust duration */}
            {isHost && (
              <div className="pt-2">
                {!showTimerEdit ? (
                  <button onClick={() => setShowTimerEdit(true)} className="font-mono text-[10px] text-gray-600 hover:text-green-400">
                    Adjust timer ({tierLimits.min}s–{tierLimits.max}s allowed)
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="range" min={tierLimits.min} max={tierLimits.max} value={customDuration}
                      onChange={e => setCustomDuration(parseInt(e.target.value))}
                      className="flex-1 accent-yellow-500"/>
                    <span className="font-mono text-xs text-yellow-400 w-14">{formatTime(customDuration)}</span>
                    <button onClick={handleSetTimer} className="font-mono text-xs text-green-500 border border-green-800 px-2 py-1 rounded">✓</button>
                    <button onClick={() => setShowTimerEdit(false)} className="font-mono text-xs text-gray-600 px-2 py-1">✕</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Countdown overlay */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-4">
              <p className="font-mono text-xs text-gray-500 uppercase tracking-widest mb-2">Game starting in</p>
              <p className="font-display text-8xl font-black text-green-400">{countdown}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Kick vote banner */}
        <AnimatePresence>
          {activeKickVote && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="glass-card p-4 border border-red-800/50 space-y-3">
              <p className="font-mono text-sm text-red-400">
                🗳 Vote to kick <span className="font-bold">{activeKickVote.target}</span>
              </p>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-600 transition-all" style={{ width: `${Math.min(100, (activeKickVote.votesFor / activeKickVote.votesNeeded) * 100)}%` }}/>
              </div>
              <p className="font-mono text-[10px] text-gray-600">
                {activeKickVote.votesFor}/{activeKickVote.votesNeeded} votes needed ({activeKickVote.totalEligible} eligible)
              </p>
              {!isTargetOfVote && (
                <div className="flex gap-2">
                  <button onClick={() => handleCastVote(true)} className="flex-1 font-mono text-xs bg-red-900/40 border border-red-700 text-red-300 py-2 rounded hover:bg-red-900/60">
                    Vote to Kick
                  </button>
                  <button onClick={() => handleCastVote(false)} className="flex-1 font-mono text-xs bg-gray-800 border border-gray-700 text-gray-400 py-2 rounded hover:bg-gray-700">
                    Keep Player
                  </button>
                </div>
              )}
              {isTargetOfVote && <p className="font-mono text-xs text-yellow-500 text-center">A vote is happening about you</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player list */}
        {countdown === null && (
          <div className="glass-card p-5 space-y-3">
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">Players</h2>
            {players.length === 0 ? (
              <p className="font-mono text-xs text-gray-700">Waiting for players…</p>
            ) : players.map(p => {
              const isMe = p.id === (player?._id || player?.id);
              const isPHost = p.id === session?.createdBy;
              return (
                <div key={p.id || p.username} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${p.alive !== false ? 'bg-green-500' : 'bg-gray-700'}`} />
                    <span className="font-mono text-sm text-white">{p.username}{isMe && ' (you)'}</span>
                    {isPHost && <span className="font-mono text-[10px] text-yellow-500 border border-yellow-800 px-1 rounded">HOST</span>}
                    {p.isVerified && <span className="font-mono text-[10px] text-blue-400 border border-blue-800 px-1 rounded">✓</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs ${p.ready ? 'text-green-400' : 'text-gray-700'}`}>
                      {p.ready ? '✓ READY' : 'not ready'}
                    </span>
                    {!isMe && canVoteKick && !activeKickVote && (isHost || true) && (
                      <button onClick={() => handleInitiateKick(p.id)}
                        className="opacity-0 group-hover:opacity-100 font-mono text-[10px] text-red-700 hover:text-red-400 border border-transparent hover:border-red-900 px-1.5 rounded transition-all">
                        kick
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!canVoteKick && players.length > 1 && (
              <p className="font-mono text-[10px] text-gray-700 pt-1">Need 3+ players in room to vote-kick</p>
            )}
          </div>
        )}

        {error && <p className="font-mono text-xs text-red-400 text-center bg-red-950/30 border border-red-900 rounded px-3 py-2">⚠ {error}</p>}

        {/* Actions */}
        {countdown === null && (
          <div className="space-y-3">
            {/* FIX: room creator starts auto-ready — button reflects this and
                lets them un-ready if they want to wait for something */}
            <button onClick={handleReady}
              className={`w-full font-mono text-sm py-3 rounded border transition-colors ${
                isReady ? 'bg-green-900/30 border-green-600 text-green-400' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}>
              {isReady
                ? (isHost ? '✓ READY (host — auto-ready)' : '✓ READY — click to un-ready')
                : 'CLICK WHEN READY'}
            </button>

            {isHost && (
              <button onClick={handleStart} disabled={!canStart}
                className="btn-primary w-full disabled:opacity-50 text-lg py-4">
                {readyCount < (session?.minPlayers || 1)
                  ? `Need ${session?.minPlayers || 1}+ ready player(s) to start`
                  : `▶ START NOW (${readyCount} ready)`}
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
