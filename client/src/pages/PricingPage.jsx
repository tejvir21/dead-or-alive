/**
 * PricingPage.jsx — Dual-purpose: public pricing page + logged-in checkout
 *
 * FIX: the plan-rendering filter was hardcoded to `['pro', 'elite'].includes(plan.name)`
 * — same bug class as everywhere else this session (GameSettings schema,
 * Tier Settings tabs, PATCH /tiers route). Any plan beyond those two exact
 * names — like "premium" — was silently excluded from ever rendering here,
 * even though it existed correctly in subscriptionPlans and showed fine in
 * the admin panel. Removed the name check entirely; the price/durationDays
 * validity checks already correctly filter out malformed/incomplete plans
 * without needing to know specific names in advance.
 *
 * Also added fallback icon + a distinct fallback color scheme for any plan
 * name not explicitly listed, so a new plan looks intentional instead of
 * blank or visually identical to Pro.
 *
 * - Not logged in: shows pricing cards, "Sign up to subscribe" → /register
 * - Logged in: shows pricing cards with real "Subscribe" buttons that open
 *   the Razorpay checkout modal directly
 *
 * Route: /pricing (public, add to your router alongside HomePage/LoginPage)
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';
import { apiJSON } from '../api/apiClient';
import { purchaseSubscription } from '../utils/razorpayCheckout';

export default function PricingPage() {
  const navigate = useNavigate();
  const { player, accessToken, fetchProfile } = useAuthStore();
  const isLoggedIn = !!(player && accessToken);

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null); // plan name currently purchasing
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }

  useEffect(() => {
    (async () => {
      try {
        const data = await apiJSON('/settings');
        setPlans(data.settings?.subscriptionPlans || []);
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  const currentPlan = player?.subscription?.plan || 'free';
  const currentExpiry = player?.subscription?.expiresAt;

  const handleSubscribe = async (planName) => {
    if (!isLoggedIn) { navigate('/register'); return; }
    setPurchasing(planName);
    setMessage(null);

    const result = await purchaseSubscription(planName, player);

    if (result.success) {
      setMessage({ type: 'success', text: `🎉 ${planName.toUpperCase()} activated! Receipt sent to your email.` });
      await fetchProfile();
    } else if (!result.cancelled) {
      setMessage({ type: 'error', text: result.error || 'Payment failed. Please try again.' });
    }
    setPurchasing(null);
  };

  const PLAN_ICONS = { pro: '✨', elite: '⭐' };
  const DEFAULT_ICON = '🎯';
  const PLAN_COLORS = {
    pro:   { border: 'border-purple-700', bg: 'bg-purple-950/20', text: 'text-purple-400', btn: 'bg-purple-700 hover:bg-purple-600' },
    elite: { border: 'border-yellow-600', bg: 'bg-yellow-950/20', text: 'text-yellow-400', btn: 'bg-yellow-600 hover:bg-yellow-500' },
  };
  // FIX: a distinct fallback instead of silently reusing Pro's exact
  // styling — a plan you've never explicitly styled should still look
  // like its own thing, not a Pro clone
  const DEFAULT_COLORS = { border: 'border-cyan-700', bg: 'bg-cyan-950/20', text: 'text-cyan-400', btn: 'bg-cyan-700 hover:bg-cyan-600' };

  // "Best value" badge — highlights whichever plan costs the most, a
  // reasonable default heuristic since a badge tied to a specific plan
  // NAME (the old behavior: always 'elite') breaks the moment a
  // higher-tier plan is added. See my message for the alternative
  // (an explicit admin-chosen "highlighted" field) if you'd rather pick
  // this by hand instead of by price.
  const purchasablePlans = plans.filter(plan =>
    typeof plan.price === 'number' && plan.price > 0 &&
    typeof plan.durationDays === 'number' && plan.durationDays > 0
  );
  const highestPricedPlanName = purchasablePlans.reduce(
    (best, p) => (p.price > (best?.price ?? -1) ? p : best), null
  )?.name;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Header */}
        <div className="text-center space-y-3">
          <button onClick={() => navigate(isLoggedIn ? '/lobby' : '/')}
            className="font-mono text-xs text-gray-700 hover:text-green-400 transition-colors">
            {isLoggedIn ? '← LOBBY' : '← HOME'}
          </button>
          <h1 className="font-display text-4xl font-bold text-green-400 tracking-wider uppercase">
            Choose Your Plan
          </h1>
          <p className="font-mono text-sm text-gray-500">
            Unlock higher room limits, exclusive difficulty curves, and priority support.
          </p>
        </div>

        {/* Current plan banner */}
        {isLoggedIn && currentPlan !== 'free' && (
          <div className="glass-card p-4 text-center border border-green-800">
            <p className="font-mono text-sm text-green-400">
              You're currently on <span className="font-bold uppercase">{currentPlan}</span>
              {currentExpiry && <> · expires {new Date(currentExpiry).toLocaleDateString('en-IN')}</>}
            </p>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`glass-card p-4 text-center font-mono text-sm ${message.type === 'success' ? 'text-green-400 border border-green-800' : 'text-red-400 border border-red-800'}`}>
            {message.text}
          </div>
        )}

        {/* Pricing cards */}
        {loading ? (
          <p className="font-mono text-xs text-gray-700 text-center py-12">Loading plans…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Free tier reference card */}
            <div className="glass-card p-6 space-y-4 border border-gray-800">
              <div>
                <p className="font-mono text-xs text-gray-500 uppercase tracking-widest">Free</p>
                <p className="font-display text-3xl font-bold text-white mt-1">₹0</p>
              </div>
              <ul className="space-y-2 font-mono text-xs text-gray-500">
                <li>✓ 3 rooms created/day</li>
                <li>✓ 10 rooms joined/day</li>
                <li>✓ Standard difficulty curves</li>
                <li>✓ 16 max players per room</li>
              </ul>
              {currentPlan === 'free' && (
                <p className="font-mono text-xs text-gray-600 text-center pt-2 border-t border-gray-800">Current plan</p>
              )}
            </div>

            {purchasablePlans.map(plan => {
              const colors = PLAN_COLORS[plan.name] || DEFAULT_COLORS;
              const icon = PLAN_ICONS[plan.name] || DEFAULT_ICON;
              const isCurrent = currentPlan === plan.name;
              const isBestValue = plan.name === highestPricedPlanName;
              return (
                <motion.div key={plan.name}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`glass-card p-6 space-y-4 border ${colors.border} ${colors.bg} relative`}>
                  {isBestValue && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] bg-yellow-600 text-black px-3 py-1 rounded-full font-bold">
                      BEST VALUE
                    </span>
                  )}
                  <div>
                    <p className={`font-mono text-xs uppercase tracking-widest ${colors.text}`}>
                      {icon} {plan.label}
                    </p>
                    <p className="font-display text-3xl font-bold text-white mt-1">
                      ₹{plan.price}
                      <span className="font-mono text-sm text-gray-500 font-normal"> / {plan.durationDays} days</span>
                    </p>
                  </div>
                  <ul className="space-y-2 font-mono text-xs text-gray-400">
                    {(plan.features || []).map((f, i) => <li key={i}>✓ {f}</li>)}
                  </ul>
                  <button
                    onClick={() => handleSubscribe(plan.name)}
                    disabled={purchasing === plan.name || isCurrent}
                    className={`w-full font-mono text-sm py-3 rounded-lg text-white transition-colors disabled:opacity-50 ${colors.btn}`}>
                    {isCurrent ? '✓ CURRENT PLAN'
                      : purchasing === plan.name ? 'PROCESSING…'
                      : isLoggedIn ? `SUBSCRIBE — ₹${plan.price}`
                      : 'SIGN UP TO SUBSCRIBE'}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        <p className="font-mono text-[10px] text-gray-700 text-center">
          Payments processed securely via Razorpay. One-time payment, manual renewal — no auto-billing.
          {isLoggedIn && ' You can cancel anytime from your profile.'}
        </p>

      </div>
    </div>
  );
}
