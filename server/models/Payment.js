/**
 * Payment.js — Tracks all subscription payment transactions
 * One-time payments (Option A: manual renewal), with receipt generation.
 */
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },

  // ── Razorpay identifiers ─────────────────────────────────────────────────────
  razorpayOrderId:   { type: String, required: true, unique: true },
  razorpayPaymentId: { type: String }, // set after successful payment
  razorpaySignature: { type: String }, // set after verification

  // ── Plan details ─────────────────────────────────────────────────────────────
  plan:         { type: String, enum: ['pro', 'elite'], required: true },
  durationDays: { type: Number, required: true },
  amount:       { type: Number, required: true }, // in paise (smallest unit, e.g. ₹199 = 19900)
  currency:     { type: String, default: 'INR' },

  // ── Status lifecycle ─────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['created', 'paid', 'failed', 'cancelled', 'refunded'],
    default: 'created',
  },

  // ── Receipt ──────────────────────────────────────────────────────────────────
  receiptNumber: { type: String, unique: true, sparse: true }, // e.g. INV-2026-000123
  receiptEmailedAt: { type: Date },

  // ── Cancellation / refund ────────────────────────────────────────────────────
  cancelledAt:    { type: Date },
  cancelledBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'Player' }, // self or admin
  cancelReason:   { type: String },
  razorpayRefundId: { type: String },
  refundedAt:     { type: Date },

  // ── Subscription window this payment activated ──────────────────────────────
  subscriptionStart: { type: Date },
  subscriptionEnd:   { type: Date },

  // ── Reminder tracking (avoid duplicate reminder emails) ──────────────────────
  expiryReminderSentAt: { type: Date },

}, { timestamps: true });

paymentSchema.index({ playerId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ subscriptionEnd: 1, status: 1 }); // for expiry cron queries

// ── Generate a human-readable receipt number ────────────────────────────────────
paymentSchema.statics.generateReceiptNumber = async function () {
  const year = new Date().getFullYear();
  const count = await this.countDocuments({ receiptNumber: { $regex: `^INV-${year}-` } });
  return `INV-${year}-${String(count + 1).padStart(6, '0')}`;
};

module.exports = mongoose.model('Payment', paymentSchema);
