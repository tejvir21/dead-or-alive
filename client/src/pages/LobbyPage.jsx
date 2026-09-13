/**
 * LobbyPage.jsx — Fixed for mobile
 * Header now stacks vertically on small screens instead of forcing a
 * single row that overflows (title+buttons all fit on one line only on
 * wider screens; on mobile it's title on top, action buttons wrap below).
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { connectSocket, emit } from '../socket/socketClient';
import useGameStore from '../store/gameStore';
import useAuthStore from '../store/authStore';
import { apiJSON } from '../api/apiClient';
import NotificationBell from '../components/ui/NotificationBell';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const { player } = useAuthStore();
  const { setRoomCode, updateSession } = useGameStore();

  const [lobbies, setLobbies]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [joinCode, setJoinCode]       = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [creating, setCreating]       = useState(false);
  const [maxPlayers, setMaxPlayers]   = useState(8);
  const [minPlayers, setMinPlayers]   = useState(1);
  const [curve, setCurve]             = useState('stepped');

  const [settings, setSettings]       = useState(null);
  const [autoStartDuration, setAutoStartDuration] = useState(180);
  const [dailyUsage, setDailyUsage]   = useState(null);

  const intervalRef = useRef(null);
  const joinCodeRef = useRef(joinCode);
  useEffect(() => { joinCodeRef.current = joinCode; }, [joinCode]);

  const isVerifiedOrPro = player?.isVerified || (player?.subscription?.plan && player.subscription.plan !== 'free');
  const tier = player?.subscription?.plan === 'elite' ? 'elite'
    : player?.subscription?.plan === 'pro' ? 'pro'
    : player?.isVerified ? 'verified' : 'free';

  useEffect(() => {
    (async () => {
      try {
        const data = await apiJSON('/settings');
        setSettings(data.settings);
        const tierLim = data.settings?.autoStartTimer?.tierLimits?.[tier] || { min: 180, max: 180 };
        setAutoStartDuration(data.settings?.autoStartTimer?.defaultDuration
          ? Math.min(tierLim.max, Math.max(tierLim.min, data.settings.autoStartTimer.defaultDuration))
          : tierLim.min);
      } catch (_) {}
      try {
        const usage = await apiJSON('/game/daily-usage');
        setDailyUsage(usage);
      } catch (_) {}
    })();
  }, [tier]);

  const tierLimits = settings?.autoStartTimer?.tierLimits?.[tier] || { min: 180, max: 180 };

  const fetchLobbies = async () => {
    try {
      const data = await apiJSON('/game/lobbies');
      setLobbies(data.lobbies || []);
      setError('');
    } catch (err) {
      if (!/fetch|network/i.test(err.message)) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLobbies();
    intervalRef.current = setInterval(fetchLobbies, 10000);
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const onRoomCreated = ({ roomCode, session }) => {
      clearInterval(intervalRef.current);
      setRoomCode(roomCode);
      updateSession(session);
      navigate(`/waiting/${roomCode}`);
    };
    const onJoinedRoom = ({ session }) => {
      clearInterval(intervalRef.current);
      const code = joinCodeRef.current.toUpperCase();
      setRoomCode(code);
      updateSession(session);
      navigate(`/waiting/${code}`);
    };
    const onError = ({ message }) => {
      setError(message);
      setJoinLoading(false);
      setCreating(false);
    };

    socket.on('roomCreated', onRoomCreated);
    socket.on('joinedRoom', onJoinedRoom);
    socket.on('error', onError);
    return () => {
      socket.off('roomCreated', onRoomCreated);
      socket.off('joinedRoom', onJoinedRoom);
      socket.off('error', onError);
    };
  }, []);

  const handleCreateRoom = () => {
    setCreating(true); setError('');
    emit.createRoom({
      maxPlayers: parseInt(maxPlayers), minPlayers: parseInt(minPlayers),
      difficultyCurve: curve, autoStartDuration,
    });
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim()) return;
    setJoinLoading(true); setError('');
    emit.joinRoom(joinCode.trim().toUpperCase());
  };

  const handleJoinFromList = (roomCode) => {
    setJoinCode(roomCode);
    joinCodeRef.current = roomCode;
    setJoinLoading(true); setError('');
    emit.joinRoom(roomCode);
  };

  const createLimitReached = dailyUsage && dailyUsage.create?.limit !== -1 && dailyUsage.create?.used >= dailyUsage.create?.limit;
  const joinLimitReached   = dailyUsage && dailyUsage.join?.limit   !== -1 && dailyUsage.join?.used   >= dailyUsage.join?.limit;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">

        {/* Header — stacks vertically on mobile, single row on sm+ */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <button onClick={() => navigate('/')}
              className="font-mono text-xs text-gray-700 hover:text-green-400 transition-colors flex items-center gap-1 mb-2">
              ← HOME
            </button>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-green-400 tracking-wider uppercase truncate">
              Game Lobby
            </h1>
            <p className="font-mono text-xs sm:text-sm text-gray-500 mt-1 break-words">
              Signed in as <span className="text-green-400">{player?.username}</span>
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {player?.isVerified && <span className="font-mono text-[10px] text-yellow-400 border border-yellow-700 px-1.5 py-0.5 rounded">✓ VERIFIED</span>}
              {player?.subscription?.plan === 'pro'   && <span className="font-mono text-[10px] text-purple-400 border border-purple-700 px-1.5 py-0.5 rounded">✨ PRO</span>}
              {player?.subscription?.plan === 'elite' && <span className="font-mono text-[10px] text-yellow-300 border border-yellow-600 px-1.5 py-0.5 rounded">⭐ ELITE</span>}
            </div>
          </div>

          {/* Action buttons — wrap on mobile instead of forcing one row */}
          <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
            <NotificationBell />
            {player?.isAdmin && (
              <button onClick={() => navigate('/admin')}
                className="font-mono text-xs text-yellow-600 hover:text-yellow-400 border border-yellow-900 hover:border-yellow-700 px-3 py-1.5 rounded transition-colors whitespace-nowrap">
                ⚙ ADMIN
              </button>
            )}
            <button onClick={() => navigate('/profile')}
              className="font-mono text-xs text-gray-500 hover:text-green-400 border border-gray-800 hover:border-green-800 px-3 py-1.5 rounded transition-colors whitespace-nowrap">
              PROFILE
            </button>
            <button onClick={() => useAuthStore.getState().logout().then(() => navigate('/'))}
              className="font-mono text-xs text-gray-600 hover:text-red-400 transition-colors whitespace-nowrap">
              SIGN OUT
            </button>
          </div>
        </div>

        {/* Daily usage banner */}
        {dailyUsage && (dailyUsage.create?.limit !== -1 || dailyUsage.join?.limit !== -1) && (
          <div className="glass-card px-4 py-3 flex flex-wrap gap-3 sm:gap-6 text-xs font-mono">
            {dailyUsage.create?.limit !== -1 && (
              <span className={createLimitReached ? 'text-red-400' : 'text-gray-500'}>
                Rooms created today: <span className="text-white">{dailyUsage.create?.used}/{dailyUsage.create?.limit}</span>
              </span>
            )}
            {dailyUsage.join?.limit !== -1 && (
              <span className={joinLimitReached ? 'text-red-400' : 'text-gray-500'}>
                Rooms joined today: <span className="text-white">{dailyUsage.join?.used}/{dailyUsage.join?.limit}</span>
              </span>
            )}
            <span className="text-gray-700 sm:ml-auto">Resets 24h after first use</span>
          </div>
        )}

        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-400 font-mono text-sm px-4 py-3 rounded break-words">
            ⚠ {error}
          </div>
        )}

        {/* Create room */}
        <div className="glass-card p-4 sm:p-6 space-y-5">
          <h2 className="font-mono text-sm text-gray-400 uppercase tracking-widest">Create Room</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="font-mono text-xs text-gray-600 uppercase block mb-1">Max Players</label>
              <select value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} className="input-field text-sm w-full">
                {[2,4,6,8,10,12,14,16].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="font-mono text-xs text-gray-600 uppercase block mb-1">Min Players</label>
              <select value={minPlayers} onChange={e => setMinPlayers(e.target.value)} className="input-field text-sm w-full">
                {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="font-mono text-xs text-gray-600 uppercase block mb-1">Difficulty Curve</label>
              <select value={curve} onChange={e => setCurve(e.target.value)} className="input-field text-sm w-full">
                <option value="gentle">Gentle</option>
                <option value="balanced">Balanced</option>
                <option value="stepped">Stepped (default)</option>
                <option value="ascending_fast">Ascending Fast</option>
                {isVerifiedOrPro && <>
                  <option value="spike">Spike</option>
                  <option value="nightmare">Nightmare</option>
                  <option value="expert">Expert</option>
                  <option value="random">Random</option>
                </>}
              </select>
            </div>
          </div>

          {/* Auto-start timer selector */}
          <div>
            <label className="font-mono text-xs text-gray-600 uppercase block mb-1 break-words">
              Auto-start Timer — <span className="text-yellow-500">{formatTime(autoStartDuration)}</span>
              <span className="text-gray-700 ml-1 sm:ml-2 normal-case block sm:inline">({tier} tier: {formatTime(tierLimits.min)}–{formatTime(tierLimits.max)})</span>
            </label>
            <input
              type="range" min={tierLimits.min} max={tierLimits.max} step={5}
              value={autoStartDuration}
              onChange={e => setAutoStartDuration(parseInt(e.target.value))}
              disabled={tierLimits.min === tierLimits.max}
              className="w-full accent-yellow-500"
            />
            <p className="font-mono text-[10px] text-gray-700 mt-1">
              If not everyone is ready when this expires, ready players start automatically and others are removed.
              {tier === 'free' && ' Upgrade to adjust this timer.'}
            </p>
          </div>

          <button onClick={handleCreateRoom} disabled={creating || createLimitReached}
            className="btn-primary w-full disabled:opacity-50">
            {creating ? 'CREATING…' : createLimitReached ? 'DAILY LIMIT REACHED' : '+ CREATE ROOM'}
          </button>
        </div>

        {/* Join by code */}
        <div className="glass-card p-4 sm:p-6 space-y-4">
          <h2 className="font-mono text-sm text-gray-400 uppercase tracking-widest">Join by Code</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
              placeholder="Enter room code…"
              maxLength={6}
              className="input-field flex-1 font-mono text-lg tracking-widest uppercase min-w-0"
            />
            <button onClick={handleJoinRoom} disabled={!joinCode.trim() || joinLoading || joinLimitReached}
              className="btn-primary px-8 disabled:opacity-50 flex-shrink-0">
              {joinLoading ? '…' : 'JOIN'}
            </button>
          </div>
        </div>

        {/* Open lobbies */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm text-gray-400 uppercase tracking-widest">Open Lobbies</h2>
            <button onClick={fetchLobbies} className="font-mono text-xs text-gray-600 hover:text-green-400 transition-colors">
              ↻ REFRESH
            </button>
          </div>

          {loading ? (
            <p className="font-mono text-xs text-gray-700 text-center py-8">Loading…</p>
          ) : lobbies.length === 0 ? (
            <p className="font-mono text-xs text-gray-700 text-center py-8">No open rooms — create one!</p>
          ) : lobbies.map(lobby => (
            <motion.div key={lobby._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-green-400 text-lg font-bold tracking-widest">{lobby.roomCode}</span>
                  <span className="font-mono text-xs text-gray-600 border border-gray-800 px-2 py-0.5 rounded">{lobby.mode || 'solo'}</span>
                  <span className="font-mono text-xs text-gray-600">{lobby.difficultyCurve || 'stepped'}</span>
                </div>
                <p className="font-mono text-xs text-gray-600 mt-1 break-words">
                  Host: <span className="text-gray-400">{lobby.createdBy?.username || '—'}</span>
                  {' · '}{lobby.players?.length || 0}/{lobby.maxPlayers} players
                </p>
              </div>
              <button onClick={() => handleJoinFromList(lobby.roomCode)} disabled={joinLimitReached}
                className="btn-secondary text-sm disabled:opacity-50 flex-shrink-0">
                JOIN →
              </button>
            </motion.div>
          ))}
        </div>

      </div>
    </div>
  );
}
