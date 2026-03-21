/**
 * Auth Store (Zustand)
 * Manages player authentication state
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API = import.meta.env.VITE_API_URL || '/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      player: null,
      token: null,
      isLoading: false,
      error: null,

      // ── Register ────────────────────────────────────────────────────────────
      register: async ({ username, email, password }) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Registration failed');
          set({ player: data.player, token: data.token, isLoading: false });
          return { success: true };
        } catch (err) {
          set({ error: err.message, isLoading: false });
          return { success: false, error: err.message };
        }
      },

      // ── Login ───────────────────────────────────────────────────────────────
      login: async ({ email, password }) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Login failed');
          set({ player: data.player, token: data.token, isLoading: false });
          return { success: true };
        } catch (err) {
          set({ error: err.message, isLoading: false });
          return { success: false, error: err.message };
        }
      },

      // ── Logout ──────────────────────────────────────────────────────────────
      logout: async () => {
        const { token } = get();
        try {
          await fetch(`${API}/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (_) {}
        set({ player: null, token: null, error: null });
      },

      // ── Fetch profile ────────────────────────────────────────────────────────
      fetchProfile: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const res = await fetch(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            // Merge — server may return isAdmin based on ADMIN_IDS env
            set((state) => ({
              player: { ...state.player, ...data.player },
            }));
          } else {
            // Token expired or invalid
            set({ player: null, token: null });
          }
        } catch (_) {}
      },

      clearError: () => set({ error: null }),
      isAuthenticated: () => !!get().token && !!get().player,
    }),
    {
      name: 'doa-auth',
      partialize: (state) => ({ token: state.token, player: state.player }),
    }
  )
);

export default useAuthStore;
