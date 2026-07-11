/**
 * DoorSelectionPhase.jsx
 *
 * Props:
 *   room         — current room object (has clueText)
 *   timerSeconds — countdown from game store
 *   onChoose     — callback(door: 'LIVE'|'DIE') — called when player clicks
 *   eliminated   — boolean, disable doors if already eliminated
 *   chosenCount  — number of players who have chosen (from server via store)
 *   totalAlive   — total alive players (from server via store)
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Timer from '../ui/Timer';

export default function DoorSelectionPhase({
  room,
  timerSeconds,
  onChoose,
  eliminated = false,
  chosenCount = 0,
  totalAlive = 1,
}) {
  const [chosen, setChosen] = useState(null); // local state for immediate UI feedback
  const maxSeconds = room?.doorTimerSeconds || 30;
  const isUrgent = timerSeconds <= 10;

  const handleDoorClick = (door) => {
    if (chosen || eliminated) return; // already chose or eliminated
    setChosen(door);
    onChoose?.(door); // ← calls GamePage's handleChooseDoor → emit.chooseDoor
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-6 space-y-6">

      {/* Header */}
      <p className="font-mono text-xs text-gray-600 uppercase tracking-widest">
        Only one door leads to survival
      </p>

      {/* Clue reminder */}
      {room?.clueText && (
        <div className="w-full max-w-2xl glass-card p-4 border border-yellow-900/40">
          <p className="font-mono text-[10px] text-yellow-600 uppercase tracking-widest mb-1">
            Remember the clue:
          </p>
          <p className="font-body text-base text-white">{room.clueText}</p>
        </div>
      )}

      {/* Timer */}
      <Timer
        seconds={timerSeconds}
        label="CHOOSE NOW"
        max={maxSeconds}
        critical={isUrgent}
      />

      {/* Chosen counter */}
      <p className={`font-mono text-xs ${chosenCount > 0 ? 'text-green-500' : 'text-gray-600'}`}>
        {chosenCount}/{totalAlive} player{totalAlive !== 1 ? 's' : ''} have chosen
      </p>

      {/* Doors */}
      <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">

        {/* LIVE door */}
        <motion.button
          onClick={() => handleDoorClick('LIVE')}
          disabled={!!chosen || eliminated}
          whileHover={!chosen && !eliminated ? { scale: 1.03 } : {}}
          whileTap={!chosen && !eliminated ? { scale: 0.97 } : {}}
          className={`relative rounded-xl border-2 p-8 flex flex-col items-center gap-4 transition-all duration-200 cursor-pointer disabled:cursor-default
            ${chosen === 'LIVE'
              ? 'bg-green-900/50 border-green-400 shadow-[0_0_30px_rgba(74,222,128,0.3)]'
              : chosen === 'DIE'
                ? 'bg-green-950/20 border-green-900/30 opacity-50'
                : 'bg-green-950/30 border-green-700 hover:bg-green-900/40 hover:border-green-500'
            }`}
        >
          {/* Chosen checkmark */}
          {chosen === 'LIVE' && (
            <span className="absolute top-3 right-3 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
              ✓
            </span>
          )}

          {/* Corner brackets */}
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-green-500/60" />
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-green-500/60" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-green-500/60" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-green-500/60" />

          <div className={`w-16 h-16 rounded-full ${chosen === 'LIVE' ? 'bg-green-400' : 'bg-green-600'}`} />
          <div className="text-center">
            <p className={`font-display text-4xl font-black tracking-widest ${chosen === 'LIVE' ? 'text-green-300' : 'text-green-500'}`}>
              LIVE
            </p>
            <p className="font-mono text-[10px] text-green-800 uppercase tracking-widest mt-1">
              Survival Door
            </p>
          </div>
        </motion.button>

        {/* DIE door */}
        <motion.button
          onClick={() => handleDoorClick('DIE')}
          disabled={!!chosen || eliminated}
          whileHover={!chosen && !eliminated ? { scale: 1.03 } : {}}
          whileTap={!chosen && !eliminated ? { scale: 0.97 } : {}}
          className={`relative rounded-xl border-2 p-8 flex flex-col items-center gap-4 transition-all duration-200 cursor-pointer disabled:cursor-default
            ${chosen === 'DIE'
              ? 'bg-red-900/50 border-red-400 shadow-[0_0_30px_rgba(248,113,113,0.3)]'
              : chosen === 'LIVE'
                ? 'bg-red-950/20 border-red-900/30 opacity-50'
                : 'bg-red-950/30 border-red-800 hover:bg-red-900/40 hover:border-red-600'
            }`}
        >
          {/* Chosen checkmark */}
          {chosen === 'DIE' && (
            <span className="absolute top-3 right-3 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">
              ✓
            </span>
          )}

          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-red-600/60" />
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-red-600/60" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-red-600/60" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-red-600/60" />

          <div className={`w-16 h-16 rounded-full ${chosen === 'DIE' ? 'bg-red-400' : 'bg-red-700'}`} />
          <div className="text-center">
            <p className={`font-display text-4xl font-black tracking-widest ${chosen === 'DIE' ? 'text-red-300' : 'text-red-500'}`}>
              DIE
            </p>
            <p className="font-mono text-[10px] text-red-900 uppercase tracking-widest mt-1">
              Fatal Door
            </p>
          </div>
        </motion.button>

      </div>

      {/* Eliminated message */}
      {eliminated && (
        <p className="font-mono text-sm text-red-500 animate-pulse">
          💀 You have been eliminated — spectating
        </p>
      )}

      {/* Waiting message after choice */}
      {chosen && !eliminated && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-mono text-xs text-gray-500"
        >
          Waiting for other players or timer…
        </motion.p>
      )}

    </div>
  );
}
