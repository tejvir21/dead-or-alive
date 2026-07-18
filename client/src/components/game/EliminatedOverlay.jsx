/**
 * EliminatedOverlay.jsx — Fixed
 *
 * BUG FIX: solo games (only 1 player) no longer show "Spectate" — there's
 * nobody else playing to watch. The server sends canSpectate:false in this
 * case (via youWereEliminated event), and GamePage passes it through here.
 */
import React from 'react';
import { motion } from 'framer-motion';

export default function EliminatedOverlay({ correctDoor, chosenDoor, canSpectate = true, onSpectate, onLobby }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm text-center space-y-6"
      >
        <div className="text-7xl">💀</div>
        <div>
          <h1 className="font-display text-5xl font-black text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]">
            ELIMINATED
          </h1>
          {chosenDoor && correctDoor && (
            <p className="font-mono text-xs text-gray-600 mt-3">
              You chose <span className="text-red-400 font-bold">{chosenDoor}</span>
              {' · '}Correct was <span className="text-green-400 font-bold">{correctDoor}</span>
            </p>
          )}
        </div>

        <div className="space-y-3 pt-2">
          {/* FIX: only show spectate option in multiplayer games */}
          {canSpectate && (
            <button onClick={onSpectate}
              className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 font-mono text-sm py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
              👁 SPECTATE REMAINING GAME
            </button>
          )}
          <button onClick={onLobby} className="w-full btn-primary py-3">
            ← BACK TO LOBBY
          </button>
        </div>

        {canSpectate ? (
          <p className="font-mono text-[10px] text-gray-700">
            Spectator view shows results only — no clue details are revealed.
          </p>
        ) : (
          <p className="font-mono text-[10px] text-gray-700">
            This was a solo game — no other players to spectate.
          </p>
        )}
      </motion.div>
    </div>
  );
}
