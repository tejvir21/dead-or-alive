const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const Player = require('../models/Player');
const Match = require('../models/Match');
const Clue = require('../models/Clue');

const ClanBattle = require('../models/ClanBattle');
const ClanChallenge = require('../models/ClanChallenge');
const Clan = require('../models/Clan');
const { finalizeExpiredBattles } = require('../utils/clanBattleExpiry');

router.get('/stats', protect, adminOnly, async (req, res) => {
  const [players, matches, clues] = await Promise.all([
    Player.countDocuments(),
    Match.countDocuments(),
    Clue.countDocuments({ isActive: true }),
  ]);
  res.json({ players, matches, clues });
});

router.get('/matches', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 30, status, mode, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (mode) filter.mode = mode;
    if (search) filter.roomCode = new RegExp(search, 'i');

    const [matches, total] = await Promise.all([
      Match.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select('roomCode status mode players totalRooms createdAt endedAt winnersCount difficultyCurve isClanBattleRun'),
      Match.countDocuments(filter),
    ]);

    res.json({ matches, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load matches' });
  }
});

router.get('/matches/:id', protect, adminOnly, async (req, res) => {
  const match = await Match.findById(req.params.id).populate('players.playerId', 'username displayName');
  if (!match) return res.status(404).json({ error: 'Match not found' });
  res.json({ match });
});

// Cleanup tool: force-abandon a match stuck in 'in_progress' (e.g. from a
// crashed server that never reached endGame — the in-memory session is
// gone but the DB record is stuck)
router.patch('/matches/:id/abandon', protect, adminOnly, async (req, res) => {
  try {
    const match = await Match.findByIdAndUpdate(req.params.id, { status: 'abandoned' }, { new: true });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json({ match });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/matches/:id', protect, adminOnly, async (req, res) => {
  try {
    await Match.findByIdAndDelete(req.params.id);
    res.json({ message: 'Match deleted' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/clan-battles', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 30, status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;

    let clanIdFilter = null;
    if (search) {
      const matchingClans = await Clan.find({ $or: [{ name: new RegExp(search, 'i') }, { tag: new RegExp(search, 'i') }] }).select('_id');
      clanIdFilter = matchingClans.map(c => c._id);
      filter.$or = [{ clanAId: { $in: clanIdFilter } }, { clanBId: { $in: clanIdFilter } }];
    }

    const [battles, total] = await Promise.all([
      ClanBattle.find(filter)
        .populate('clanAId', 'name tag').populate('clanBId', 'name tag')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit))
        .select('-roomSequence'), // never expose answers, even to admin listing
      ClanBattle.countDocuments(filter),
    ]);

    res.json({ battles, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: 'Failed to load clan battles' }); }
});

router.get('/clan-battles/:id', protect, adminOnly, async (req, res) => {
  const battle = await ClanBattle.findById(req.params.id)
    .populate('clanAId', 'name tag').populate('clanBId', 'name tag')
    .populate('runs.playerId', 'username')
    .select('-roomSequence');
  if (!battle) return res.status(404).json({ error: 'Battle not found' });
  res.json({ battle });
});

// Manual override: force-finalize a specific battle right now, regardless
// of whether its window has actually expired — for stuck/disputed cases
router.post('/clan-battles/:id/force-finalize', protect, adminOnly, async (req, res) => {
  try {
    const battle = await ClanBattle.findById(req.params.id);
    if (!battle) return res.status(404).json({ error: 'Battle not found' });
    if (battle.status !== 'active') return res.status(400).json({ error: 'Battle is not active' });

    battle.expiresAt = new Date(0); // force it into the "expired" query the cron logic uses
    await battle.save();
    const io = req.app.get('io');
    await finalizeExpiredBattles(io); // reuses the exact same finalize logic as the cron — no duplicated logic, no risk of divergent behavior

    const updated = await ClanBattle.findById(req.params.id).populate('clanAId', 'name tag').populate('clanBId', 'name tag').select('-roomSequence');
    res.json({ battle: updated });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Global view of pending challenges (not tied to any one clan) — useful
// for spotting ones that are about to expire or look stuck
router.get('/clan-challenges', protect, adminOnly, async (req, res) => {
  const { status = 'pending' } = req.query;
  const challenges = await ClanChallenge.find({ status })
    .populate('challengerClanId', 'name tag').populate('targetClanId', 'name tag')
    .sort({ createdAt: -1 }).limit(50);
  res.json({ challenges });
});

module.exports = router;
