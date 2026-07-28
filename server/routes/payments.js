/**
 * routes/payments.js — Razorpay subscription payments (Option A: one-time, manual renewal)
 * Requires: npm install razorpay pdfkit
 *
 * Flow:
 *   1. Client calls POST /orders → we create a Razorpay order, save a
 *      'created' Payment record, return order details for the client's
 *      checkout modal.
 *   2. User completes payment in Razorpay's checkout UI.
 *   3. Client calls POST /verify with the payment response → we verify the
 *      signature (SECURITY CRITICAL — never trust the client alone),
 *      activate the subscription, generate + email the receipt.
 *   4. Razorpay ALSO calls POST /webhook independently — this is the
 *      reliable source of truth in case the client-side verify call never
 *      happens (browser closed, network drop, etc.). Both paths are
 *      idempotent (checking payment.status first).
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const Player = require('../models/Player');
const GameSettings = require('../models/GameSettings');
const { protect, adminOnly } = require('../middleware/auth');
const notify = require('../utils/notify');
const { generateReceiptPDF } = require('../utils/receiptGenerator');
const logger = require('../utils/logger');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Helper: activate a subscription after successful payment ───────────────────
async function activateSubscription(payment, player) {
  const now = new Date();
  // If player already has an active subscription of the SAME or HIGHER tier,
  // extend from the current expiry rather than from now (don't lose paid time)
  const currentExpiry = player.subscription?.expiresAt;
  const startFrom = (currentExpiry && currentExpiry > now) ? currentExpiry : now;
  const expiresAt = new Date(startFrom.getTime() + payment.durationDays * 24 * 60 * 60 * 1000);

  await Player.findByIdAndUpdate(player._id, {
    'subscription.plan': payment.plan,
    'subscription.status': 'active',
    'subscription.expiresAt': expiresAt,
  });

  payment.subscriptionStart = now;
  payment.subscriptionEnd = expiresAt;
  payment.status = 'paid';
  payment.receiptNumber = await Payment.generateReceiptNumber();
  await payment.save();

  return expiresAt;
}

// ── Helper: generate + email the receipt (fire-and-forget, non-blocking) ────────
async function sendReceiptEmailAsync(payment, player) {
  try {
    const pdfBuffer = await generateReceiptPDF(payment, player);
    const { sendReceiptEmail } = require('../mailer');
    await sendReceiptEmail(player.email, payment, pdfBuffer);
    payment.receiptEmailedAt = new Date();
    await payment.save();
  } catch (err) {
    logger.error('[payments] Receipt email failed:', err.message);
  }
}

// ── POST /orders — create a Razorpay order ──────────────────────────────────────
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

// ── POST /verify — verify signature + activate (client-side confirmation path) ──
router.post('/verify', protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, playerId: req.player._id });
    if (!payment) return res.status(404).json({ error: 'Payment record not found' });

    // Idempotent — webhook may have already processed this
    if (payment.status === 'paid') {
      const player = await Player.findById(req.player._id);
      return res.json({ message: 'Payment already verified', subscription: player.subscription });
    }

    // ── SECURITY CRITICAL: verify the HMAC signature ────────────────────────────
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      payment.status = 'failed';
      await payment.save();
      logger.error(`[payments] Signature mismatch for order ${razorpay_order_id} — possible tampering attempt`);
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;

    const player = await Player.findById(req.player._id);
    const expiresAt = await activateSubscription(payment, player);

    // Email receipt (non-blocking)
    sendReceiptEmailAsync(payment, player).catch(() => { });

    // Notify (in-app + email confirmation)
    notify(req.app.get('io'), player._id, {
      type: 'admin_gifted_subscription', // reuse existing icon/type for "you got a plan"
      title: `🎉 ${payment.plan.toUpperCase()} Activated!`,
      message: `Your ${payment.plan.toUpperCase()} subscription is active until ${expiresAt.toLocaleDateString('en-IN')}.`,
      icon: '🎉',
      meta: { plan: payment.plan, expiresAt, receiptNumber: payment.receiptNumber },
      email: false, // receipt email is the confirmation email here
    }).catch(() => { });

    res.json({
      message: 'Payment verified and subscription activated',
      plan: payment.plan,
      expiresAt,
      receiptNumber: payment.receiptNumber,
    });
  } catch (err) {
    logger.error('[payments] Verification error:', err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// ── POST /webhook — Razorpay server-to-server confirmation (reliable fallback) ──
// NOTE: this route needs the RAW request body for signature verification.
// See PAYMENTS_INTEGRATION.md for the express.raw() middleware setup required
// in index.js for this specific route.
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body) // raw Buffer, see index.js setup
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.error('[webhook] Invalid webhook signature — possible spoofing attempt');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(req.body.toString());
    const eventType = event.event;

    if (eventType === 'payment.captured') {
      const orderId = event.payload.payment.entity.order_id;
      const paymentId = event.payload.payment.entity.id;

      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (payment && payment.status !== 'paid') {
        payment.razorpayPaymentId = paymentId;
        const player = await Player.findById(payment.playerId);
        if (player) {
          const expiresAt = await activateSubscription(payment, player);
          sendReceiptEmailAsync(payment, player).catch(() => { });
          logger.info(`[webhook] Activated ${payment.plan} for ${player.username} via webhook fallback`);
        }
      }
    } else if (eventType === 'payment.failed') {
      const orderId = event.payload.payment.entity.order_id;
      await Payment.findOneAndUpdate({ razorpayOrderId: orderId, status: { $ne: 'paid' } }, { status: 'failed' });
    } else if (eventType === 'refund.processed') {
      const paymentId = event.payload.refund.entity.payment_id;
      await Payment.findOneAndUpdate(
        { razorpayPaymentId: paymentId },
        { status: 'refunded', refundedAt: new Date(), razorpayRefundId: event.payload.refund.entity.id }
      );
    }

    res.json({ received: true });
  } catch (err) {
    logger.error('[webhook] Processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ── GET /history — player's own payment history ─────────────────────────────────
router.get('/history', protect, async (req, res) => {
  const payments = await Payment.find({ playerId: req.player._id, status: { $in: ['paid', 'refunded', 'cancelled'] } })
    .sort({ createdAt: -1 });
  res.json({ payments });
});

// ── GET /receipt/:paymentId — download receipt PDF ───────────────────────────────
router.get('/receipt/:paymentId', protect, async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.paymentId, playerId: req.player._id });
    if (!payment || payment.status !== 'paid') return res.status(404).json({ error: 'Receipt not found' });

    const player = await Player.findById(req.player._id);
    const pdfBuffer = await generateReceiptPDF(payment, player);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${payment.receiptNumber}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('[payments] Receipt download failed:', err);
    res.status(500).json({ error: 'Failed to generate receipt' });
  }
});

// ── POST /cancel — self-serve cancellation ───────────────────────────────────────
router.post('/cancel', protect, async (req, res) => {
  try {
    const player = await Player.findById(req.player._id);
    if (!player.subscription?.plan || player.subscription.plan === 'free') {
      return res.status(400).json({ error: 'No active subscription to cancel' });
    }

    const activePayment = await Payment.findOne({
      playerId: player._id, status: 'paid', subscriptionEnd: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (activePayment) {
      activePayment.status = 'cancelled';
      activePayment.cancelledAt = new Date();
      activePayment.cancelledBy = player._id;
      activePayment.cancelReason = req.body.reason || 'Cancelled by user';
      await activePayment.save();
    }

    await Player.findByIdAndUpdate(player._id, {
      'subscription.plan': 'free', 'subscription.status': 'cancelled', 'subscription.expiresAt': null,
    });

    notify(req.app.get('io'), player._id, {
      type: 'generic', title: 'Subscription Cancelled',
      message: 'Your subscription has been cancelled. You now have free-tier access.',
      icon: '📋',
    }).catch(() => { });

    res.json({ message: 'Subscription cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Cancellation failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /admin/all — all transactions, paginated ──────────────────────────────
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  const { page = 1, limit = 50, status, plan } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (plan) filter.plan = plan;

  const [payments, total] = await Promise.all([
    Payment.find(filter).populate('playerId', 'username email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
    Payment.countDocuments(filter),
  ]);

  const revenueAgg = await Payment.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  res.json({
    payments, total, page: parseInt(page), pages: Math.ceil(total / limit),
    totalRevenue: (revenueAgg[0]?.total || 0) / 100, // paise → rupees
  });
});

// ── POST /admin/:paymentId/cancel — admin cancels a user's subscription ────────
router.post('/admin/:paymentId/cancel', protect, adminOnly, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    payment.status = 'cancelled';
    payment.cancelledAt = new Date();
    payment.cancelledBy = req.player._id;
    payment.cancelReason = req.body.reason || 'Cancelled by admin';
    await payment.save();

    await Player.findByIdAndUpdate(payment.playerId, {
      'subscription.plan': 'free', 'subscription.status': 'cancelled', 'subscription.expiresAt': null,
    });

    const AuditLog = require('../models/AuditLog');
    const player = await Player.findById(payment.playerId);
    await AuditLog.create({ adminId: req.player._id, adminName: req.player.username, action: 'payment.cancel', target: player?.username, details: { paymentId: payment._id, reason: req.body.reason } });

    notify(req.app.get('io'), payment.playerId, {
      type: 'generic', title: 'Subscription Cancelled by Admin',
      message: req.body.reason ? `Your subscription was cancelled: ${req.body.reason}` : 'Your subscription was cancelled by an administrator.',
      icon: '📋', email: true,
    }).catch(() => { });

    res.json({ message: 'Subscription cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Cancellation failed' });
  }
});

// ── POST /admin/:paymentId/refund — trigger a Razorpay refund ──────────────────
router.post('/admin/:paymentId/refund', protect, adminOnly, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment || payment.status !== 'paid') return res.status(400).json({ error: 'Only paid payments can be refunded' });
    if (!payment.razorpayPaymentId) return res.status(400).json({ error: 'No Razorpay payment ID on record' });

    const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: req.body.amount ? Math.round(req.body.amount * 100) : payment.amount, // full refund by default
      notes: { reason: req.body.reason || 'Admin-initiated refund' },
    });

    payment.razorpayRefundId = refund.id;
    payment.status = 'refunded';
    payment.refundedAt = new Date();
    await payment.save();

    await Player.findByIdAndUpdate(payment.playerId, {
      'subscription.plan': 'free', 'subscription.status': 'cancelled', 'subscription.expiresAt': null,
    });

    const AuditLog = require('../models/AuditLog');
    const player = await Player.findById(payment.playerId);
    await AuditLog.create({ adminId: req.player._id, adminName: req.player.username, action: 'payment.refund', target: player?.username, details: { paymentId: payment._id, refundId: refund.id } });

    notify(req.app.get('io'), payment.playerId, {
      type: 'generic', title: 'Refund Processed',
      message: `A refund of Rs. ${(payment.amount / 100).toFixed(2)} has been processed for your ${payment.plan.toUpperCase()} subscription.`,
      icon: '💳', email: true,
    }).catch(() => { });

    res.json({ message: 'Refund processed', refund });
  } catch (err) {
    logger.error('[payments] Refund failed:', err);
    res.status(500).json({ error: 'Refund failed: ' + err.message });
  }
});

module.exports = router;
