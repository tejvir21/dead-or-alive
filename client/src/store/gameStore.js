/**
 * Game Store (Zustand)
 * Manages all in-game state synced from socket events
 */
import { create } from 'zustand';

const useGameStore = create((set, get) => ({
  // ── Session State ────────────────────────────────────────────────────────────
  roomCode: null,
  session: null,         // full session state from server
  status: 'idle',        // idle | waiting | countdown | in_progress | completed
  roundPhase: 'idle',    // idle | puzzle | door_selection | reveal | transition

  // ── Current Room ─────────────────────────────────────────────────────────────
  currentRoom: null,
  currentRoomIndex: 0,
  totalRooms: 0,

  // ── Timer ─────────────────────────────────────────────────────────────────────
  timerSeconds: 0,
  timerInterval: null,

  // ── Round State ───────────────────────────────────────────────────────────────
  myChoice: null,          // 'LIVE' | 'DIE' | null
  chosenCount: 0,
  roundResults: null,      // { correctDoor, results, survivors, eliminated }
  countdown: null,         // pre-game countdown number

  // ── Chat ──────────────────────────────────────────────────────────────────────
  chatMessages: [],

  // ── Game End ──────────────────────────────────────────────────────────────────
  gameEndData: null,

  // ── Errors / Notifications ────────────────────────────────────────────────────
  notification: null,

  // ── Actions ───────────────────────────────────────────────────────────────────
  setRoomCode: (code) => set({ roomCode: code }),

  updateSession: (session) => {
    if (!session) return;
    const current = get();
    // During active gameplay, don't overwrite roundPhase with server's stale 'idle'
    // The server roundPhase in toPublicState reflects server state which may lag
    // Phase changes are driven by specific events (roomStarted, doorSelectionStarted, etc.)
    const activePhases = ['puzzle', 'door_selection', 'reveal', 'transition'];
    const keepPhase = activePhases.includes(current.roundPhase) &&
      (session.roundPhase === 'idle' || !session.roundPhase);

    set({
      session,
      status: session.status || current.status,
      roundPhase: keepPhase ? current.roundPhase : (session.roundPhase || current.roundPhase),
      currentRoom: session.currentRoom || current.currentRoom,
      currentRoomIndex: session.currentRoomIndex ?? current.currentRoomIndex,
      totalRooms: session.totalRooms || current.totalRooms,
    });
  },

  setCountdown: (seconds) => set({ countdown: seconds }),
  clearCountdown: () => set({ countdown: null }),

  startTimer: (seconds) => {
    const { timerInterval } = get();
    if (timerInterval) clearInterval(timerInterval);

    set({ timerSeconds: seconds });
    const interval = setInterval(() => {
      const { timerSeconds } = get();
      if (timerSeconds <= 1) {
        clearInterval(interval);
        set({ timerSeconds: 0, timerInterval: null });
      } else {
        set({ timerSeconds: timerSeconds - 1 });
      }
    }, 1000);
    set({ timerInterval: interval });
  },

  stopTimer: () => {
    const { timerInterval } = get();
    if (timerInterval) clearInterval(timerInterval);
    set({ timerInterval: null, timerSeconds: 0 });
  },

  setMyChoice: (door) => set({ myChoice: door }),
  setChosenCount: (count, total) => set({ chosenCount: count }),

  setRoundResults: (results) =>
    set({ roundResults: results, roundPhase: 'reveal' }),

  clearRoundState: () =>
    set({ myChoice: null, chosenCount: 0, roundResults: null }),

  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages.slice(-99), msg], // keep last 100
    })),

  setGameEndData: (data) => set({ gameEndData: data, status: 'completed' }),

  showNotification: (msg, type = 'info') => {
    set({ notification: { msg, type, id: Date.now() } });
    setTimeout(() => set({ notification: null }), 4000);
  },

  resetGame: () => {
    const { timerInterval } = get();
    if (timerInterval) clearInterval(timerInterval);
    set({
      roomCode: null,
      session: null,
      status: 'idle',
      roundPhase: 'idle',
      currentRoom: null,
      currentRoomIndex: 0,
      totalRooms: 0,
      timerSeconds: 0,
      timerInterval: null,
      myChoice: null,
      chosenCount: 0,
      roundResults: null,
      countdown: null,
      chatMessages: [],
      gameEndData: null,
      notification: null,
    });
  },
}));

export default useGameStore;
