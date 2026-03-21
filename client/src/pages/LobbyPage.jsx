/**
 * LobbyPage — Create or join game rooms
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/authStore';
import useGameStore from '../store/gameStore';
import { emit, getSocket } from '../socket/socketClient';

const API = import.meta.env.VITE_API_URL || '/api';

export default function LobbyPage() {
  const { player, token, logout } = useAuthStore();
  const { resetGame, showNotification, setRoomCode } = useGameStore();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const [lobbies, setLobbies] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const joinCodeRef = useRef('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [minPlayers, setMinPlayers] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('browse');

  useEffect(() => {
    resetGame();
    fetchLobbies();
    const interval = setInterval(fetchLobbies, 10000);

    const socket = getSocket();
    if (!socket) return () => clearInterval(interval);

    const onRoomCreated = ({ roomCode, session }) => {
      setRoomCode(roomCode);
      navigateRef.current(`/room/${roomCode}`);
    };

    const onJoinedRoom = ({ session }) => {
      const code = joinCodeRef.current;
      if (code) navigateRef.current(`/room/${code}`);
    };

    socket.on('roomCreated', onRoomCreated);
    socket.on('joinedRoom', onJoinedRoom);

    return () => {
      clearInterval(interval);
      socket.off('roomCreated', onRoomCreated);
      socket.off('joinedRoom', onJoinedRoom);
    };
  }, []);

  const fetchLobbies = async () => {
    try {
      const res = await fetch(`${API}/game/lobbies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLobbies(data.lobbies || []);
      }
    } catch (_) {}
  };

  const handleCreate = () => {
    if (loading) return;
    setLoading(true);
    emit.createRoom({ maxPlayers, minPlayers });
    setTimeout(() => setLoading(false), 5000);
  };

  const handleJoin = (code) => {
    const c = (code || joinCode).toUpperCase().trim();
    if (!c || c.length !== 6) {
      showNotification('Enter a valid 6-character room code', 'error');
      return;
    }
    joinCodeRef.current = c;
    setJoinCode(c);
    emit.joinRoom(c);
    navigateRef.current(`/room/${c}`);
  };

  const handleSpectate = (code) => {
    emit.joinRoom(code, true);
    navigateRef.current(`/room/${code}`);
  };

  const handleJoinCodeChange = (e) => {
    const val = e.target.value.toUpperCase();
    setJoinCode(val);
    joinCodeRef.current = val;
  };

  return (
    <div className="min-h-screen bg-void-900 px-4 py-8">
      <div
        className="fixed inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,255,136,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-4xl tracking-wider neon-text">LOBBY</h1>
            <p className="font-mono text-xs text-gray-600">
              Welcome back, <span className="text-green-500">{player?.username}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/profile')} className="btn-ghost text-sm">
              👤 PROFILE
            </button>
            <button onClick={() => navigate('/leaderboard')} className="btn-ghost text-sm">
              🏆 LEADERBOARD
            </button>
            {player?.isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="btn-ghost text-sm text-yellow-400/80 hover:text-yellow-300 border-yellow-800/50"
              >
                ⚙ ADMIN
              </button>
            )}
            <button
              onClick={logout}
              className="btn-ghost text-sm text-red-400/70 hover:text-red-400"
            >
              LOGOUT
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Games Played', val: player?.stats?.gamesPlayed ?? 0 },
            { label: 'Wins', val: player?.stats?.wins ?? 0 },
            { label: 'Rooms Survived', val: player?.stats?.totalRoomsSurvived ?? 0 },
          ].map(({ label, val }) => (
            <div key={label} className="glass-card p-4 text-center">
              <div className="font-display text-3xl neon-text">{val}</div>
              <div className="font-mono text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-void-800 p-1 rounded-lg w-fit">
          {['browse', 'create', 'join'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`font-display tracking-wider px-6 py-2 rounded text-sm transition-all ${
                tab === t
                  ? 'bg-green-800/50 text-green-300 border border-green-700/50'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Browse ── */}
          {tab === 'browse' && (
            <motion.div
              key="browse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono text-xs text-gray-600">{lobbies.length} open room(s)</p>
                <button onClick={fetchLobbies} className="btn-ghost text-xs">
                  ↻ REFRESH
                </button>
              </div>
              {lobbies.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <div className="text-4xl mb-4">🚪</div>
                  <p className="font-body text-gray-500">No open rooms. Create one!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lobbies.map((lobby) => (
                    <motion.div
                      key={lobby._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="glass-card p-4 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-lg text-green-400 tracking-widest">
                            {lobby.roomCode}
                          </span>
                          <span className="badge-alive">OPEN</span>
                        </div>
                        <p className="font-body text-sm text-gray-500 mt-1">
                          Host:{' '}
                          <span className="text-gray-400">{lobby.createdBy?.username}</span>
                          {' · '}
                          {lobby.players?.length}/{lobby.maxPlayers} players{' · '}
                          Min {lobby.minPlayers} to start
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {lobby.players?.length < lobby.maxPlayers && (
                          <button
                            onClick={() => handleJoin(lobby.roomCode)}
                            className="btn-primary text-sm px-5 py-2"
                          >
                            JOIN
                          </button>
                        )}
                        <button
                          onClick={() => handleSpectate(lobby.roomCode)}
                          className="btn-ghost text-sm"
                        >
                          SPECTATE
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Create ── */}
          {tab === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass-card p-8 max-w-md"
            >
              <h2 className="font-display text-2xl tracking-wider text-white mb-6">CREATE ROOM</h2>
              <div className="space-y-5">
                <div>
                  <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-2">
                    Max Players: <span className="text-green-400">{maxPlayers}</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    value={maxPlayers}
                    onChange={(e) => {
                      const v = +e.target.value;
                      setMaxPlayers(v);
                      if (minPlayers > v) setMinPlayers(v);
                    }}
                    className="w-full accent-green-500"
                  />
                  <div className="flex justify-between font-mono text-xs text-gray-600 mt-1">
                    <span>1</span>
                    <span>8</span>
                  </div>
                </div>
                <div>
                  <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-2">
                    Min to Start: <span className="text-green-400">{minPlayers}</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={maxPlayers}
                    value={Math.min(minPlayers, maxPlayers)}
                    onChange={(e) => setMinPlayers(+e.target.value)}
                    className="w-full accent-green-500"
                  />
                  <div className="flex justify-between font-mono text-xs text-gray-600 mt-1">
                    <span>1</span>
                    <span>{maxPlayers}</span>
                  </div>
                </div>
                <button onClick={handleCreate} disabled={loading} className="btn-primary w-full">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      CREATING…
                    </span>
                  ) : (
                    'CREATE ROOM'
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Join by code ── */}
          {tab === 'join' && (
            <motion.div
              key="join"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass-card p-8 max-w-md"
            >
              <h2 className="font-display text-2xl tracking-wider text-white mb-6">JOIN BY CODE</h2>
              <div className="space-y-4">
                <div>
                  <label className="font-mono text-xs text-gray-500 uppercase tracking-wider block mb-2">
                    Room Code
                  </label>
                  <input
                    value={joinCode}
                    onChange={handleJoinCodeChange}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    className="input-field font-display text-2xl tracking-[0.4em] text-center"
                    placeholder="ABC123"
                    maxLength={6}
                  />
                </div>
                <button
                  onClick={() => handleJoin()}
                  disabled={joinCode.length !== 6}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ENTER ROOM
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
