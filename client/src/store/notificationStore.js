/**
 * notificationStore.js — Zustand store for the notification bell
 * Fetches history from the server, tracks unread count, and listens for
 * real-time 'notification' socket events for instant delivery.
 */
import { create } from 'zustand';
import { apiJSON } from '../api/apiClient';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount:   0,
  loading:       false,
  hasMore:       false,
  page:          1,

  // ── Fetch notification history (paginated) ──────────────────────────────────
  fetchNotifications: async (reset = false) => {
    const page = reset ? 1 : get().page;
    set({ loading: true });
    try {
      const data = await apiJSON(`/notifications?page=${page}&limit=30`);
      set(s => ({
        notifications: reset ? data.notifications : [...s.notifications, ...data.notifications],
        unreadCount: data.unreadCount,
        hasMore: page < data.pages,
        page: page + 1,
        loading: false,
      }));
    } catch (_) {
      set({ loading: false });
    }
  },

  // ── Lightweight unread-count poll (call this on app boot + periodically) ────
  fetchUnreadCount: async () => {
    try {
      const data = await apiJSON('/notifications/unread-count');
      set({ unreadCount: data.unreadCount });
    } catch (_) {}
  },

  // ── Real-time: called by socketClient.js when a 'notification' event arrives ─
  receiveRealtimeNotification: (notification) => {
    set(s => ({
      notifications: [{ ...notification, _id: notification.id || `temp-${Date.now()}` }, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    }));
  },

  // ── Mark one as read ──────────────────────────────────────────────────────────
  markAsRead: async (id) => {
    set(s => ({
      notifications: s.notifications.map(n => n._id === id ? { ...n, isRead: true } : n),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
    try { await apiJSON(`/notifications/${id}/read`, { method: 'PATCH' }); } catch (_) {}
  },

  // ── Mark all as read ───────────────────────────────────────────────────────────
  markAllAsRead: async () => {
    set(s => ({ notifications: s.notifications.map(n => ({ ...n, isRead: true })), unreadCount: 0 }));
    try { await apiJSON('/notifications/read-all', { method: 'PATCH' }); } catch (_) {}
  },

  // ── Delete one ─────────────────────────────────────────────────────────────────
  deleteNotification: async (id) => {
    set(s => ({ notifications: s.notifications.filter(n => n._id !== id) }));
    try { await apiJSON(`/notifications/${id}`, { method: 'DELETE' }); } catch (_) {}
  },

  reset: () => set({ notifications: [], unreadCount: 0, loading: false, hasMore: false, page: 1 }),
}));

export default useNotificationStore;
