/**
 * authStore.js — Fixed
 *
 * ROOT CAUSE OF RELOAD LOGOUT:
 * Zustand persist reads localStorage asynchronously. On page reload the
 * store starts with initial state (player: null, accessToken: null).
 * If a route guard checks these immediately it sees null and redirects
 * to /login BEFORE localStorage is actually read.
 *
 * FIX: _hasHydrated flag — false until onRehydrateStorage fires.
 * Route guards must wait for this before redirecting to /login.
 *
 * BACKWARD COMPAT: stores both `token` (old) and `accessToken` (new)
 * pointing to the same value, so all existing components work.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { msUntilExpiry } from '../utils/jwt';

const API = import.meta.env.VITE_API_URL || '/api';

let refreshTimer = null;
let _refreshPromise = null;

function clearRefreshTimer() {
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
}

function scheduleProactiveRefresh(accessToken, refreshFn) {
  clearRefreshTimer();
  if (!accessToken) return;
  const remaining = msUntilExpiry(accessToken);
  const delay = remaining === null ? 2000 : Math.max(2000, remaining - 60000);
  refreshTimer = setTimeout(() => { refreshFn().catch(() => {}); }, delay);
}

const useAuthStore = create(
  persist(
    (set, get) => ({
      // THE KEY FIX — route guards must check this before redirecting
      _hasHydrated: false,
      setHasHydrated: (val) => set({ _hasHydrated: val }),

      player:       null,
      accessToken:  null,
      token:        null,   // backward compat alias — always === accessToken
      refreshToken: null,
      isLoading:    false,
      error:        null,
      sessionMessage: null,

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, token: accessToken, refreshToken });
        scheduleProactiveRefresh(accessToken, () => get().refreshAccessToken());
      },

      register: async (fields) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Registration failed');
          set({ player: data.player, isLoading: false, sessionMessage: null });
          get().setTokens(data.accessToken || data.token, data.refreshToken);
          return { success: true };
        } catch (err) {
          set({ error: err.message, isLoading: false });
          return { success: false, error: err.message };
        }
      },

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
          set({ player: data.player, isLoading: false, sessionMessage: null });
          get().setTokens(data.accessToken || data.token, data.refreshToken);
          return { success: true };
        } catch (err) {
          set({ error: err.message, isLoading: false });
          return { success: false, error: err.message };
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) { get().forceLogout(); throw new Error('No refresh token'); }
        if (_refreshPromise) return _refreshPromise;
        _refreshPromise = (async () => {
          try {
            const res = await fetch(`${API}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Refresh failed');
            get().setTokens(data.accessToken, data.refreshToken);
            return data.accessToken;
          } catch (err) {
            get().forceLogout('Your session has expired. Please sign in again.');
            throw err;
          } finally {
            _refreshPromise = null;
          }
        })();
        return _refreshPromise;
      },

      logout: async () => {
        const { accessToken, refreshToken } = get();
        clearRefreshTimer();
        try {
          await fetch(`${API}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({ refreshToken }),
          });
        } catch (_) {}
        set({ player: null, accessToken: null, token: null, refreshToken: null, error: null, sessionMessage: null });
      },

      forceLogout: (message = null) => {
        clearRefreshTimer();
        set({ player: null, accessToken: null, token: null, refreshToken: null, error: null, sessionMessage: message });
      },

      fetchProfile: async () => {
        const { accessToken } = get();
        if (!accessToken) return;
        try {
          let res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (res.status === 401) {
            const body = await res.json().catch(() => ({}));
            if (body.code === 'TOKEN_EXPIRED') {
              const fresh = await get().refreshAccessToken();
              res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${fresh}` } });
            }
          }
          if (res.ok) {
            const data = await res.json();
            set(s => ({ player: { ...s.player, ...data.player } }));
          }
        } catch (_) {}
      },

      resumeSession: () => {
        const { accessToken } = get();
        if (accessToken) scheduleProactiveRefresh(accessToken, () => get().refreshAccessToken());
      },

      clearError: () => set({ error: null }),
      clearSessionMessage: () => set({ sessionMessage: null }),
      isAuthenticated: () => !!(get().accessToken && get().player),
    }),
    {
      name: 'doa-auth',
      partialize: (s) => ({
        accessToken:  s.accessToken,
        token:        s.accessToken,  // save under old key for backward compat
        refreshToken: s.refreshToken,
        player:       s.player,
        // _hasHydrated intentionally NOT persisted
      }),
      onRehydrateStorage: () => (state, error) => {
        // NOTE: Do NOT reference `useAuthStore` here — it hasn't been assigned
        // yet when this callback fires (temporal dead zone). Use the `state`
        // parameter that Zustand passes in directly instead.
        if (error) {
          console.error('[authStore] rehydration error:', error);
        }
        if (state) {
          // Migrate old `token` field → `accessToken` for users already logged in
          if (state.token && !state.accessToken) {
            state.accessToken = state.token;
          }
          // Restart proactive refresh timer using the store's own method via state
          if (state.accessToken) {
            scheduleProactiveRefresh(state.accessToken, () =>
              state.refreshAccessToken()   // ← state, not useAuthStore.getState()
            );
          }
          // Signal hydration complete — route guards can now safely check tokens
          state.setHasHydrated(true);      // ← state, not useAuthStore.getState()
        }
      },
    }
  )
);

export default useAuthStore;
