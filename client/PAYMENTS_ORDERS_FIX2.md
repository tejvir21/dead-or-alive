# Fix #2 for routes/payments.js — POST /orders

Two bugs found from your latest error log:

## Bug 1: `receipt` field exceeded Razorpay's 40-character limit (the actual failure)

```
order_${Date.now()}_${req.player._id}
= "order_" (6) + 13-digit timestamp + "_" (1) + 24-char ObjectId
= 44 characters — Razorpay rejects anything over 40
```

## Bug 2: garbled log output (cosmetic, but fixed while we're in there)

`logger.error('...', description)` where `description` is a plain string
gets spread character-by-character by your logger (`...someString` turns
a string into `{0:'a', 1:'b', ...}`). Wrapping it in an object
(`{ description }`) fixes this everywhere, not just here.

---

## Replace the `/orders` route in `server/routes/payments.js` with this:

```js
router.post('/orders', protect, async (req, res) => {
  try {
    const { plan } = req.body; // 'pro' | 'elite'
    if (!['pro', 'elite'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });

    const settings = await GameSettings.getSingleton();
    const planConfig = settings.subscriptionPlans.find(p => p.name === plan);

    if (!planConfig) {
      return res.status(404).json({ error: `Plan "${plan}" not found in settings` });
    }
    if (!planConfig.price || typeof planConfig.price !== 'number' || planConfig.price <= 0) {
      logger.error(`[payments] Plan "${plan}" has an invalid price:`, { price: planConfig.price });
      return res.status(500).json({
        error: `The ${plan.toUpperCase()} plan is not configured correctly (missing price). Contact an admin.`,
      });
    }
    if (!planConfig.durationDays || planConfig.durationDays <= 0) {
      logger.error(`[payments] Plan "${plan}" has an invalid durationDays:`, { durationDays: planConfig.durationDays });
      return res.status(500).json({
        error: `The ${plan.toUpperCase()} plan is not configured correctly (missing duration). Contact an admin.`,
      });
    }

    const amountPaise = Math.round(planConfig.price * 100);

    // ── FIX: receipt must be ≤ 40 chars. Use a short player-ID suffix
    // instead of the full 24-char ObjectId. Still unique enough — Date.now()
    // (ms precision) + last 8 chars of the player's ID practically never
    // collides, and Razorpay only needs this to be unique per your account,
    // not globally.
    const shortPlayerId = req.player._id.toString().slice(-8);
    const receipt = `rcpt_${Date.now()}_${shortPlayerId}`; // 5 + 13 + 1 + 8 = 27 chars — safe

    let order;
    try {
      order = await razorpay.orders.create({
        amount: amountPaise,
        currency: planConfig.currency || 'INR',
        receipt,
        notes: { playerId: req.player._id.toString(), plan },
      });
    } catch (razorpayErr) {
      // ── FIX: wrap in an object so the logger never spreads a raw string
      const description = razorpayErr?.error?.description || razorpayErr.message;
      logger.error('[payments] Razorpay order creation rejected:', { description });

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
    // ── FIX: same wrapping here in case err is ever a string
    logger.error('[payments] Order creation failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});
```

## Optional: audit the rest of your logger.error() calls

If you see more garbled `{"0":"x","1":"y",...}` logs elsewhere, the same
pattern applies — anywhere you have `logger.error('msg', someString)`,
change it to `logger.error('msg', { detail: someString })`. This is a
logger-implementation quirk (likely Winston spreading a non-object second
argument), so it'll show up wherever a raw string gets passed as the
second arg, not just in payments.js.
