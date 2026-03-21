/**
 * ResultRevealPhase — Dramatic reveal of who survived and who was eliminated
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../../store/gameStore';
import useAuthStore from '../../store/authStore';

export default function ResultRevealPhase() {
  const { roundResults, myChoice } = useGameStore();
  const { player } = useAuthStore();

  if (!roundResults) return null;

  const { correctDoor, results, survivors, eliminated } = roundResults;
  const myResult = results?.find(r => r.username === player?.username);
  const iSurvived = myResult?.survived;
  const isEliminated = myResult && !myResult.survived;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center px-4 py-8"
    >
      <div className="w-full max-w-2xl space-y-6">
        {/* Personal result banner */}
        {myResult && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`rounded-xl p-8 text-center border-2 ${
              iSurvived
                ? 'bg-green-900/30 border-green-500 shadow-[0_0_40px_rgba(56,161,105,0.4)]'
                : 'bg-red-900/30 border-red-500 shadow-[0_0_40px_rgba(229,62,62,0.4)]'
            }`}
          >
            <div className="text-7xl mb-4">{iSurvived ? '✅' : '💀'}</div>
            <div className={`font-display text-6xl tracking-wider ${iSurvived ? 'neon-text' : 'neon-text-red'}`}>
              {iSurvived ? 'SURVIVED' : 'ELIMINATED'}
            </div>
            {myResult.wasAuto && !iSurvived && (
              <p className="font-mono text-xs text-gray-500 mt-2">
                (Auto-selected — you didn't choose in time)
              </p>
            )}
          </motion.div>
        )}

        {/* Correct door reveal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6 text-center"
        >
          <p className="font-mono text-xs text-gray-600 mb-2 uppercase tracking-wider">
            The correct door was
          </p>
          <div className={`font-display text-5xl tracking-[0.3em] ${
            correctDoor === 'LIVE' ? 'neon-text' : 'neon-text-red'
          }`}>
            {correctDoor}
          </div>
        </motion.div>

        {/* All players results */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass-card p-6"
        >
          <h3 className="font-display text-lg tracking-wider text-white mb-4">ROUND RESULTS</h3>
          <div className="space-y-2">
            {results?.map((r, i) => (
              <motion.div
                key={r.username}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.08 }}
                className={`flex items-center justify-between px-4 py-2 rounded border ${
                  r.survived
                    ? 'bg-green-900/20 border-green-800/40'
                    : 'bg-red-900/20 border-red-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span>{r.survived ? '✅' : '💀'}</span>
                  <span className="font-body font-semibold text-white">{r.username}</span>
                  {r.username === player?.username && (
                    <span className="text-xs text-gray-500">(you)</span>
                  )}
                  {r.wasAuto && (
                    <span className="text-xs font-mono text-gray-600 border border-gray-700 px-1 rounded">AUTO</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs ${
                    r.chosenDoor === 'LIVE' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    → {r.chosenDoor}
                  </span>
                  <span className={`badge-${r.survived ? 'alive' : 'eliminated'}`}>
                    {r.survived ? 'ALIVE' : 'DEAD'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Summary */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-white/5">
            <div className="flex-1 text-center">
              <div className="font-display text-2xl text-green-400">{survivors?.length || 0}</div>
              <div className="font-mono text-xs text-gray-600">SURVIVORS</div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <div className="font-display text-2xl text-red-400">{eliminated?.length || 0}</div>
              <div className="font-mono text-xs text-gray-600">ELIMINATED</div>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          className="text-center font-mono text-xs text-gray-700"
        >
          NEXT ROOM LOADING…
        </motion.p>
      </div>
    </motion.div>
  );
}
