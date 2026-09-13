/**
 * gameStore.js — Fixed notification system
 *
 * Previous issue: showNotification existed but notifications were never
 * stored in state — they were fire-and-forget with no queue, so the
 * Notification component had nothing to render.
 *
 * Fix: notifications is now a proper array in state. showNotification
 * appends to it with a unique id and auto-removes after duration.
 * dismissNotification removes one by id (for the × button).
 */
import { create } from 'zustand';

const useGameStore = create((set, get) => ({
  // ── Room / session ─────────────────────────────────────────────────────────
  roomCode:        null,
  session:         null,
  currentRoom:     null,
  roundPhase:      'idle',   // idle | puzzle | door_selection | reveal | transition | game_end
  currentRoomIndex: 0,
  totalRooms:      0,
  chosenCount:     0,
  totalAlive:      0,
  roundResults:    null,
  gameEndData:     null,
  skippedCount:    0,

  // ── Timer ──────────────────────────────────────────────────────────────────
  timerSeconds:  0,
  _timerInterval: null,

  // ── Chat ───────────────────────────────────────────────────────────────────
  chatMessages: [],

  // ── Notifications (toast queue) ────────────────────────────────────────────
  notifications: [],

  // ── Room / session actions ─────────────────────────────────────────────────
  setRoomCode: (code) => set({ roomCode: code }),

  updateSession: (session) => {
    if (!session) return;
    set(s => ({
      session,
      // Only update totalRooms from session if we don't already have it
      totalRooms: session.totalRooms || s.totalRooms,
    }));
  },

  clearRoundState: () => set({
    currentRoom:  null,
    roundResults: null,
    chosenCount:  0,
    totalAlive:   0,
    skippedCount: 0,
  }),

  setRoundResults: (results) => set({ roundResults: results }),
  setGameEndData:  (data)    => set({ gameEndData: data }),

  // ── Timer actions ──────────────────────────────────────────────────────────
  startTimer: (seconds) => {
    get().stopTimer();
    set({ timerSeconds: seconds });
    const interval = setInterval(() => {
      set(s => {
        if (s.timerSeconds <= 1) {
          clearInterval(s._timerInterval);
          return { timerSeconds: 0, _timerInterval: null };
        }
        return { timerSeconds: s.timerSeconds - 1 };
      });
    }, 1000);
    set({ _timerInterval: interval });
  },

  stopTimer: () => {
    const { _timerInterval } = get();
    if (_timerInterval) {
      clearInterval(_timerInterval);
      set({ _timerInterval: null });
    }
  },

  setCountdown: (seconds) => set({ timerSeconds: seconds }),

  // ── Chat actions ───────────────────────────────────────────────────────────
  addChatMessage: (msg) => set(s => ({
    chatMessages: [...s.chatMessages.slice(-99), msg], // keep last 100
  })),

  clearChat: () => set({ chatMessages: [] }),

  // ── Notification actions ───────────────────────────────────────────────────
  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'|'elimination'} type
   * @param {number} duration  ms before auto-dismiss (default 4000)
   */
  showNotification: (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    set(s => ({
      notifications: [...s.notifications, { id, message, type }],
    }));
    setTimeout(() => {
      set(s => ({
        notifications: s.notifications.filter(n => n.id !== id),
      }));
    }, duration);
  },

  dismissNotification: (id) => {
    set(s => ({
      notifications: s.notifications.filter(n => n.id !== id),
    }));
  },

  // ── Reset (navigate away from game) ───────────────────────────────────────
  resetGame: () => {
    get().stopTimer();
    set({
      roomCode:         null,
      session:          null,
      currentRoom:      null,
      roundPhase:       'idle',
      currentRoomIndex: 0,
      totalRooms:       0,
      chosenCount:      0,
      totalAlive:       0,
      roundResults:     null,
      gameEndData:      null,
      skippedCount:     0,
      timerSeconds:     0,
      chatMessages:     [],
      // Keep notifications — they may still be showing
    });
  },
}));

export default useGameStore;
