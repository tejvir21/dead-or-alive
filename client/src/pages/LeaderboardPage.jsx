/**
 * LeaderboardPage — Global player rankings
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const API = import.meta.env.VITE_API_URL || '/api';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/stats/leaderboard`)
      .then((r) => r.json())
      .then((d) => { setLeaderboard(d.leaderboard || []); setLoading(false); })
      .catch(() => { setError('Failed to load leaderboard'); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-void-900 px-4 py-8">
      <div
        className="fixed inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,255,136,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="font-mono text-xs text-green-500/60 hover:text-green-400 block mb-2">
              ← HOME
            </Link>
            <h1 className="font-display text-5xl tracking-wider neon-text">LEADERBOARD</h1>
            <p className="font-mono text-xs text-gray-600 mt-1">GLOBAL SURVIVOR RANKINGS</p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-green-500/50 border-t-green-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="glass-card p-8 text-center">
            <p className="text-red-400 font-body">{error}</p>
          </div>
        )}

        {/* Leaderboard */}
        {!loading && !error && (
          <div className="space-y-2">
            {leaderboard.length === 0 && (
              <div className="glass-card p-12 text-center">
                <div className="text-5xl mb-4">🏆</div>
                <p className="font-body text-gray-500">No players yet. Be the first to escape!</p>
              </div>
            )}

            {leaderboard.map((entry, i) => (
              <motion.div
                key={entry.username}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`glass-card p-4 flex items-center gap-4 ${
                  i === 0 ? 'border-yellow-600/30 bg-yellow-900/5' :
                  i === 1 ? 'border-gray-500/30 bg-gray-900/5' :
                  i === 2 ? 'border-orange-700/30 bg-orange-900/5' : ''
                }`}
              >
                {/* Rank */}
                <div className="w-10 text-center flex-shrink-0">
                  {i < 3 ? (
                    <span className="text-2xl">{MEDALS[i]}</span>
                  ) : (
                    <span className="font-display text-xl text-gray-600">#{entry.rank}</span>
                  )}
                </div>

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <div className="font-display text-xl tracking-wider text-white truncate">
                    {entry.username}
                  </div>
                  <div className="font-mono text-xs text-gray-600 mt-0.5">
                    {entry.gamesPlayed} games played
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex gap-6 text-right flex-shrink-0">
                  <div>
                    <div className="font-display text-xl text-green-400">{entry.wins}</div>
                    <div className="font-mono text-xs text-gray-600">WINS</div>
                  </div>
                  <div>
                    <div className="font-display text-xl text-white">{entry.survivalRate}%</div>
                    <div className="font-mono text-xs text-gray-600">SURVIVAL</div>
                  </div>
                  <div>
                    <div className="font-display text-xl text-blue-400">{entry.totalRoomsSurvived}</div>
                    <div className="font-mono text-xs text-gray-600">ROOMS</div>
                  </div>
                </div>

                {/* Mobile stats */}
                <div className="sm:hidden text-right">
                  <div className="font-display text-lg text-green-400">{entry.wins}W</div>
                  <div className="font-mono text-xs text-gray-600">{entry.survivalRate}%</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link to="/" className="btn-ghost">BACK TO HOME</Link>
        </div>
      </div>
    </div>
  );
}
