/**
 * BetaGate.jsx — Updated with working "Buy Subscription" on the locked screen
 * ONLY used in the BETA deployment's App.jsx — wraps the whole app.
 *
 * New: the locked screen now has REAL purchase buttons (not just plan
 * descriptions). Buying Pro or Elite directly here re-checks access
 * immediately after payment and unlocks without navigating away.
 *
 * Usage in the BETA App.jsx:
 *   import BetaGate from './components/BetaGate';
 *   export default function App() {
 *     return (
 *       <BetaGate>
 *         <BrowserRouter> ... your normal routes ... </BrowserRouter>
 *       </BetaGate>
 *     );
 *   }
 */
import React, { useState, useEffect } from "react";
import useAuthStore from "../store/authStore";
import { apiJSON } from "../api/apiClient";
import { purchaseSubscription } from "../utils/razorpayCheckout";

export default function BetaGate({ children }) {
  const { accessToken, player, fetchProfile } = useAuthStore();
  const [status, setStatus] = useState("checking"); // checking | allowed | denied
  const [message, setMessage] = useState("");
  const [canRequest, setCanRequest] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null); // plan name currently purchasing
  const [purchaseMsg, setPurchaseMsg] = useState(null); // { type, text }

  useEffect(() => {
    if (!accessToken) {
      setStatus("checking");
      return;
    }
    check();
    loadPlans();
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
      setMessage("Unable to verify beta access. Please try again later.");
    }
  };

  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const data = await apiJSON("/settings");
      setPlans(data.settings?.subscriptionPlans || []);
    } catch (_) {
    } finally {
      setPlansLoading(false);
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

  // ── Buy a subscription directly from the locked screen ──────────────────────
  const handleBuy = async (planName) => {
    setPurchasing(planName);
    setPurchaseMsg(null);

    const result = await purchaseSubscription(planName, player);

    if (result.success) {
      setPurchaseMsg({
        type: "success",
        text: `🎉 ${planName.toUpperCase()} activated! Checking beta access…`,
      });
      await fetchProfile();
      // Re-check beta access immediately — Elite unlocks automatically,
      // Pro will still need to request (handled by the canRequest branch below)
      await check();
    } else if (!result.cancelled) {
      setPurchaseMsg({
        type: "error",
        text: result.error || "Payment failed. Please try again.",
      });
    }
    setPurchasing(null);
  };

  const currentPlan = player?.subscription?.plan || "free";

  if (!accessToken) return children; // let normal login flow render

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (import.meta.env.VITE_BETA_VERSION === "false") return children; // skip gate in BETA

  if (status === "allowed") return children;

  // ── Denied — locked screen with working purchase buttons ────────────────────
  const PLAN_COLORS = {
    pro: {
      border: "border-purple-700",
      bg: "bg-purple-950/20",
      text: "text-purple-400",
      btn: "bg-purple-700 hover:bg-purple-600",
    },
    elite: {
      border: "border-yellow-600",
      bg: "bg-yellow-950/20",
      text: "text-yellow-400",
      btn: "bg-yellow-600 hover:bg-yellow-500",
    },
  };
  const PLAN_ICONS = { pro: "✨", elite: "⭐" };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6 overflow-x-hidden">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="text-6xl">🔒</div>
        <h1 className="font-display text-2xl font-bold text-purple-400">
          Beta Access Restricted
        </h1>
        <p className="font-mono text-sm text-gray-500 break-words">{message}</p>

        {purchaseMsg && (
          <div
            className={`font-mono text-xs px-3 py-2 rounded break-words ${purchaseMsg.type === "success" ? "text-green-400 bg-green-950/30 border border-green-800" : "text-red-400 bg-red-950/30 border border-red-800"}`}
          >
            {purchaseMsg.text}
          </div>
        )}

        <div className="space-y-3 text-left">
          <p className="font-mono text-xs text-gray-500 uppercase tracking-wider text-center">
            Subscribe to unlock
          </p>

          {plansLoading ? (
            <p className="font-mono text-xs text-gray-700 text-center py-4">
              Loading plans…
            </p>
          ) : (
            // Defensive filter: only ever show real, correctly-configured
            // paid plans. Guards against stray/malformed entries in the
            // database (e.g. a "free" plan or one missing its price) ever
            // reaching the UI — see PAYMENTS_ORDERS_FIX.md for the root fix.
            plans
              .filter(
                (plan) =>
                  ["pro", "elite"].includes(plan.name) &&
                  typeof plan.price === "number" &&
                  plan.price > 0 &&
                  typeof plan.durationDays === "number" &&
                  plan.durationDays > 0,
              )
              .map((plan) => {
                const colors = PLAN_COLORS[plan.name] || PLAN_COLORS.pro;
                const isCurrent = currentPlan === plan.name;
                return (
                  <div
                    key={plan.name}
                    className={`border rounded-lg p-4 ${colors.border} ${colors.bg} space-y-3`}
                  >
                    <div className="flex items-center justify-between">
                      <p
                        className={`font-mono text-sm font-bold ${colors.text}`}
                      >
                        {PLAN_ICONS[plan.name]} {plan.label}
                      </p>
                      <p className="font-display text-lg font-bold text-white">
                        ₹{plan.price}
                        <span className="font-mono text-xs text-gray-500 font-normal">
                          /{plan.durationDays}d
                        </span>
                      </p>
                    </div>
                    <p className="font-mono text-[11px] text-gray-500 break-words">
                      {plan.name === "elite"
                        ? "Includes automatic beta access."
                        : "Extended limits + can request beta access after purchase."}
                    </p>
                    <button
                      onClick={() => handleBuy(plan.name)}
                      disabled={purchasing === plan.name || isCurrent}
                      className={`w-full font-mono text-xs py-2.5 rounded text-white transition-colors disabled:opacity-50 ${colors.btn}`}
                    >
                      {isCurrent
                        ? "✓ CURRENT PLAN"
                        : purchasing === plan.name
                          ? "PROCESSING…"
                          : `BUY ${plan.label.toUpperCase()}`}
                    </button>
                  </div>
                );
              })
          )}
          {!plansLoading &&
            plans.filter(
              (p) => ["pro", "elite"].includes(p.name) && p.price > 0,
            ).length === 0 && (
              <p className="font-mono text-xs text-red-500 text-center py-4 break-words">
                ⚠ No plans are currently available for purchase. Please contact
                support.
              </p>
            )}
        </div>

        {/* Request beta access — only shown if eligible (e.g. already Pro) */}
        {canRequest &&
          (requested ? (
            <p className="font-mono text-xs text-green-400 bg-green-950/30 border border-green-800 rounded p-3 break-words">
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
