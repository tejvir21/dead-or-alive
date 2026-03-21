/**
 * RoomProgressBar — Shows current room progress in the header
 */
import React from 'react';

export default function RoomProgressBar({ current, total, roomCode }) {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="relative z-30 bg-void-800/95 border-b border-white/5 px-4 py-2">
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        {/* Room code */}
        <span className="font-mono text-xs text-green-500/70 tracking-widest flex-shrink-0">
          {roomCode}
        </span>

        {/* Progress bar */}
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-void-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-mono text-xs text-gray-600 flex-shrink-0 w-16 text-right">
            ROOM {current}/{total}
          </span>
        </div>

        {/* Room dots */}
        <div className="hidden sm:flex gap-1 flex-shrink-0">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i < current - 1
                  ? 'bg-green-600'
                  : i === current - 1
                    ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]'
                    : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
