/**
 * GameEndScreen — Final results after all rooms are cleared or all eliminated
 */
import React from 'react';
import { motion } from 'framer-motion';

export default function GameEndScreen({ data, onLobby, playerUsername }) {
  const { winners, allPlayers, totalRooms } = data;
  const isWinner = winners?.includes(playerUsername);

  return (
    <div className="min-h-screen bg-void-900 flex flex-col items-center justify-center px-4 py-12">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: isWinner
            ? 'radial-gradient(ellipse at center, rgba(0,255,136,0.06) 0%, transparent 70%)'
            : 'radial-gradient(ellipse at center, rgba(229,62,62,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-2xl space-y-8">
        {/* Result banner */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center"
        >
          <div className="text-8xl mb-4">
            {isWinner ? '🏆' : winners?.length > 0 ? '💀' : '☠️'}
          </div>
          <h1 className={`font-display text-6xl md:text-8xl tracking-wider ${
            isWinner ? 'neon-text' : 'neon-text-red'
          }`}>
            {isWinner ? 'ESCAPED' : 'ELIMINATED'}
          </h1>
          <p className="font-mono text-sm text-gray-500 mt-3">
            {isWinner
              ? 'You survived all rooms and escaped the building!'
              : winners?.length > 0
                ? `${winners.length} player(s) escaped. Better luck next time.`
                : 'All players eliminated. Nobody escaped.'}
          </p>
        </motion.div>

        {/* Winners */}
        {winners?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="glass-card p-6"
          >
            <h2 className="font-display text-xl tracking-wider text-green-400 mb-4">
              🏆 SURVIVORS
            </h2>
            <div className="flex flex-wrap gap-2">
              {winners.map((w) => (
                <span
                  key={w}
                  className={`px-4 py-2 rounded border font-display tracking-wider ${
                    w === playerUsername
                      ? 'bg-green-900/40 border-green-500 text-green-300'
                      : 'bg-green-900/20 border-green-800/50 text-green-500'
                  }`}
                >
                  {w} {w === playerUsername ? '(you)' : ''}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* All players performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="glass-card p-6"
        >
          <h2 className="font-display text-xl tracking-wider text-white mb-4">FINAL STANDINGS</h2>
          <div className="space-y-2">
            {allPlayers
              ?.sort((a, b) => b.roomsSurvived - a.roomsSurvived)
              .map((p, i) => (
                <div
                  key={p.username}
                  className={`flex items-center justify-between px-4 py-3 rounded border ${
                    p.alive
                      ? 'bg-green-900/20 border-green-800/30'
                      : 'bg-red-900/10 border-red-900/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-gray-600 w-6">#{i + 1}</span>
                    <span className={p.alive ? '✅' : '💀'} />
                    <span className="font-body font-semibold text-white">{p.username}</span>
                    {p.username === playerUsername && <span className="text-xs text-gray-500">(you)</span>}
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg text-white">{p.roomsSurvived}</div>
                    <div className="font-mono text-xs text-gray-600">/ {totalRooms} rooms</div>
                  </div>
                </div>
              ))}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="flex gap-4"
        >
          <button onClick={onLobby} className="btn-primary flex-1">
            BACK TO LOBBY
          </button>
        </motion.div>
      </div>
    </div>
  );
}
