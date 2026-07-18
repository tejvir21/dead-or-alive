/**
 * routes/notifications.js — Notification center API
 */
const express = require('express');
const router  = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

// ── List notifications (paginated) ────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 30, unreadOnly } = req.query;
    const filter = { playerId: req.player._id };
    if (unreadOnly === '1') filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ playerId: req.player._id, isRead: false }),
    ]);

    res.json({ notifications, total, unreadCount, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Unread count only (lightweight, for polling) ──────────────────────────────
router.get('/unread-count', protect, async (req, res) => {
  const unreadCount = await Notification.countDocuments({ playerId: req.player._id, isRead: false });
  res.json({ unreadCount });
});

// ── Mark one as read ───────────────────────────────────────────────────────────
router.patch('/:id/read', protect, async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, playerId: req.player._id },
    { isRead: true },
    { new: true }
  );
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  res.json({ notification: n });
});

// ── Mark all as read ───────────────────────────────────────────────────────────
router.patch('/read-all', protect, async (req, res) => {
  await Notification.updateMany({ playerId: req.player._id, isRead: false }, { isRead: true });
  res.json({ message: 'All marked as read' });
});

// ── Delete one ─────────────────────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, playerId: req.player._id });
  res.json({ message: 'Deleted' });
});

// ── Clear all read notifications ──────────────────────────────────────────────
router.delete('/', protect, async (req, res) => {
  await Notification.deleteMany({ playerId: req.player._id, isRead: true });
  res.json({ message: 'Cleared read notifications' });
});

module.exports = router;
