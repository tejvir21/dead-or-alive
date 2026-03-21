/**
 * TransitionPhase — Between-room transition
 */
import React from 'react';
import { motion } from 'framer-motion';

export default function TransitionPhase({ nextRoom }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex items-center justify-center"
    >
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-green-500/50 border-t-green-500 rounded-full animate-spin mx-auto mb-6" />
        <h2 className="font-display text-4xl tracking-wider text-white mb-2">
          ENTERING ROOM {nextRoom}
        </h2>
        <p className="font-mono text-xs text-gray-600">Prepare yourself…</p>
      </div>
    </motion.div>
  );
}
