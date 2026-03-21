/**
 * App.jsx — Root component with routing and auth guard
 */
import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import useAuthStore from './store/authStore';
import { connectSocket, disconnectSocket } from './socket/socketClient';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LobbyPage from './pages/LobbyPage';
import WaitingRoomPage from './pages/WaitingRoomPage';
import GamePage from './pages/GamePage';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

import Notification from './components/ui/Notification';
import useGameStore from './store/gameStore';

// ─── Auth Guard ───────────────────────────────────────────────────────────────
function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { token, fetchProfile } = useAuthStore();
  const notification = useGameStore((s) => s.notification);

  // Connect socket when authenticated
  useEffect(() => {
    if (token) {
      connectSocket();
      fetchProfile();
    } else {
      disconnectSocket();
    }
    return () => {};
  }, [token]);

  return (
    <div className="scanlines min-h-screen bg-void-900 font-body">
      {/* Global notification toast */}
      <AnimatePresence>
        {notification && <Notification notification={notification} />}
      </AnimatePresence>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />

        <Route
          path="/lobby"
          element={
            <PrivateRoute>
              <LobbyPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/room/:roomCode"
          element={
            <PrivateRoute>
              <WaitingRoomPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/game/:roomCode"
          element={
            <PrivateRoute>
              <GamePage />
            </PrivateRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <ProfilePage />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <AdminPage />
            </PrivateRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}
