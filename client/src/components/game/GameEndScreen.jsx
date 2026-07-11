/**
 * GameEndScreen.jsx — Fixed
 *
 * Bug: was showing ELIMINATED to everyone regardless of whether the current
 * player was in the winners list. Now correctly checks if player.username
 * is in data.winners (case-insensitive to handle any capitalisation
 * differences between stored username and display).
 */
import React from 'react';
import { motion } from 'framer-motion';

export default function GameEndScreen({ data = {}, player, onLobby }) {
  const winners    = data.winners    || [];
  const allPlayers = data.allPlayers || [];
  const totalRooms = data.totalRooms || 0;

  // Case-insensitive check — badge might uppercase the name for display
  const isWinner = winners.some(
    w => w.toLowerCase() === (player?.username || '').toLowerCase()
  );

  const myRecord = allPlayers.find(
    p => p.username?.toLowerCase() === (player?.username || '').toLowerCase()
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-8 text-center">

        {/* Result banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          {isWinner ? (
            <>
              <div className="text-7xl mb-4">🏆</div>
              <h1 className="font-display text-6xl font-black text-green-400 drop-shadow-[0_0_30px_rgba(74,222,128,0.6)]">
                ESCAPED
              </h1>
              <p className="font-mono text-sm text-green-600 mt-2 uppercase tracking-widest">
                You survived all {totalRooms} rooms!
              </p>
            </>
          ) : (
            <>
              <div className="text-7xl mb-4">💀</div>
              <h1 className="font-display text-6xl font-black text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]">
                ELIMINATED
              </h1>
              <p className="font-mono text-sm text-gray-600 mt-2">
                {winners.length > 0
                  ? `${winners.length} player(s) escaped. Better luck next time.`
                  : 'All players eliminated. Nobody escaped.'}
              </p>
            </>
          )}
        </motion.div>

        {/* Survivors list */}
        {winners.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-5 text-left space-y-3"
          >
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest flex items-center gap-2">
              🏆 Survivors
            </h2>
            <div className="flex flex-wrap gap-2">
              {winners.map(name => (
                <span
                  key={name}
                  className={`font-mono text-sm px-3 py-1.5 rounded border font-bold uppercase
                    ${name.toLowerCase() === (player?.username || '').toLowerCase()
                      ? 'bg-green-900/50 border-green-500 text-green-300'
                      : 'bg-gray-900 border-gray-700 text-gray-300'
                    }`}
                >
                  {name}
                  {name.toLowerCase() === (player?.username || '').toLowerCase() && ' ← you'}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Final standings */}
        {allPlayers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-5 text-left space-y-3"
          >
            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
              Final Standings
            </h2>
            <div className="space-y-2">
              {[...allPlayers]
                .sort((a, b) => b.roomsSurvived - a.roomsSurvived)
                .map((p, i) => {
                  const isMe = p.username?.toLowerCase() === (player?.username || '').toLowerCase();
                  const survived = winners.some(w => w.toLowerCase() === p.username?.toLowerCase());
                  return (
                    <div key={p.username}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg border
                        ${isMe
                          ? 'bg-green-950/30 border-green-800'
                          : 'bg-gray-900/50 border-gray-800'
                        }`}>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-gray-600 w-6">#{i + 1}</span>
                        <span className={`font-mono text-sm font-bold ${isMe ? 'text-green-400' : 'text-white'}`}>
                          {p.username}
                        </span>
                        {survived && (
                          <span className="font-mono text-[10px] text-green-500 border border-green-800 px-1.5 rounded">
                            SURVIVED
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-display text-lg font-bold text-white">
                          {p.roomsSurvived}
                        </span>
                        <span className="font-mono text-xs text-gray-600 ml-1">
                          / {totalRooms} rooms
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex gap-4 justify-center"
        >
          <button onClick={onLobby} className="btn-primary px-8 py-3">
            ← Back to Lobby
          </button>
        </motion.div>

      </div>
    </div>
  );
}
