/**
 * ProfilePage — Player stats, match history, account settings
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';

const API = import.meta.env.VITE_API_URL || '/api';

const StatCard = ({ label, value, color = 'text-green-400' }) => (
  <div className="glass-card p-5 text-center">
    <div className={`font-display text-4xl ${color} mb-1`}>{value}</div>
    <div className="font-mono text-xs text-gray-500 uppercase tracking-wider">{label}</div>
  </div>
);

export default function ProfilePage() {
  const { player, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API}/game/history`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/stats/me`, { headers: { Authorization: `Bearer ${token}` } }),
    ]).then(async ([hRes, sRes]) => {
      if (hRes.ok) { const d = await hRes.json(); setHistory(d.matches || []); }
      if (sRes.ok) { const d = await sRes.json(); setStats(d.stats); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  const survivalRate = stats && stats.gamesPlayed > 0
    ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-void-900 px-4 py-8">
      <div className="fixed inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,255,136,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.04) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative z-10 max-w-3xl mx-auto">

        {/* Nav */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/lobby" className="font-mono text-xs text-green-500/60 hover:text-green-400 block mb-2">
              ← LOBBY
            </Link>
            <h1 className="font-display text-5xl tracking-wider neon-text">PROFILE</h1>
          </div>
          <button onClick={() => { logout(); navigate('/'); }}
            className="btn-ghost text-sm text-red-400/70 hover:text-red-400">
            LOGOUT
          </button>
        </div>

        {/* Player card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 mb-6 flex items-center gap-6"
        >
          <div className="w-16 h-16 rounded-xl bg-green-900/40 border border-green-700/40 flex items-center justify-center">
            <span className="text-3xl">🎮</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-3xl tracking-wider text-white">{player?.username}</h2>
              {player?.isAdmin && (
                <span className="text-xs font-mono px-2 py-0.5 bg-yellow-900/40 border border-yellow-700/50 text-yellow-400 rounded">
                  ADMIN
                </span>
              )}
            </div>
            <p className="font-mono text-xs text-gray-600 mt-1">{player?.email}</p>
          </div>
          {player?.isAdmin && (
            <Link to="/admin"
              className="btn-ghost text-sm text-yellow-400/80 hover:text-yellow-300 border-yellow-800/50">
              ⚙ ADMIN PANEL
            </Link>
          )}
        </motion.div>

        {/* Stats grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-green-500/40 border-t-green-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <StatCard label="Games Played" value={stats?.gamesPlayed ?? 0} />
              <StatCard label="Wins" value={stats?.wins ?? 0} color="text-green-400" />
              <StatCard label="Survival Rate" value={`${survivalRate}%`} color="text-cyan-400" />
              <StatCard label="Rooms Survived" value={stats?.totalRoomsSurvived ?? 0} color="text-blue-400" />
              <StatCard label="Eliminations" value={stats?.totalEliminations ?? 0} color="text-red-400" />
              <StatCard label="Best Streak" value={stats?.longestSurvivalStreak ?? 0} color="text-yellow-400" />
            </div>

            {/* Match History */}
            <div className="glass-card p-6">
              <h3 className="font-display text-xl tracking-wider text-white mb-4">
                RECENT MATCHES
              </h3>
              {history.length === 0 ? (
                <p className="font-body text-gray-600 text-sm text-center py-6">
                  No matches played yet. <Link to="/lobby" className="text-green-500 hover:text-green-400">Enter a game →</Link>
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((match) => {
                    const me = match.players?.find(p => p.playerId === player?.id || p.username === player?.username);
                    const won = me?.isWinner;
                    const eliminated = me?.eliminatedInRoom;
                    const date = match.endedAt
                      ? new Date(match.endedAt).toLocaleDateString()
                      : '—';

                    return (
                      <div key={match._id}
                        className={`flex items-center justify-between px-4 py-3 rounded border ${
                          won
                            ? 'bg-green-900/15 border-green-800/40'
                            : 'bg-red-900/10 border-red-900/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{won ? '🏆' : '💀'}</span>
                          <div>
                            <div className="font-mono text-sm text-white tracking-widest">
                              {match.roomCode}
                            </div>
                            <div className="font-mono text-xs text-gray-600">{date}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-display text-lg ${won ? 'text-green-400' : 'text-red-400'}`}>
                            {won ? 'ESCAPED' : eliminated ? `Room ${eliminated}` : 'ELIMINATED'}
                          </div>
                          <div className="font-mono text-xs text-gray-600">
                            {match.totalRooms} rooms · {match.players?.length} players
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
