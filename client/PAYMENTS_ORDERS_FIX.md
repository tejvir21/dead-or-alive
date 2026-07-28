# Fix for routes/payments.js — POST /orders

Replace the existing `router.post('/orders', ...)` handler in
`server/routes/payments.js` with this version. It adds:

1. **Defensive validation** — rejects any plan with a missing/invalid
   price BEFORE calling Razorpay, with a clear error instead of a
   confusing downstream failure.
2. **Clearer Razorpay auth error surfacing** — if Razorpay itself
   rejects the request (e.g. "Authentication failed"), the server now
   logs the exact reason and returns a message that points at the
   actual cause instead of a generic "Failed to create payment order".

```js
router.post('/orders', protect, async (req, res) => {
  try {
    const { plan } = req.body; // 'pro' | 'elite'
    if (!['pro', 'elite'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });

    const settings = await GameSettings.getSingleton();
    const planConfig = settings.subscriptionPlans.find(p => p.name === plan);

    // ── NEW: validate the plan config before ever calling Razorpay ──────────────
    if (!planConfig) {
      return res.status(404).json({ error: `Plan "${plan}" not found in settings` });
    }
    if (!planConfig.price || typeof planConfig.price !== 'number' || planConfig.price <= 0) {
      logger.error(`[payments] Plan "${plan}" has an invalid price:`, planConfig.price);
      return res.status(500).json({
        error: `The ${plan.toUpperCase()} plan is not configured correctly (missing price). Contact an admin.`,
      });
    }
    if (!planConfig.durationDays || planConfig.durationDays <= 0) {
      logger.error(`[payments] Plan "${plan}" has an invalid durationDays:`, planConfig.durationDays);
      return res.status(500).json({
        error: `The ${plan.toUpperCase()} plan is not configured correctly (missing duration). Contact an admin.`,
      });
    }

    const amountPaise = Math.round(planConfig.price * 100);

    let order;
    try {
      order = await razorpay.orders.create({
        amount: amountPaise,
        currency: planConfig.currency || 'INR',
        receipt: `order_${Date.now()}_${req.player._id}`,
        notes: { playerId: req.player._id.toString(), plan },
      });
    } catch (razorpayErr) {
      // ── NEW: surface Razorpay's actual rejection reason ────────────────────────
      const description = razorpayErr?.error?.description || razorpayErr.message;
      logger.error('[payments] Razorpay order creation rejected:', description);

      if (razorpayErr?.statusCode === 401 || /authentication/i.test(description || '')) {
        return res.status(500).json({
          error: 'Payment gateway is not configured correctly (invalid API credentials). Contact an admin.',
        });
      }
      return res.status(500).json({ error: 'Payment gateway rejected the request: ' + description });
    }

    await Payment.create({
      playerId: req.player._id,
      razorpayOrderId: order.id,
      plan,
      durationDays: planConfig.durationDays,
      amount: amountPaise,
      currency: order.currency,
      status: 'created',
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan,
      planLabel: planConfig.label,
    });
  } catch (err) {
    logger.error('[payments] Order creation failed:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});
```

## Also — check what's actually in your database

Run this once (e.g. via `mongosh` or a quick Node script) to see the real
state of your subscription plans:

```js
db.gamesettings.findOne({ _singleton: true }, { subscriptionPlans: 1 })
```

If you see a `free` entry in there, or `pro`/`elite` without a `price`
field, that confirms the settings document was created **before** the
`subscriptionPlans` schema field existed — `GameSettings.getSingleton()`
only populates the defaults (Pro ₹199 / Elite ₹499) when creating a
**brand new** document; it never backfills missing fields on an existing
one.

### Fix: run this once to repair it

```js
// utils/fixSubscriptionPlans.js
require('dotenv').config();
const mongoose = require('mongoose');
const GameSettings = require('../models/GameSettings');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const settings = await GameSettings.getSingleton();

  settings.subscriptionPlans = [
    { name: 'pro',   label: 'Pro',   price: 199, currency: 'INR', durationDays: 30,
      features: ['Extended daily limits', 'Verified badge', 'Beta access (on request)'] },
    { name: 'elite', label: 'Elite', price: 499, currency: 'INR', durationDays: 30,
      features: ['Unlimited rooms', 'Auto beta access', 'Priority support', 'Nightmare curves'] },
  ];
  await settings.save();

  console.log('✅ subscriptionPlans repaired:', settings.subscriptionPlans);
  process.exit(0);
})();
```

Run with `node utils/fixSubscriptionPlans.js`. This overwrites
`subscriptionPlans` with clean Pro/Elite entries (no stray `free` plan,
real prices) — safe to run even if the array is already correct.
