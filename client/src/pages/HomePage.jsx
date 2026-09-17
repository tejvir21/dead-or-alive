/**
 * HomePage.jsx — Auth-aware (Option A)
 *
 * Logged OUT → shows: START PLAYING  |  SIGN IN  |  LEADERBOARD
 * Logged IN  → shows: GO TO LOBBY (username)  |  LEADERBOARD  |  SIGN OUT
 *
 * The game description stays the same for both states.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';

export default function HomePage() {
  const navigate = useNavigate();
  const player      = useAuthStore(s => s.player);
  const accessToken = useAuthStore(s => s.accessToken);
  const logout      = useAuthStore(s => s.logout);

  const isLoggedIn = !!(player && accessToken);

  const handleLogout = async () => {
    await logout();
    // Stay on home page after logout — no redirect needed
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-2xl w-full space-y-10">

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="font-mono text-xs tracking-[0.4em] text-gray-600 uppercase mb-4">
            Real-Time Multiplayer Survival
          </p>
          <h1 className="font-display text-6xl md:text-7xl font-black tracking-tight leading-none">
            <span className="text-green-400">DEAD</span>
            <span className="text-gray-600"> OR </span>
            <span className="text-red-500">ALIVE</span>
          </h1>
          <p className="font-display text-xl tracking-[0.3em] text-gray-400 uppercase mt-3">
            Logic Escape
          </p>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="font-body text-gray-500 text-lg leading-relaxed"
        >
          {isLoggedIn
            ? <>Welcome back, <span className="text-green-400 font-semibold">{player.username}</span>. Your next escape awaits.</>
            : <>3–8 players. Multiple rooms. Two doors. Only <span className="text-green-400 font-semibold">logic</span> separates the <span className="text-green-300">living</span> from the <span className="text-red-400">dead</span>.</>
          }
        </motion.p>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          {isLoggedIn ? (
            // ── Logged-in state ─────────────────────────────────────────────
            <>
              <button
                onClick={() => navigate('/lobby')}
                className="btn-primary text-lg px-10 py-4 flex items-center gap-3"
              >
                <span className="text-xl">🎮</span>
                GO TO LOBBY
              </button>

              <button
                onClick={() => navigate('/leaderboard')}
                className="btn-secondary px-6 py-4"
              >
                🏆 LEADERBOARD
              </button>

              <button
                onClick={handleLogout}
                className="font-mono text-sm text-gray-600 hover:text-red-400 transition-colors px-4 py-4"
              >
                SIGN OUT
              </button>
            </>
          ) : (
            // ── Logged-out state ────────────────────────────────────────────
            <>
              <button
                onClick={() => navigate('/register')}
                className="btn-primary text-lg px-10 py-4"
              >
                START PLAYING
              </button>

              <button
                onClick={() => navigate('/login')}
                className="btn-secondary px-6 py-4"
              >
                SIGN IN
              </button>

              <button
                onClick={() => navigate('/leaderboard')}
                className="btn-secondary px-6 py-4"
              >
                🏆 LEADERBOARD
              </button>
            </>
          )}
        </motion.div>

        {/* Feature badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-3"
        >
          {[
            { icon: '🧩', label: 'Procedural Puzzles' },
            { icon: '⚡', label: 'Real-time Multiplayer' },
            { icon: '💀', label: 'Elimination Rounds' },
            { icon: '🔒', label: 'Anti-Cheat System' },
            { icon: '🏆', label: 'Global Leaderboard' },
            { icon: '👁️', label: 'Spectator Mode' },
          ].map(f => (
            <span key={f.label}
              className="font-mono text-xs text-gray-600 border border-gray-800 px-3 py-1.5 rounded-full hover:border-gray-600 hover:text-gray-400 transition-colors">
              {f.icon} {f.label}
            </span>
          ))}
        </motion.div>

        {/* Verified/subscribed badge if logged in */}
        {isLoggedIn && (player.isVerified || player.subscription?.plan !== 'free') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
            <span className="font-mono text-xs text-yellow-500 border border-yellow-800 px-3 py-1 rounded-full">
              {player.subscription?.plan === 'elite' ? '⭐ ELITE' :
               player.subscription?.plan === 'pro'   ? '✨ PRO'   :
               player.isVerified                      ? '✓ VERIFIED' : ''}
            </span>
          </motion.div>
        )}

      </div>
    </div>
  );
}
