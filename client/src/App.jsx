/**
 * App.jsx — Updated routing with hydration-safe ProtectedRoute
 *
 * Key change: all protected routes now go through <ProtectedRoute> which
 * waits for _hasHydrated=true before checking tokens. Without this,
 * every page reload logs the user out because Zustand hasn't finished
 * reading localStorage when the first render happens.
 */
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import HomePage       from './pages/HomePage';
import LoginPage      from './pages/LoginPage';
import RegisterPage   from './pages/RegisterPage';
import LobbyPage      from './pages/LobbyPage';
import GamePage       from './pages/GamePage';
import WaitingRoomPage from './pages/WaitingRoomPage';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminPage      from './pages/AdminPage';
import ProfilePage    from './pages/ProfilePage';
import NotFoundPage   from './pages/NotFoundPage';

// Notification component (if you have one)
// import Notification from './components/ui/Notification';

export default function App() {
  const { accessToken, fetchProfile, resumeSession, sessionMessage, clearSessionMessage } = useAuthStore();

  // On mount: restart the proactive-refresh timer and sync the profile
  useEffect(() => {
    if (accessToken) {
      resumeSession();
      fetchProfile();
    }
  }, [accessToken]);

  // Show session-expired message if forceLogout was called
  useEffect(() => {
    if (sessionMessage) {
      alert(sessionMessage); // replace with your toast/notification component
      clearSessionMessage();
    }
  }, [sessionMessage]);

  return (
    <BrowserRouter>
      {/* <Notification /> */}
      <Routes>

        {/* ── Public routes ──────────────────────────────────────────────── */}
        <Route path="/"            element={<HomePage />} />
        <Route path="/login"       element={<LoginPage />} />
        <Route path="/register"    element={<RegisterPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />

        {/* ── Protected routes — require auth, hydration-safe ────────────── */}
        <Route path="/lobby" element={
          <ProtectedRoute><LobbyPage /></ProtectedRoute>
        } />

        <Route path="/game/:roomCode" element={
          <ProtectedRoute><GamePage /></ProtectedRoute>
        } />

        <Route path="/waiting/:roomCode" element={
          <ProtectedRoute><WaitingRoomPage /></ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute><ProfilePage /></ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute><AdminPage /></ProtectedRoute>
        } />

        {/* ── Fallback ───────────────────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />

      </Routes>
    </BrowserRouter>
  );
}
