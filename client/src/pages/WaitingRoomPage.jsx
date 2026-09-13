/**
 * WaitingRoomPage.jsx — Phase 4 complete
 *
 * FIX: readying up no longer auto-starts the game. When everyone's ready,
 * an 'allPlayersReady' event highlights the host's Start button (pulsing
 * glow + banner) instead of the countdown firing automatically. The host
 * must click Start, or the auto-start timer eventually kicks in as before.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { connectSocket } from '../socket/socketClient';
import useGameStore from '../store/gameStore';
import useAuthStore from '../store/authStore';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const TEAM_COLORS = {
  A: { bg: 'bg-blue-950/30',   border: 'border-blue-700',   text: 'text-blue-400' },
  B: { bg: 'bg-red-950/30',    border: 'border-red-700',    text: 'text-red-400' },
  C: { bg: 'bg-purple-950/30', border: 'border-purple-700', text: 'text-purple-400' },
  D: { bg: 'bg-yellow-950/30', border: 'border-yellow-700', text: 'text-yellow-400' },
};

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
  const [activeKickVote, setActiveKickVote] = useState(null);
  const [allReady, setAllReady] = useState(false); // NEW: drives the "waiting for host" banner + pulse

  const hasJoinedRef = useRef(false);
  const code = (roomCode || '').toUpperCase();
  const players  = session?.players || [];
  const teams    = session?.teams || [];
  const mode     = session?.mode || 'solo';
  const isTeamMode = mode === 'coop' || mode === 'vs';

  const myEntry  = players.find(p => p.id === player?._id || p.id === player?.id);
  const isReady  = myEntry?.ready || false;
  const isHost   = session?.createdBy === player?._id || session?.createdBy === player?.id;
  const readyCount = players.filter(p => p.ready).length;
  const canStart = isHost && readyCount >= (session?.minPlayers || 1) &&
    (mode !== 'vs' || teams.filter(t => t.playerIds.length > 0).length >= 2);
  const canVoteKick = players.length >= 3;
  const unassigned = isTeamMode ? players.filter(p => !p.teamId) : [];

  useEffect(() => {
    if (!code || hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    setRoomCode(code);
    const socket = connectSocket();
    if (!socket) return;
    if (socket.connected) socket.emit('joinRoom', { roomCode: code });
    else socket.once('connect', () => socket.emit('joinRoom', { roomCode: code }));
  }, [code]);

  useEffect(() => {
    if (autoStartRemaining === null || autoStartRemaining <= 0) return;
    const t = setInterval(() => setAutoStartRemaining(r => (r !== null && r > 0 ? r - 1 : r)), 1000);
    return () => clearInterval(t);
  }, [autoStartRemaining !== null]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const onJoinedOrCreated = ({ session: s, tierLimits: tl }) => {
      if (s) updateSession(s);
      if (tl) { setTierLimits(tl); setCustomDuration(s?.autoStartDuration || tl.min); }
    };
    const onReconnected = ({ session: s }) => { updateSession(s); if (s?.status === 'in_progress') navigateRef.current(`/game/${code}`); };
    const onPlayerJoined = ({ session: s }) => updateSession(s);
    const onPlayerLeft   = ({ session: s }) => updateSession(s);
    const onReadyUpdate  = ({ session: s }) => { updateSession(s); setAllReady(false); }; // reset banner on any ready toggle; re-set by allPlayersReady below
    const onAllPlayersReady = ({ session: s }) => { updateSession(s); setAllReady(true); };
    const onTeamsUpdated = ({ session: s }) => updateSession(s);

    const onAutoStartTimerBegun = ({ duration, expiresAt }) => setAutoStartRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    const onAutoStartCancelled = ({ reason }) => { setError(reason); setAutoStartRemaining(null); };
    const onAutoStarting = () => setAutoStartRemaining(null);
    const onPlayerRemovedAutoStart = ({ username }) => { setError(`${username} was removed (not ready)`); setTimeout(() => setError(''), 4000); };
    const onAutoStartDurationSet = ({ duration }) => { setCustomDuration(duration); setShowTimerEdit(false); };
    const onYouWereKicked = ({ reason }) => { alert(`You were removed from the room: ${reason}`); navigateRef.current('/lobby'); };
    const onKickVoteStarted = (data) => setActiveKickVote(data);
    const onKickVoteUpdate  = (data) => setActiveKickVote(prev => prev ? { ...prev, ...data } : data);
    const onKickVoteFailed  = () => setActiveKickVote(null);
    const onKickVoteExpired = () => setActiveKickVote(null);
    const onPlayerKicked = ({ session: s }) => { updateSession(s); setActiveKickVote(null); };
    const onCountdownStarted = ({ seconds }) => setCountdown(seconds);
    const onCountdownTick    = ({ seconds }) => setCountdown(seconds);
    const onGameStarted = ({ session: s }) => { if (s) updateSession(s); setCountdown(null); navigateRef.current(`/game/${code}`); };
    const onError = ({ message }) => setError(message);

    socket.on('joinedRoom', onJoinedOrCreated);
    socket.on('roomCreated', onJoinedOrCreated);
    socket.on('reconnected', onReconnected);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('playerLeft', onPlayerLeft);
    socket.on('playerReadyUpdate', onReadyUpdate);
    socket.on('allPlayersReady', onAllPlayersReady);
    socket.on('teamsUpdated', onTeamsUpdated);
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
      socket.off('joinedRoom', onJoinedOrCreated); socket.off('roomCreated', onJoinedOrCreated);
      socket.off('reconnected', onReconnected); socket.off('playerJoined', onPlayerJoined);
      socket.off('playerLeft', onPlayerLeft); socket.off('playerReadyUpdate', onReadyUpdate);
      socket.off('allPlayersReady', onAllPlayersReady); socket.off('teamsUpdated', onTeamsUpdated);
      socket.off('autoStartTimerBegun', onAutoStartTimerBegun); socket.off('autoStartCancelled', onAutoStartCancelled);
      socket.off('autoStarting', onAutoStarting); socket.off('playerRemovedAutoStart', onPlayerRemovedAutoStart);
      socket.off('autoStartDurationSet', onAutoStartDurationSet); socket.off('youWereKicked', onYouWereKicked);
      socket.off('kickVoteStarted', onKickVoteStarted); socket.off('kickVoteUpdate', onKickVoteUpdate);
      socket.off('kickVoteFailed', onKickVoteFailed); socket.off('kickVoteExpired', onKickVoteExpired);
      socket.off('playerKicked', onPlayerKicked); socket.off('countdownStarted', onCountdownStarted);
      socket.off('countdownTick', onCountdownTick); socket.off('gameStarted', onGameStarted); socket.off('error', onError);
    };
  }, [code]);

  const handleReady    = () => connectSocket()?.emit('playerReady', { roomCode: code });
  const handleStart    = () => connectSocket()?.emit('startGame', { roomCode: code });
  const handleLeave    = () => { connectSocket()?.emit('leaveRoom', { roomCode: code }); navigate('/lobby'); };
  const handleSetTimer = () => connectSocket()?.emit('setAutoStartDuration', { roomCode: code, duration: customDuration });
  const handleAssignTeam = (targetPlayerId, teamId) => connectSocket()?.emit('assignTeam', { roomCode: code, targetPlayerId, teamId });
  const handleQuickTeam  = () => connectSocket()?.emit('quickTeam', { roomCode: code });
  const handleInitiateKick = (targetId) => connectSocket()?.emit('initiateKickVote', { roomCode: code, targetPlayerId: targetId });
  const handleCastVote = (vote) => { if (activeKickVote) connectSocket()?.emit('castKickVote', { roomCode: code, targetPlayerId: activeKickVote.targetId, vote }); };

  const isTargetOfVote = activeKickVote?.targetId === myEntry?.id;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl space-y-6">

        <div className="text-center">
          <p className="font-mono text-xs text-gray-600 uppercase tracking-widest mb-1">Waiting Room</p>
          <h1 className="font-display text-3xl font-bold text-green-400 tracking-wider">{code}</h1>
          {session && (
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <p className="font-mono text-xs text-gray-600">
                {players.length}/{session.maxPlayers} players · {readyCount} ready · {session.difficultyCurve || 'stepped'} curve
              </p>
              {mode !== 'solo' && (
                <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${mode === 'coop' ? 'text-cyan-400 border-cyan-800' : 'text-orange-400 border-orange-800'}`}>
                  {mode === 'coop' ? `🤝 CO-OP (${session.coopSubMode?.toUpperCase()})` : '⚔ VS'}
                </span>
              )}
              {session.isClanMatch && <span className="font-mono text-[10px] px-2 py-0.5 rounded border text-pink-400 border-pink-800">🛡️ CLAN MATCH</span>}
            </div>
          )}
        </div>

        {/* NEW: all-ready banner — replaces auto-start, just prompts the host */}
        <AnimatePresence>
          {allReady && countdown === null && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="glass-card p-3 border border-green-700 bg-green-950/20 text-center">
              <p className="font-mono text-xs text-green-400">
                ✓ Everyone's ready! {isHost ? 'Click Start Game below when you\'re ready to begin.' : 'Waiting for the host to start the game…'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {autoStartRemaining !== null && countdown === null && (
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-gray-500 uppercase tracking-wider">⏱ Auto-start in</p>
              <span className={`font-mono text-lg font-bold ${autoStartRemaining <= 30 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>{formatTime(autoStartRemaining)}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <motion.div className="h-full bg-yellow-500" animate={{ width: `${(autoStartRemaining / customDuration) * 100}%` }} transition={{ ease: 'linear' }}/>
            </div>
            <p className="font-mono text-[10px] text-gray-700">
              If the host hasn't started by then, ready players begin automatically and others are removed.
            </p>
            {isHost && (
              <div className="pt-2">
                {!showTimerEdit ? (
                  <button onClick={() => setShowTimerEdit(true)} className="font-mono text-[10px] text-gray-600 hover:text-green-400">Adjust timer ({tierLimits.min}s–{tierLimits.max}s allowed)</button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="range" min={tierLimits.min} max={tierLimits.max} value={customDuration} onChange={e => setCustomDuration(parseInt(e.target.value))} className="flex-1 accent-yellow-500"/>
                    <span className="font-mono text-xs text-yellow-400 w-14">{formatTime(customDuration)}</span>
                    <button onClick={handleSetTimer} className="font-mono text-xs text-green-500 border border-green-800 px-2 py-1 rounded">✓</button>
                    <button onClick={() => setShowTimerEdit(false)} className="font-mono text-xs text-gray-600 px-2 py-1">✕</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <AnimatePresence>
          {countdown !== null && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-4">
              <p className="font-mono text-xs text-gray-500 uppercase tracking-widest mb-2">Game starting in</p>
              <p className="font-display text-8xl font-black text-green-400">{countdown}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeKickVote && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-card p-4 border border-red-800/50 space-y-3">
              <p className="font-mono text-sm text-red-400">🗳 Vote to kick <span className="font-bold">{activeKickVote.target}</span></p>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-red-600 transition-all" style={{ width: `${Math.min(100, (activeKickVote.votesFor / activeKickVote.votesNeeded) * 100)}%` }}/></div>
              <p className="font-mono text-[10px] text-gray-600">{activeKickVote.votesFor}/{activeKickVote.votesNeeded} votes needed</p>
              {!isTargetOfVote && (
                <div className="flex gap-2">
                  <button onClick={() => handleCastVote(true)} className="flex-1 font-mono text-xs bg-red-900/40 border border-red-700 text-red-300 py-2 rounded">Vote to Kick</button>
                  <button onClick={() => handleCastVote(false)} className="flex-1 font-mono text-xs bg-gray-800 border border-gray-700 text-gray-400 py-2 rounded">Keep Player</button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {isTeamMode && countdown === null && (
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">Teams</h2>
              {isHost && !session?.isClanMatch && (
                <button onClick={handleQuickTeam} className="font-mono text-[10px] text-cyan-400 border border-cyan-800 hover:bg-cyan-950/30 px-2 py-1 rounded">
                  🛡️ Quick-Team (by clan)
                </button>
              )}
            </div>
            <div className={`grid gap-3 ${teams.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-' + teams.length}`}>
              {teams.map(team => {
                const colors = TEAM_COLORS[team.id] || TEAM_COLORS.A;
                const teamPlayers = players.filter(p => p.teamId === team.id);
                return (
                  <div key={team.id} className={`rounded-lg border p-3 space-y-2 ${colors.bg} ${colors.border}`}>
                    <p className={`font-mono text-xs font-bold ${colors.text}`}>Team {team.id} ({teamPlayers.length})</p>
                    {teamPlayers.length === 0 ? <p className="font-mono text-[10px] text-gray-700">Empty</p> : teamPlayers.map(p => (
                      <div key={p.id} className="flex items-center justify-between">
                        <span className="font-mono text-xs text-white">{p.username}{p.id === myEntry?.id && ' (you)'}</span>
                        {isHost && !session?.isClanMatch && (
                          <select value={team.id} onChange={e => handleAssignTeam(p.id, e.target.value)} className="input-field text-[10px] py-0.5 px-1 w-auto">
                            {teams.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            {unassigned.length > 0 && (
              <div className="border border-gray-800 rounded-lg p-3 space-y-2">
                <p className="font-mono text-xs text-gray-500">Unassigned</p>
                {unassigned.map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-400">{p.username}</span>
                    {isHost && (
                      <select defaultValue="" onChange={e => e.target.value && handleAssignTeam(p.id, e.target.value)} className="input-field text-[10px] py-0.5 px-1 w-auto">
                        <option value="" disabled>Assign…</option>
                        {teams.map(t => <option key={t.id} value={t.id}>Team {t.id}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {countdown === null && (
          <div className="glass-card p-5 space-y-3">
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">Players</h2>
            {players.length === 0 ? <p className="font-mono text-xs text-gray-700">Waiting for players…</p> : players.map(p => {
              const isMe = p.id === (player?._id || player?.id);
              const isPHost = p.id === session?.createdBy;
              return (
                <div key={p.id || p.username} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${p.alive !== false ? 'bg-green-500' : 'bg-gray-700'}`} />
                    <span className="font-mono text-sm text-white">{p.username}{isMe && ' (you)'}</span>
                    {isPHost && <span className="font-mono text-[10px] text-yellow-500 border border-yellow-800 px-1 rounded">HOST</span>}
                    {p.isVerified && <span className="font-mono text-[10px] text-blue-400 border border-blue-800 px-1 rounded">✓</span>}
                    {isTeamMode && p.teamId && <span className={`font-mono text-[10px] px-1 rounded border ${(TEAM_COLORS[p.teamId]||TEAM_COLORS.A).text} ${(TEAM_COLORS[p.teamId]||TEAM_COLORS.A).border}`}>T{p.teamId}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs ${p.ready ? 'text-green-400' : 'text-gray-700'}`}>{p.ready ? '✓ READY' : 'not ready'}</span>
                    {!isMe && canVoteKick && !activeKickVote && (
                      <button onClick={() => handleInitiateKick(p.id)} className="opacity-0 group-hover:opacity-100 font-mono text-[10px] text-red-700 hover:text-red-400 border border-transparent hover:border-red-900 px-1.5 rounded transition-all">kick</button>
                    )}
                  </div>
                </div>
              );
            })}
            {!canVoteKick && players.length > 1 && <p className="font-mono text-[10px] text-gray-700 pt-1">Need 3+ players in room to vote-kick</p>}
          </div>
        )}

        {error && <p className="font-mono text-xs text-red-400 text-center bg-red-950/30 border border-red-900 rounded px-3 py-2 break-words">⚠ {error}</p>}

        {countdown === null && (
          <div className="space-y-3">
            <button onClick={handleReady} className={`w-full font-mono text-sm py-3 rounded border transition-colors ${isReady ? 'bg-green-900/30 border-green-600 text-green-400' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              {isReady ? (isHost ? '✓ READY (host — auto-ready)' : '✓ READY — click to un-ready') : 'CLICK WHEN READY'}
            </button>
            {isHost && (
              <button onClick={handleStart} disabled={!canStart}
                className={`w-full btn-primary disabled:opacity-50 text-lg py-4 ${allReady ? 'animate-pulse ring-2 ring-green-400' : ''}`}>
                {mode === 'vs' && teams.filter(t => t.playerIds.length > 0).length < 2
                  ? 'Need 2+ teams with players'
                  : readyCount < (session?.minPlayers || 1) ? `Need ${session?.minPlayers || 1}+ ready player(s)` : `▶ START NOW (${readyCount} ready)`}
              </button>
            )}
            <button onClick={handleLeave} className="w-full font-mono text-xs text-gray-700 hover:text-red-400 transition-colors py-2">← Leave Room</button>
          </div>
        )}
      </div>
    </div>
  );
}
