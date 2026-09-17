/**
 * routes/push.js — Web Push subscribe/unsubscribe endpoints
 */
const express = require('express');
const router = express.Router();
const PushSubscription = require('../models/PushSubscription');
const { protect } = require('../middleware/auth');

router.get('/vapid-public-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(503).json({ error: 'Push notifications not configured on this server' });
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.post('/subscribe', protect, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Invalid subscription payload' });

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { playerId: req.player._id, endpoint, keys, userAgent: req.headers['user-agent'] || '' },
      { upsert: true, new: true }
    );
    res.status(201).json({ message: 'Subscribed to push notifications' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/unsubscribe', protect, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) await PushSubscription.deleteOne({ endpoint, playerId: req.player._id });
    else await PushSubscription.deleteMany({ playerId: req.player._id }); // no endpoint given = remove all of this player's devices
    res.json({ message: 'Unsubscribed' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/status', protect, async (req, res) => {
  const count = await PushSubscription.countDocuments({ playerId: req.player._id });
  res.json({ subscribed: count > 0, deviceCount: count });
});

module.exports = router;
