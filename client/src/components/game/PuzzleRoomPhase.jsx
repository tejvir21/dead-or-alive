/**
 * PuzzleRoomPhase — Shows the room environment and clue puzzle
 *
 * Hints are revealed progressively:
 *   hint[0] → shown when timer drops below 67% remaining  (e.g. 20s of 30s)
 *   hint[1] → shown when timer drops below 33% remaining  (e.g. 10s of 30s)
 *
 * This rewards players who think fast while helping slower ones catch up.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../../store/gameStore';
import Timer from '../ui/Timer';

// ── Category metadata ─────────────────────────────────────────────────────────
const CATEGORY_META = {
  number: {
    icon: '🔢',
    color: 'text-blue-400',
    border: 'border-blue-700/40',
    bg: 'bg-blue-900/10',
    label: 'NUMBER PUZZLE',
    hintIcon: '🔢',
  },
  word: {
    icon: '🔤',
    color: 'text-purple-400',
    border: 'border-purple-700/40',
    bg: 'bg-purple-900/10',
    label: 'WORD CLUE',
    hintIcon: '📖',
  },
  symbol: {
    icon: '🔣',
    color: 'text-yellow-400',
    border: 'border-yellow-700/40',
    bg: 'bg-yellow-900/10',
    label: 'SYMBOL PUZZLE',
    hintIcon: '🔍',
  },
  environment: {
    icon: '🌍',
    color: 'text-green-400',
    border: 'border-green-700/40',
    bg: 'bg-green-900/10',
    label: 'ENVIRONMENT CLUE',
    hintIcon: '👁️',
  },
  logic: {
    icon: '🧠',
    color: 'text-red-400',
    border: 'border-red-700/40',
    bg: 'bg-red-900/10',
    label: 'LOGIC RIDDLE',
    hintIcon: '💡',
  },
  pattern: {
    icon: '🔳',
    color: 'text-cyan-400',
    border: 'border-cyan-700/40',
    bg: 'bg-cyan-900/10',
    label: 'PATTERN PUZZLE',
    hintIcon: '🔄',
  },
  sound: {
    icon: '🔊',
    color: 'text-pink-400',
    border: 'border-pink-700/40',
    bg: 'bg-pink-900/10',
    label: 'SOUND CLUE',
    hintIcon: '🎵',
  },
};

const ENVIRONMENT_ICONS = {
  laboratory: '🧪',
  library: '📚',
  server_room: '💻',
  bunker: '🔒',
  observatory: '🔭',
  greenhouse: '🌿',
  archive: '🗄️',
  control_room: '⚙️',
  vault: '🔐',
  chapel: '⛩️',
};

// ── HintBadge — appears with a pop animation ─────────────────────────────────
function HintBadge({ hint, index, icon, color, border, bg }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${border} ${bg}`}
    >
      <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`font-mono text-[10px] uppercase tracking-wider mb-1 ${color} opacity-70`}>
          HINT {index + 1}
        </p>
        <p className="font-body text-sm text-gray-300 leading-relaxed">{hint}</p>
      </div>
      {/* Pulse dot to draw attention */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${color.replace('text-', 'bg-')} animate-pulse`} />
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PuzzleRoomPhase({ room }) {
  const timerSeconds = useGameStore((s) => s.timerSeconds);
  const maxSeconds = room?.timerSeconds || 30;

  // Track which hints have been revealed
  const [revealedHints, setRevealedHints] = useState([]);
  const prevTimerRef = useRef(maxSeconds);

  // Reveal hints progressively based on timer thresholds
  // hint[0] unlocks at 67% elapsed  → 33% of time remaining
  // hint[1] unlocks at 33% elapsed  → 67% of time remaining... wait,
  // easier: reveal when seconds_remaining drops BELOW threshold
  const hints = room?.hints || [];
  const threshold1 = Math.floor(maxSeconds * 0.67); // e.g. 20s of 30s
  const threshold2 = Math.floor(maxSeconds * 0.33); // e.g. 10s of 30s

  useEffect(() => {
    // Reset hints when a new room starts
    setRevealedHints([]);
    prevTimerRef.current = maxSeconds;
  }, [room?.roomId]);

  useEffect(() => {
    if (hints.length === 0) return;

    setRevealedHints((prev) => {
      const next = [...prev];
      // Reveal hint 1 when timer crosses below threshold1
      if (hints[0] && !next.includes(0) && timerSeconds <= threshold1 && timerSeconds > 0) {
        next.push(0);
      }
      // Reveal hint 2 when timer crosses below threshold2
      if (hints[1] && !next.includes(1) && timerSeconds <= threshold2 && timerSeconds > 0) {
        next.push(1);
      }
      return next;
    });
  }, [timerSeconds, threshold1, threshold2, hints]);

  if (!room) return null;

  const meta = CATEGORY_META[room.clueCategory] || CATEGORY_META.number;
  const envIcon = ENVIRONMENT_ICONS[room.environment] || '🚪';
  const timeRatio = timerSeconds / maxSeconds;
  const isUrgent = timerSeconds <= 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.45 }}
      className="flex-1 flex flex-col items-center justify-center px-4 py-6"
    >
      <div className="w-full max-w-2xl space-y-5">

        {/* ── Room header ── */}
        <div className="text-center">
          <div className="text-5xl mb-2">{envIcon}</div>
          <h2 className="font-display text-2xl tracking-wider text-white uppercase">
            {room.environment?.replace(/_/g, ' ') || 'Unknown Room'}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-base">{meta.icon}</span>
            <p className={`font-mono text-xs ${meta.color} opacity-70`}>{meta.label}</p>
          </div>
        </div>

        {/* ── Timer ── */}
        <div className="flex justify-center">
          <Timer
            seconds={timerSeconds}
            label="STUDY TIME"
            max={maxSeconds}
            critical={isUrgent}
          />
        </div>

        {/* ── Flavor text ── */}
        {room.flavorText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="glass-card p-4 border-l-2 border-white/10"
          >
            <p className="font-body text-sm text-gray-500 italic">{room.flavorText}</p>
          </motion.div>
        )}

        {/* ── Ambient objects ── */}
        {room.ambientObjects?.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="font-mono text-[10px] text-gray-700 uppercase tracking-wider">
              You observe:
            </span>
            {room.ambientObjects.map((obj) => (
              <span
                key={obj}
                className="font-mono text-xs text-gray-600 border border-white/8 px-2 py-0.5 rounded-full"
              >
                {obj}
              </span>
            ))}
          </motion.div>
        )}

        {/* ── Main clue card ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className={`relative rounded-xl border p-7 overflow-hidden ${meta.border} ${meta.bg}`}
        >
          {/* Corner accents */}
          <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${meta.border}`} />
          <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 ${meta.border}`} />
          <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 ${meta.border}`} />
          <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${meta.border}`} />

          {/* Category badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className={`font-mono text-xs uppercase tracking-widest ${meta.color} opacity-80`}>
              ⚠ SURVIVAL CLUE
            </span>
          </div>

          {/* Clue text */}
          <p className="font-body text-xl md:text-2xl text-white leading-relaxed font-semibold">
            {room.clueText}
          </p>

          {/* Difficulty indicator */}
          <div className="flex gap-1 mt-4">
            {[1, 2, 3, 4, 5].map((d) => (
              <div
                key={d}
                className={`h-1 flex-1 rounded-full transition-all ${
                  d <= (room.difficulty || 1)
                    ? `${meta.color.replace('text-', 'bg-')} opacity-60`
                    : 'bg-white/5'
                }`}
              />
            ))}
          </div>
        </motion.div>

        {/* ── Progressive hints ── */}
        {hints.length > 0 && (
          <div className="space-y-3">
            {/* Hint availability indicator — shown before any hints unlock */}
            {revealedHints.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="flex items-center gap-2 justify-center"
              >
                <div className="flex gap-1">
                  {hints.map((_, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-white/10 border border-white/20"
                    />
                  ))}
                </div>
                <span className="font-mono text-[10px] text-gray-700 uppercase tracking-wider">
                  {hints.length} hint{hints.length > 1 ? 's' : ''} unlock as time passes
                </span>
              </motion.div>
            )}

            {/* Revealed hints */}
            <AnimatePresence>
              {revealedHints.map((hintIndex) => (
                <HintBadge
                  key={hintIndex}
                  hint={hints[hintIndex]}
                  index={hintIndex}
                  icon={meta.hintIcon}
                  color={meta.color}
                  border={meta.border}
                  bg={meta.bg}
                />
              ))}
            </AnimatePresence>

            {/* Pending hints (greyed out dots) */}
            {revealedHints.length < hints.length && revealedHints.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <div className="flex gap-1">
                  {hints.slice(revealedHints.length).map((_, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-white/10 border border-white/15 animate-pulse"
                    />
                  ))}
                </div>
                <span className="font-mono text-[10px] text-gray-700">
                  {hints.length - revealedHints.length} more hint{hints.length - revealedHints.length > 1 ? 's' : ''} coming…
                </span>
              </motion.div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className={`text-center font-mono text-xs ${
            isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-700'
          }`}
        >
          {isUrgent
            ? '⚠ DOOR SELECTION STARTING SOON'
            : 'DOOR SELECTION BEGINS AFTER THE TIMER · CHOOSE WISELY'}
        </motion.p>

      </div>
    </motion.div>
  );
}
