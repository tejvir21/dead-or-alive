#!/usr/bin/env node
/**
 * verify-push-delivery.js — Isolates exactly where push delivery is
 * breaking: no subscription saved at all, vs. subscription exists but
 * the actual send fails.
 *
 * Auto-detects server root like the other verify-*.js scripts — works
 * from anywhere in the project.
 *
 * Usage:
 *   node verify-push-delivery.js                 — lists ALL subscriptions in the DB
 *   node verify-push-delivery.js <username>       — checks + test-sends to one player
 */
const fs = require('fs');
const path = require('path');

function findServerRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'models'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const ROOT = findServerRoot(__dirname);
console.log('\n🔍 Push Delivery Diagnostic\n' + '='.repeat(50));
if (!ROOT) { console.log(`\n❌ Could not detect server root from ${__dirname}\n`); process.exit(1); }
console.log(`\nDetected server root: ${ROOT}\n`);

require('dotenv').config({ path: path.join(ROOT, '.env') });
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dead-or-alive');

  const PushSubscription = require(path.join(ROOT, 'models', 'PushSubscription.js'));
  const Player = require(path.join(ROOT, 'models', 'Player.js'));
  const { sendPushToPlayer } = require(path.join(ROOT, 'utils', 'webPush.js'));

  const totalSubs = await PushSubscription.countDocuments({});
  console.log(`1. Total push subscriptions in the database: ${totalSubs}`);

  if (totalSubs === 0) {
    console.log(`
❌ CONFIRMED: nobody has actually subscribed yet — this collection is
   completely empty. This isn't a delivery bug, it's that no browser has
   successfully completed the opt-in flow and saved a subscription.

   Before testing broadcast further: go to Profile → the Push
   Notifications card (or the new banner on Lobby) → click Enable →
   actually grant the browser's permission popup when it appears. Then
   re-run this script — it should show 1+ subscriptions.

   If you already clicked Enable and it seemed to work but this still
   shows 0, open your browser's DevTools → Application tab → Service
   Workers, and confirm sw.js shows as "activated and running" — if it's
   not registered, /push/subscribe never actually got called.
`);
    process.exit(0);
  }

  const allSubs = await PushSubscription.find({}).populate('playerId', 'username');
  console.log('\n   Subscribed players:');
  allSubs.forEach(s => console.log(`   - ${s.playerId?.username || '(deleted player)'} — endpoint ending in ...${s.endpoint.slice(-20)}`));

  const targetUsername = process.argv[2];
  if (!targetUsername) {
    console.log('\n   Run again with a username to test-send directly:');
    console.log('   node verify-push-delivery.js someusername\n');
    process.exit(0);
  }

  const player = await Player.findOne({ username: targetUsername });
  if (!player) { console.log(`\n❌ No player found with username "${targetUsername}"\n`); process.exit(1); }

  const playerSubs = await PushSubscription.countDocuments({ playerId: player._id });
  console.log(`\n2. Subscriptions for "${targetUsername}": ${playerSubs}`);
  if (playerSubs === 0) {
    console.log(`\n❌ This specific player has never subscribed. Same fix as above — they need to click Enable and grant permission.\n`);
    process.exit(0);
  }

  console.log(`\n3. Sending a real test push to "${targetUsername}" directly via sendPushToPlayer()`);
  console.log('   (bypasses the broadcast route entirely — isolates whether the');
  console.log('   core send function works, separate from anything broadcast-specific)\n');

  await sendPushToPlayer(player._id, {
    title: '🔔 Direct Test Push',
    body: 'If you see this, sendPushToPlayer() works correctly.',
    tag: 'diagnostic-test',
  });

  console.log('   Call completed without throwing. Check your browser NOW —');
  console.log('   a real notification should have appeared.');
  console.log('\n   If nothing appeared despite no error here, check your server');
  console.log('   terminal output (or the Error Logs admin tab) for a');
  console.log('   "[webPush] Send failed" entry — that would show the exact reason');
  console.log('   the push service rejected the send (expired subscription, VAPID');
  console.log('   key mismatch, etc.) even though the function itself didn\'t throw.\n');

  process.exit(0);
}

main().catch(err => {
  console.error('\n💥 Diagnostic crashed:', err.message);
  process.exit(1);
});
