/**
 * Timer — Circular countdown ring with color-coded urgency
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function Timer({ seconds, label = 'TIME', critical = false, max = 60 }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, seconds / max));
  const dashOffset = circumference * (1 - progress);

  const color = useMemo(() => {
    if (seconds <= 5) return '#ef4444';   // red
    if (seconds <= 15) return '#f59e0b';  // amber
    return '#22c55e';                      // green
  }, [seconds]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative w-28 h-28 ${seconds <= 10 ? 'timer-critical' : ''}`}>
        {/* Background ring */}
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="6"
          />
          <motion.circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
            transition={{ duration: 0.5, ease: 'linear' }}
          />
        </svg>

        {/* Number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={seconds}
            initial={{ scale: 1.2, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="font-display text-3xl leading-none"
            style={{ color }}
          >
            {seconds}
          </motion.span>
          <span className="font-mono text-[9px] text-gray-600 mt-0.5 tracking-wider">SEC</span>
        </div>
      </div>

      <span className="font-mono text-xs tracking-widest text-gray-600 uppercase">{label}</span>
    </div>
  );
}
