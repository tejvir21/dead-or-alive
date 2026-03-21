/**
 * HomePage — Landing screen with dramatic intro
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: 'easeOut' },
  }),
};

export default function HomePage() {
  const { player, token } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-void-900">

      {/* ── Background grid ──────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,255,136,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ── Radial glow ──────────────────────────────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full opacity-10 bg-green-500 blur-[120px]" />
      </div>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="w-[300px] h-[300px] rounded-full opacity-5 bg-red-500 blur-[80px]" />
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-4xl">

        {/* Logo / Title */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
          <p className="font-mono text-sm tracking-[0.4em] text-green-500/70 mb-4 uppercase">
            ⬛ Real-time Multiplayer Survival ⬛
          </p>
        </motion.div>

        <motion.h1
          variants={fadeUp} initial="hidden" animate="visible" custom={1}
          className="font-display text-[80px] md:text-[120px] leading-none tracking-wider mb-2"
        >
          <span className="neon-text">DEAD</span>
          <span className="text-white/20 mx-4">or</span>
          <span className="neon-text-red">ALIVE</span>
        </motion.h1>

        <motion.h2
          variants={fadeUp} initial="hidden" animate="visible" custom={2}
          className="font-display text-2xl md:text-4xl tracking-[0.3em] text-white/60 mb-10"
        >
          LOGIC ESCAPE
        </motion.h2>

        {/* Tagline */}
        <motion.p
          variants={fadeUp} initial="hidden" animate="visible" custom={3}
          className="font-body text-lg text-gray-400 max-w-xl mb-12 leading-relaxed"
        >
          3–8 players. Multiple rooms. Two doors. Only{' '}
          <span className="text-green-400 font-semibold">logic</span> separates the{' '}
          <span className="text-green-400">living</span> from the{' '}
          <span className="text-red-400">dead</span>.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="visible" custom={4}
          className="flex flex-col sm:flex-row gap-4 items-center"
        >
          {token ? (
            <>
              <button onClick={() => navigate('/lobby')} className="btn-primary text-lg px-10 py-4">
                ENTER LOBBY
              </button>
              {player?.isAdmin && (
                <button onClick={() => navigate('/admin')} className="btn-ghost text-yellow-400/80 hover:text-yellow-300">
                  ⚙ ADMIN PANEL
                </button>
              )}
              <button onClick={() => navigate('/leaderboard')} className="btn-ghost">
                LEADERBOARD
              </button>
            </>
          ) : (
            <>
              <Link to="/register" className="btn-primary text-lg px-10 py-4">
                START PLAYING
              </Link>
              <Link to="/login" className="btn-ghost">
                SIGN IN
              </Link>
              <Link to="/leaderboard" className="btn-ghost">
                LEADERBOARD
              </Link>
            </>
          )}
        </motion.div>

        {/* Feature pills */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="visible" custom={5}
          className="flex flex-wrap justify-center gap-3 mt-16"
        >
          {[
            '🧩 Procedural Puzzles',
            '⚡ Real-time Multiplayer',
            '💀 Elimination Rounds',
            '🔐 Anti-Cheat System',
            '🏆 Global Leaderboard',
            '👁️ Spectator Mode',
          ].map((feat) => (
            <span
              key={feat}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/10
                text-sm font-body text-gray-400"
            >
              {feat}
            </span>
          ))}
        </motion.div>
      </div>

      {/* ── How to play ──────────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={6}
        className="relative z-10 mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 px-4 max-w-4xl w-full"
      >
        {[
          { step: '01', label: 'Join a Room', desc: 'Create or join a lobby with 3–8 players' },
          { step: '02', label: 'Read the Clue', desc: 'Analyze environmental puzzles and hints' },
          { step: '03', label: 'Choose a Door', desc: 'LIVE or DIE — only one is correct' },
          { step: '04', label: 'Survive', desc: 'Outlast all rooms to escape the building' },
        ].map(({ step, label, desc }) => (
          <div key={step} className="glass-card p-5 text-left">
            <div className="font-mono text-3xl text-green-500/40 mb-2">{step}</div>
            <div className="font-display text-lg tracking-wider text-white mb-1">{label}</div>
            <div className="font-body text-sm text-gray-500">{desc}</div>
          </div>
        ))}
      </motion.div>

      {/* Footer */}
      <motion.p
        variants={fadeUp} initial="hidden" animate="visible" custom={7}
        className="relative z-10 mt-12 font-mono text-xs text-gray-700 pb-8"
      >
        DEAD OR ALIVE: LOGIC ESCAPE — MULTIPLAYER SURVIVAL PUZZLE GAME
      </motion.p>
    </div>
  );
}
