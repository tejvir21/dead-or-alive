/**
 * routes/beta.js — Beta version access check
 * The BETA frontend calls GET /api/beta/check on load. If access.allowed is
 * false, the beta frontend shows a locked screen instead of the app.
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const GameSettings = require('../models/GameSettings');
const { getPlayerTier, getTierSettings } = require('../utils/playerTier');

router.get('/check', protect, async (req, res) => {
  const settings = await GameSettings.getSingleton();
  const player = req.player;

  if (!settings.betaAccess?.enabled) {
    return res.json({ allowed: true }); // beta gating itself is off — allow everyone
  }

  const plan = player.subscription?.plan;
  const tier = getPlayerTier(player);
  const tierSettings = getTierSettings(settings, tier);

  const allowed =
    player.hasBetaAccess === true ||
    tierSettings.betaAccess === 'auto';

  const canRequest = !allowed && tierSettings.betaAccess === 'request';

  res.json({
    allowed,
    message: allowed ? null : settings.betaAccess.lockedMessage,
    canRequest,
    plan,
  });
});

module.exports = router;
