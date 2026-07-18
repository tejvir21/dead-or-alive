/**
 * NotificationBell.jsx
 * Bell icon with unread badge — place in your header/nav (LobbyPage, App layout, etc.)
 * Click opens a dropdown showing notification history with mark-as-read.
 */
import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useNotificationStore from '../../store/notificationStore';

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const {
    notifications, unreadCount, loading, hasMore,
    fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead, deleteNotification,
  } = useNotificationStore();

  // Poll unread count every 30s + fetch on mount
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open && notifications.length === 0) fetchNotifications(true);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-white transition-colors">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-mono font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto bg-gray-950 border border-gray-800 rounded-xl shadow-2xl z-50"
          >
            <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
              <span className="font-mono text-xs text-gray-400 uppercase tracking-wider">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="font-mono text-[10px] text-green-500 hover:text-green-400">
                  Mark all read
                </button>
              )}
            </div>

            {loading && notifications.length === 0 ? (
              <p className="font-mono text-xs text-gray-700 text-center py-8">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="font-mono text-xs text-gray-700 text-center py-8">No notifications yet</p>
            ) : (
              <div className="divide-y divide-gray-900">
                {notifications.map(n => (
                  <div key={n._id}
                    onClick={() => !n.isRead && markAsRead(n._id)}
                    className={`px-4 py-3 flex gap-3 cursor-pointer transition-colors hover:bg-gray-900/50 ${!n.isRead ? 'bg-blue-950/10' : ''}`}>
                    <span className="text-lg flex-shrink-0">{n.icon || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-mono text-xs ${!n.isRead ? 'text-white font-bold' : 'text-gray-400'}`}>{n.title}</p>
                        {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                      </div>
                      <p className="font-mono text-[11px] text-gray-600 mt-0.5 leading-relaxed">{n.message}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="font-mono text-[10px] text-gray-700">{timeAgo(n.createdAt)}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteNotification(n._id); }}
                          className="font-mono text-[10px] text-gray-700 hover:text-red-400">✕</button>
                      </div>
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <button onClick={() => fetchNotifications(false)} disabled={loading}
                    className="w-full py-3 font-mono text-[10px] text-gray-600 hover:text-gray-400 disabled:opacity-50">
                    {loading ? 'Loading…' : 'Load more'}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
