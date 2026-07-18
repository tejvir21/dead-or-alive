/**
 * Notification.jsx — Toast notification system
 * Place <Notification /> once in App.jsx (outside routes, inside BrowserRouter).
 * Notifications are triggered anywhere via:
 *   useGameStore.getState().showNotification('message', 'success'|'error'|'warning'|'info'|'elimination')
 */
import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useGameStore from '../../store/gameStore';

const ICONS = {
  success:     '✅',
  error:       '❌',
  warning:     '⚠️',
  info:        'ℹ️',
  elimination: '💀',
};

const COLORS = {
  success:     'border-green-700 bg-green-950/80 text-green-300',
  error:       'border-red-700 bg-red-950/80 text-red-300',
  warning:     'border-yellow-700 bg-yellow-950/80 text-yellow-300',
  info:        'border-blue-700 bg-blue-950/80 text-blue-300',
  elimination: 'border-red-800 bg-red-950/90 text-red-200',
};

export default function Notification() {
  const notifications = useGameStore(s => s.notifications || []);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      <AnimatePresence>
        {notifications.map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0,  scale: 1    }}
            exit={{    opacity: 0, x: 60, scale: 0.9  }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-xl pointer-events-auto ${COLORS[n.type] || COLORS.info}`}
          >
            <span className="text-base flex-shrink-0 mt-0.5">{ICONS[n.type] || ICONS.info}</span>
            <p className="font-mono text-xs leading-relaxed flex-1">{n.message}</p>
            <button
              onClick={() => useGameStore.getState().dismissNotification(n.id)}
              className="text-current opacity-40 hover:opacity-80 flex-shrink-0 text-sm leading-none"
            >
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
