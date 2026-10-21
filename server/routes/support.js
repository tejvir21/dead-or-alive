/**
 * routes/support.js — player support ticket submission + admin management
 *
 * Mount at /api/support:
 *   app.use('/api/support', require('./routes/support'));
 */
const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const SupportTicket = require('../models/SupportTicket');
const notify = require('../utils/notify');
const { notifyAdmins } = require('../utils/notify');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER-FACING
// ─────────────────────────────────────────────────────────────────────────────

router.post('/', protect, async (req, res) => {
  try {
    const { category, subject, message } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }
    const validCategories = ['bug', 'billing', 'account', 'gameplay', 'other'];
    const finalCategory = validCategories.includes(category) ? category : 'other';

    const ticket = await SupportTicket.create({
      playerId: req.player._id,
      username: req.player.username,
      email: req.player.email,
      category: finalCategory,
      subject: subject.trim(),
      message: message.trim(),
    });

    // Notify admins a new ticket came in — reuses the existing admin
    // activity feed, no new notification infrastructure needed
    const io = req.app.get('io');
    notifyAdmins(io, {
      title: '🎫 New Support Ticket',
      message: `${req.player.username}: ${subject.trim()}`,
      icon: '🎫',
      meta: { ticketId: ticket._id, category: finalCategory },
    }).catch(() => {});

    res.status(201).json({ message: 'Support ticket submitted', ticket });
  } catch (err) {
    logger.error('[support] Create failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to submit support ticket' });
  }
});

router.get('/mine', protect, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ playerId: req.player._id }).sort({ createdAt: -1 });
    res.json({ tickets });
  } catch (err) {
    logger.error('[support/mine] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to load your tickets' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────

router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const { status, category, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      SupportTicket.countDocuments(filter),
    ]);
    res.json({ tickets, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error('[support/admin/all] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to load tickets' });
  }
});

router.get('/admin/:id', protect, adminOnly, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id).populate('respondedBy', 'username');
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ ticket });
  } catch (err) {
    logger.error('[support/admin/:id] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to load ticket' });
  }
});

router.patch('/admin/:id/respond', protect, adminOnly, async (req, res) => {
  try {
    const { response, status } = req.body;
    if (!response?.trim()) return res.status(400).json({ error: 'A response message is required' });

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    const finalStatus = validStatuses.includes(status) ? status : 'resolved';

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      {
        adminResponse: response.trim(), respondedBy: req.player._id,
        respondedAt: new Date(), status: finalStatus,
      },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const io = req.app.get('io');
    notify(io, ticket.playerId, {
      type: 'generic',
      title: '💬 Support Team Responded',
      message: `Re: ${ticket.subject} — ${response.trim().slice(0, 100)}${response.length > 100 ? '…' : ''}`,
      icon: '💬',
      meta: { ticketId: ticket._id },
      email: true, // support responses are important enough to email
    }).catch(() => {});

    res.json({ message: 'Response sent', ticket });
  } catch (err) {
    logger.error('[support/admin/:id/respond] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to send response' });
  }
});

router.patch('/admin/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ ticket });
  } catch (err) {
    logger.error('[support/admin/:id/status] Failed:', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;
