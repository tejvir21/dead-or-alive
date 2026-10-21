#!/usr/bin/env node
/**
 * migrate-to-unified-tiers.js — Run ONCE after deploying the updated
 * models/GameSettings.js AND socketHandlers.js.
 *
 * Since GameSettings.tiers is now a Mongoose Map keyed by tier name
 * (not fixed free/verified/pro/elite fields), this populates it from
 * whatever your Subscription Plans currently are, plus the special
 * 'free' and 'verified' tiers — using sensible defaults for any brand
 * new plans (like "Premium") that don't have prior settings to inherit
 * from.
 *
 * Auto-detects your server root like the other verify-*.js scripts.
 * Run with: node migrate-to-unified-tiers.js
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
console.log('\n🔄 Migrating to Dynamic Tiers\n' + '='.repeat(50));
if (!ROOT) { console.log(`\n❌ Could not detect server root from ${__dirname}\n`); process.exit(1); }
console.log(`\nDetected server root: ${ROOT}\n`);

require('dotenv').config({ path: path.join(ROOT, '.env') });
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dead-or-alive');
  const GameSettings = require(path.join(ROOT, 'models', 'GameSettings.js'));

  const settings = await GameSettings.getSingleton();

  console.log('Current subscription plans:', settings.subscriptionPlans.map(p => p.name).join(', ') || '(none)');
  console.log('Current tiers already set:', [...settings.tiers.keys()].join(', ') || '(none)');
  console.log();

  // 'free' and 'verified' are always special — seed them if missing,
  // never remove them
  if (!settings.tiers.has('free')) {
    settings.tiers.set('free', {
      dailyCreate: 3, dailyJoin: 10, autoStartMin: 180, autoStartMax: 180,
      maxPlayers: 16, canCreateClan: false, ownedClansLimit: 0,
      betaAccess: 'none', unlockedCurves: ['gentle', 'balanced', 'stepped', 'ascending_fast'],
    });
    console.log('✅ Seeded free tier (was missing)');
  }
  if (!settings.tiers.has('verified')) {
    settings.tiers.set('verified', {
      dailyCreate: 8, dailyJoin: 25, autoStartMin: 60, autoStartMax: 300,
      maxPlayers: 32, canCreateClan: false, ownedClansLimit: 0,
      betaAccess: 'none', unlockedCurves: ['gentle', 'balanced', 'stepped', 'ascending_fast', 'spike', 'nightmare', 'expert', 'random'],
    });
    console.log('✅ Seeded verified tier (was missing)');
  }

  // Every subscription plan gets a tier entry — clone from an existing
  // paid tier if one exists (prefers 'pro', falls back to 'elite', falls
  // back to sensible hardcoded defaults if this is a completely fresh setup)
  const cloneSource = settings.tiers.get('pro') || settings.tiers.get('elite') || {
    dailyCreate: 20, dailyJoin: 60, autoStartMin: 30, autoStartMax: 600,
    maxPlayers: 32, canCreateClan: true, ownedClansLimit: 1,
    betaAccess: 'request', unlockedCurves: ['gentle', 'balanced', 'stepped', 'ascending_fast', 'spike', 'nightmare', 'expert', 'random'],
  };

  let addedCount = 0;
  for (const plan of settings.subscriptionPlans) {
    if (!settings.tiers.has(plan.name)) {
      settings.tiers.set(plan.name, { ...cloneSource });
      console.log(`✅ Created tier settings for plan "${plan.name}" (cloned from an existing paid tier)`);
      addedCount++;
    }
  }

  if (addedCount === 0 && settings.tiers.has('free') && settings.tiers.has('verified')) {
    console.log('Nothing to migrate — all plans already have tier settings.');
  }

  await settings.save();

  console.log('\n✅ Migration complete. Final tiers:\n');
  for (const [name, tier] of settings.tiers.entries()) {
    console.log(`  ${name}:`, JSON.stringify(tier.toObject ? tier.toObject() : tier));
  }
  console.log('\nGo to Tier Settings in the admin panel to review/adjust — especially any');
  console.log('newly-cloned plans, which currently have IDENTICAL settings to whatever');
  console.log('they were cloned from and likely need customizing.\n');

  process.exit(0);
}

main().catch(err => {
  console.error('\n💥 Migration crashed:', err.message);
  process.exit(1);
});
