/**
 * BetaGate.jsx
 * ONLY use this in the BETA deployment's App.jsx — wraps your whole app.
 * Checks /api/beta/check on load. If not allowed, shows a locked screen
 * with subscription options instead of the app.
 *
 * Usage in the BETA App.jsx:
 *   import BetaGate from './components/BetaGate';
 *   ...
 *   export default function App() {
 *     return (
 *       <BetaGate>
 *         <BrowserRouter> ... your normal routes ... </BrowserRouter>
 *       </BetaGate>
 *     );
 *   }
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { apiJSON } from "../api/apiClient";

export default function BetaGate({ children }) {
  const { accessToken, player } = useAuthStore();
  const [status, setStatus] = useState("checking"); // checking | allowed | denied
  const [message, setMessage] = useState("");
  const [canRequest, setCanRequest] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setStatus("checking");
      return;
    } // wait for login
    check();
  }, [accessToken]);

  const check = async () => {
    try {
      const data = await apiJSON("/beta/check");
      if (data.allowed) {
        setStatus("allowed");
      } else {
        setStatus("denied");
        setMessage(data.message);
        setCanRequest(data.canRequest);
      }
    } catch (_) {
      setStatus("denied");
      console.log("Checkpoint 6");

      setMessage("Unable to verify beta access. Please try again later.");
    }
  };

  const submitRequest = async () => {
    setRequesting(true);
    try {
      await apiJSON("/settings/beta-requests", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setRequested(true);
    } catch (_) {
    } finally {
      setRequesting(false);
    }
  };

  // Not logged in yet — let the normal login flow render (children handles routing to /login)
  if (!accessToken) return children;

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "allowed") return children;

  // ── Denied — locked screen ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="text-6xl">🔒</div>
        <h1 className="font-display text-2xl font-bold text-purple-400">
          Beta Access Restricted
        </h1>
        <p className="font-mono text-sm text-gray-500">{message}</p>

        <div className="glass-card p-5 space-y-4 text-left">
          <p className="font-mono text-xs text-gray-500 uppercase tracking-wider">
            Subscribe to unlock
          </p>
          <div className="border border-purple-800/50 rounded-lg p-4">
            <p className="font-mono text-sm text-purple-400 font-bold">
              ✨ PRO
            </p>
            <p className="font-mono text-xs text-gray-600 mt-1">
              Extended limits, verified badge, can request beta access
            </p>
          </div>
          <div className="border border-yellow-700/50 rounded-lg p-4">
            <p className="font-mono text-sm text-yellow-400 font-bold">
              ⭐ ELITE
            </p>
            <p className="font-mono text-xs text-gray-600 mt-1">
              Unlimited rooms, automatic beta access, priority support
            </p>
          </div>
        </div>

        {canRequest &&
          (requested ? (
            <p className="font-mono text-xs text-green-400 bg-green-950/30 border border-green-800 rounded p-3">
              ✅ Request submitted — an admin will review it soon.
            </p>
          ) : (
            <button
              onClick={submitRequest}
              disabled={requesting}
              className="btn-primary w-full disabled:opacity-50"
            >
              {requesting ? "SUBMITTING…" : "REQUEST BETA ACCESS"}
            </button>
          ))}

        <a
          href={import.meta.env.VITE_MAIN_APP_URL || "/"}
          className="block font-mono text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          ← Go to the main version instead
        </a>
      </div>
    </div>
  );
}
