/**
 * apiClient.js — fetch wrapper with automatic token refresh + retry
 *
 * Usage:
 *   import { apiFetch, apiJSON } from '../api/apiClient';
 *   const data = await apiJSON('/game/lobbies');          // GET
 *   const data = await apiJSON('/clues', { method:'POST', body: JSON.stringify(clue) });
 */
import useAuthStore from '../store/authStore';

const API = import.meta.env.VITE_API_URL || '/api';

function authHeaders() {
  const { accessToken } = useAuthStore.getState();
  return accessToken
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }
    : { 'Content-Type': 'application/json' };
}

export async function apiFetch(pathOrUrl, options = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API}${pathOrUrl}`;

  let res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });

  // ── Token expired → refresh once → retry ──────────────────────────────────
  if (res.status === 401) {
    let body = {};
    try { body = await res.clone().json(); } catch (_) {}

    if (body.code === 'TOKEN_EXPIRED') {
      try {
        await useAuthStore.getState().refreshAccessToken();
        // Retry with the new token (authHeaders() now returns the fresh one)
        res = await fetch(url, {
          ...options,
          headers: { ...authHeaders(), ...(options.headers || {}) },
        });
      } catch (refreshErr) {
        // refreshAccessToken already called forceLogout — just rethrow
        throw refreshErr;
      }
    } else if (/banned/i.test(body.error || '')) {
      useAuthStore.getState().forceLogout(body.error);
    }
  }

  return res;
}

/** apiFetch + automatic JSON parse + error throw */
export async function apiJSON(pathOrUrl, options = {}) {
  const res = await apiFetch(pathOrUrl, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
