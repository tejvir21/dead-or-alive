/**
 * App.jsx — Updated
 * Added: <Notification /> rendered globally so toasts appear on every page
 * Added: /profile route
 */
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import useAuthStore from "./store/authStore";
import ProtectedRoute from "./components/ProtectedRoute";
import Notification from "./components/ui/Notification";

// Pages
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LobbyPage from "./pages/LobbyPage";
import WaitingRoomPage from "./pages/WaitingRoomPage";
import GamePage from "./pages/GamePage";
import LeaderboardPage from "./pages/LeaderboardPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import NotFoundPage from "./pages/NotFoundPage";
import BetaGate from "./components/BetaGate";
import PricingPage from "./pages/PricingPage";

import useNotificationStore from "./store/notificationStore";

export default function App() {
  const {
    accessToken,
    fetchProfile,
    resumeSession,
    sessionMessage,
    clearSessionMessage,
  } = useAuthStore();

  // Restart proactive token refresh timer after page reload
  useEffect(() => {
    if (accessToken) {
      resumeSession();
      fetchProfile();
      useNotificationStore.getState().fetchUnreadCount();
    }
  }, [accessToken]);

  // Show session-expired message (forceLogout was called)
  // Replace alert() with your own modal/toast if preferred
  useEffect(() => {
    if (sessionMessage) {
      alert(sessionMessage);
      clearSessionMessage();
    }
  }, [sessionMessage]);

  return (
    <BetaGate>
      <BrowserRouter>
        {/* Toast notifications — visible on every page */}
        <Notification />

        <Routes>
          {/* ── Public ─────────────────────────────────────────────────────── */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />

          {/* ── Protected ──────────────────────────────────────────────────── */}
          <Route
            path="/lobby"
            element={
              <ProtectedRoute>
                <LobbyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/waiting/:roomCode"
            element={
              <ProtectedRoute>
                <WaitingRoomPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/game/:roomCode"
            element={
              <ProtectedRoute>
                <GamePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/pricing" element={<PricingPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* ── 404 ────────────────────────────────────────────────────────── */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </BetaGate>
  );
}
