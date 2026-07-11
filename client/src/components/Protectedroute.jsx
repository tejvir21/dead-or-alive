/**
 * ProtectedRoute.jsx
 *
 * MUST use _hasHydrated before redirecting to /login.
 * Without this check, every page reload logs the user out because
 * Zustand hasn't finished reading localStorage yet when this renders.
 *
 * Flow:
 *   1. Page loads → _hasHydrated = false → show spinner (don't redirect)
 *   2. Zustand reads localStorage → _hasHydrated = true
 *   3a. Tokens found → render children (stay on page)
 *   3b. No tokens → redirect to /login
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function ProtectedRoute({ children }) {
  const _hasHydrated = useAuthStore(s => s._hasHydrated);
  const accessToken  = useAuthStore(s => s.accessToken);
  const player       = useAuthStore(s => s.player);

  // Step 1: wait — don't redirect yet, localStorage hasn't been read
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-mono text-xs text-gray-600">Loading…</p>
        </div>
      </div>
    );
  }

  // Step 2: hydration done — now safe to check auth
  if (!accessToken || !player) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
