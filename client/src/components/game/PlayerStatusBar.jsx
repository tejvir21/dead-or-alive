/**
 * PlayerStatusBar — Shows all player statuses during the game
 */
import React from 'react';
import { motion } from 'framer-motion';

export default function PlayerStatusBar({ players, myUsername }) {
  return (
    <div className="relative z-20 bg-void-800/90 border-b border-white/5 px-4 py-2">
      <div className="max-w-5xl mx-auto flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs text-gray-700 mr-2">PLAYERS:</span>
        {players?.map((p) => (
          <motion.div
            key={p.username}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono ${
              p.alive
                ? p.username === myUsername
                  ? 'bg-green-900/40 border-green-700/50 text-green-300'
                  : 'bg-void-700/50 border-white/10 text-gray-400'
                : 'bg-red-900/20 border-red-900/30 text-red-600/50 line-through opacity-50'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${p.alive ? 'bg-green-400' : 'bg-red-700'}`} />
            {p.username}
            {p.username === myUsername && <span className="text-gray-600">(me)</span>}
            {p.hasChosen && p.alive && <span className="text-yellow-600">✓</span>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
