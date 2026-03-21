/**
 * DoorSelectionPhase — The dramatic door choice moment
 * Players pick LIVE or DIE door
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../../store/gameStore';
import useAuthStore from '../../store/authStore';
import { emit } from '../../socket/socketClient';
import Timer from '../ui/Timer';

export default function DoorSelectionPhase({ room, roomCode }) {
  const { timerSeconds, myChoice, setMyChoice, chosenCount, session } = useGameStore();
  const { player } = useAuthStore();

  const players = session?.players || [];
  const myPlayer = players.find(p => p.username === player?.username);
  const isEliminated = myPlayer && !myPlayer.alive;

  const totalAlive = players.filter(p => p.alive).length;

  const handleChoose = (door) => {
    if (myChoice || isEliminated) return;
    setMyChoice(door);
    emit.chooseDoor(roomCode, door);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 flex flex-col items-center justify-center px-4 py-8"
    >
      <div className="w-full max-w-3xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <motion.h2
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="font-display text-4xl md:text-5xl tracking-wider text-white mb-2"
          >
            CHOOSE YOUR DOOR
          </motion.h2>
          <p className="font-mono text-xs text-gray-600">
            ONLY ONE DOOR LEADS TO SURVIVAL
          </p>
        </div>

        {/* Clue reminder */}
        {room && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="glass-card px-6 py-4 border-l-2 border-yellow-700/50 text-center"
          >
            <p className="font-mono text-xs text-yellow-500/70 mb-1">REMEMBER THE CLUE:</p>
            <p className="font-body text-white">{room.clueText}</p>
          </motion.div>
        )}

        {/* Timer */}
        <div className="flex justify-center">
          <Timer
            seconds={timerSeconds}
            label="CHOOSE NOW"
            critical={timerSeconds <= 10}
            max={room?.doorTimerSeconds || 30}
          />
        </div>

        {/* Choice status */}
        <div className="text-center font-mono text-xs text-gray-600">
          {chosenCount}/{totalAlive} players have chosen
        </div>

        {/* Door buttons */}
        {isEliminated ? (
          <div className="text-center glass-card p-8">
            <div className="text-4xl mb-3">💀</div>
            <p className="font-display text-xl tracking-wider text-red-400">YOU ARE ELIMINATED</p>
            <p className="font-mono text-xs text-gray-600 mt-2">Spectating remaining players…</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {/* LIVE door */}
            <motion.button
              whileHover={!myChoice ? { scale: 1.03 } : {}}
              whileTap={!myChoice ? { scale: 0.97 } : {}}
              onClick={() => handleChoose('LIVE')}
              disabled={!!myChoice}
              className={`door-live relative rounded-xl p-8 flex flex-col items-center justify-center
                min-h-[220px] cursor-pointer disabled:cursor-default
                ${myChoice === 'LIVE' ? 'selected' : ''}
                ${myChoice && myChoice !== 'LIVE' ? 'opacity-40' : ''}`}
            >
              {/* Door frame decorations */}
              <div className="absolute top-4 left-4 w-3 h-3 border-t-2 border-l-2 border-green-400/60" />
              <div className="absolute top-4 right-4 w-3 h-3 border-t-2 border-r-2 border-green-400/60" />
              <div className="absolute bottom-4 left-4 w-3 h-3 border-b-2 border-l-2 border-green-400/60" />
              <div className="absolute bottom-4 right-4 w-3 h-3 border-b-2 border-r-2 border-green-400/60" />

              <span className="text-5xl mb-3">🟢</span>
              <span className="font-display text-5xl tracking-[0.2em] text-green-300">LIVE</span>
              <span className="font-mono text-xs text-green-600/70 mt-2 uppercase tracking-wider">
                Survival Door
              </span>

              {myChoice === 'LIVE' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold"
                >
                  ✓
                </motion.div>
              )}
            </motion.button>

            {/* DIE door */}
            <motion.button
              whileHover={!myChoice ? { scale: 1.03 } : {}}
              whileTap={!myChoice ? { scale: 0.97 } : {}}
              onClick={() => handleChoose('DIE')}
              disabled={!!myChoice}
              className={`door-die relative rounded-xl p-8 flex flex-col items-center justify-center
                min-h-[220px] cursor-pointer disabled:cursor-default
                ${myChoice === 'DIE' ? 'selected' : ''}
                ${myChoice && myChoice !== 'DIE' ? 'opacity-40' : ''}`}
            >
              <div className="absolute top-4 left-4 w-3 h-3 border-t-2 border-l-2 border-red-400/60" />
              <div className="absolute top-4 right-4 w-3 h-3 border-t-2 border-r-2 border-red-400/60" />
              <div className="absolute bottom-4 left-4 w-3 h-3 border-b-2 border-l-2 border-red-400/60" />
              <div className="absolute bottom-4 right-4 w-3 h-3 border-b-2 border-r-2 border-red-400/60" />

              <span className="text-5xl mb-3">🔴</span>
              <span className="font-display text-5xl tracking-[0.2em] text-red-300">DIE</span>
              <span className="font-mono text-xs text-red-600/70 mt-2 uppercase tracking-wider">
                Fatal Door
              </span>

              {myChoice === 'DIE' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold"
                >
                  ✓
                </motion.div>
              )}
            </motion.button>
          </div>
        )}

        {/* Chosen confirmation */}
        <AnimatePresence>
          {myChoice && !isEliminated && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`text-center glass-card px-6 py-4 border ${
                myChoice === 'LIVE' ? 'border-green-700/50' : 'border-red-700/50'
              }`}
            >
              <p className={`font-display text-lg tracking-wider ${
                myChoice === 'LIVE' ? 'text-green-400' : 'text-red-400'
              }`}>
                YOU CHOSE: {myChoice}
              </p>
              <p className="font-mono text-xs text-gray-600 mt-1">
                Waiting for other players… Results will be revealed shortly.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
