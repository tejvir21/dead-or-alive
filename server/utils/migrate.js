#!/usr/bin/env node
/**
 * migrate.js — Phase 1 Backward-Compatibility Migration
 *
 * Safely upgrades an EXISTING production database (created by the earlier
 * version of this game) to work with the new Phase 1 schema additions.
 *
 * This script is SAFE to run multiple times (idempotent) and NEVER deletes
 * data — it only adds missing fields with sensible defaults and resolves
 * duplicate clue templates that could conflict with future unique-index use.
 *
 * Run this ONCE before starting the new server against an existing DB:
 *   npm run migrate
 *
 * What it does:
 *   1. Players  — adds all new fields (subscription, verification, security,
 *                 clan, preferences) with safe defaults if missing
 *   2. Clues    — resolves duplicate templates (keeps oldest, deactivates
 *                 newer dupes rather than deleting them), clamps difficulty
 *                 into the new 1-10 range (old 1-5 data is already valid,
 *                 this is a no-op safety net)
 *   3. Matches  — adds mode/isPasswordProtected/difficultyCurve defaults
 *   4. Settings — initializes the GameSettings singleton if it doesn't exist
 *   5. Indexes  — rebuilds indexes safely now that data is clean
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Player = require('../models/Player');
const Clue = require('../models/Clue');
const Match = require('../models/Match');
const GameSettings = require('../models/GameSettings');

const log = (...args) => console.log('[migrate]', ...args);

async function migratePlayers() {
  log('── Migrating Players ──────────────────────────────────────');

  const total = await Player.countDocuments();
  log(`Found ${total} player(s)`);
  if (total === 0) return { matched: 0, modified: 0 };

  // Only touch documents missing the new fields — never overwrites existing data
  const result = await Player.updateMany(
    { 'subscription.plan': { $exists: false } },
    {
      $set: {
        'subscription.plan': 'free',
        'subscription.status': 'inactive',
        isEmailVerified: false,
        isPhoneVerified: false,
        isVerified: false,
        isBanned: false,
        loginAttempts: 0,
        refreshTokens: [],
        clanRole: 'member',
        'preferences.theme': 'default',
        'preferences.difficulty': 'any',
        'preferences.notifications': true,
        pushTokens: [],
      },
    }
  );

  // displayName: backfill from username where missing (separate pass since
  // it needs per-document username, $set above can't reference other fields)
  const noDisplayName = await Player.find({ displayName: { $in: [null, ''] } }).select('_id username');
  if (noDisplayName.length > 0) {
    const bulkOps = noDisplayName.map(p => ({
      updateOne: { filter: { _id: p._id }, update: { $set: { displayName: p.username } } },
    }));
    await Player.bulkWrite(bulkOps);
    log(`Backfilled displayName for ${noDisplayName.length} player(s)`);
  }

  log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}`);
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

async function migrateClues() {
  log('── Migrating Clues ────────────────────────────────────────');

  const total = await Clue.countDocuments();
  log(`Found ${total} clue(s)`);
  if (total === 0) return { duplicatesResolved: 0, difficultyClamped: 0, hintsAdded: 0 };

  // ── 1. Resolve duplicate templates ──────────────────────────────────────────
  // Find all duplicate template groups, keep the OLDEST (lowest _id / earliest
  // createdAt) active, deactivate the rest (never delete — preserves history
  // and any match records that reference these clueIds)
  const duplicateGroups = await Clue.aggregate([
    { $group: { _id: '$template', ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  let duplicatesResolved = 0;
  for (const group of duplicateGroups) {
    // Sort by _id ascending (oldest first since ObjectIds are time-ordered)
    const sortedIds = group.ids.sort((a, b) => a.toString().localeCompare(b.toString()));
    const [keep, ...rest] = sortedIds;
    if (rest.length > 0) {
      await Clue.updateMany(
        { _id: { $in: rest } },
        { $set: { isActive: false }, $addToSet: { tags: 'auto-deactivated-duplicate' } }
      );
      duplicatesResolved += rest.length;
    }
  }
  if (duplicatesResolved > 0) {
    log(`⚠️  Found ${duplicateGroups.length} duplicate template group(s) — deactivated ${duplicatesResolved} newer duplicate(s) (kept oldest of each, none deleted)`);
  } else {
    log('No duplicate templates found ✅');
  }

  // ── 2. Clamp difficulty into 1-10 range (old 1-5 data is already valid) ────
  const clampResult = await Clue.updateMany(
    { $or: [{ difficulty: { $lt: 1 } }, { difficulty: { $gt: 10 } }, { difficulty: { $exists: false } }] },
    { $set: { difficulty: 1 } } // shouldn't realistically happen, but safe fallback
  );
  if (clampResult.modifiedCount > 0) {
    log(`Clamped difficulty for ${clampResult.modifiedCount} out-of-range clue(s)`);
  }

  // ── 3. Ensure hints field exists (old clues may predate this field) ────────
  const hintsResult = await Clue.updateMany(
    { hints: { $exists: false } },
    { $set: { hints: [] } }
  );
  if (hintsResult.modifiedCount > 0) {
    log(`Added empty hints[] to ${hintsResult.modifiedCount} clue(s) that predate the hint system`);
  }

  // ── 4. Ensure tags/createdBy exist ──────────────────────────────────────────
  await Clue.updateMany({ tags: { $exists: false } }, { $set: { tags: [] } });
  await Clue.updateMany({ createdBy: { $exists: false } }, { $set: { createdBy: 'system' } });

  return { duplicatesResolved, difficultyClamped: clampResult.modifiedCount, hintsAdded: hintsResult.modifiedCount };
}

async function migrateMatches() {
  log('── Migrating Matches ──────────────────────────────────────');

  const total = await Match.countDocuments();
  log(`Found ${total} match(es)`);
  if (total === 0) return { modified: 0 };

  const result = await Match.updateMany(
    { mode: { $exists: false } },
    {
      $set: {
        mode: 'solo',
        isPasswordProtected: false,
        difficultyCurve: 'stepped',
      },
    }
  );

  log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}`);
  return { modified: result.modifiedCount };
}

async function migrateSettings() {
  log('── Initializing GameSettings ──────────────────────────────');
  const existing = await GameSettings.findOne({ _singleton: true });
  if (existing) {
    log('GameSettings already exists ✅ (no changes made)');
    return { created: false };
  }
  await GameSettings.getSingleton();
  log('Created GameSettings singleton with default values');
  return { created: true };
}

async function rebuildIndexes() {
  log('── Rebuilding indexes ──────────────────────────────────────');
  try {
    await Clue.syncIndexes();
    await Player.syncIndexes();
    await Match.syncIndexes();
    log('Indexes synced successfully ✅');
  } catch (err) {
    log('⚠️  Index sync warning (non-fatal):', err.message);
  }
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dead-or-alive');
    log('✅ Connected to MongoDB\n');

    const playerResult = await migratePlayers();
    console.log('');
    const clueResult = await migrateClues();
    console.log('');
    const matchResult = await migrateMatches();
    console.log('');
    const settingsResult = await migrateSettings();
    console.log('');
    await rebuildIndexes();

    console.log('\n' + '═'.repeat(60));
    console.log('  MIGRATION COMPLETE — SUMMARY');
    console.log('═'.repeat(60));
    console.log(`  Players updated:          ${playerResult.modified}`);
    console.log(`  Clue duplicates resolved: ${clueResult.duplicatesResolved}`);
    console.log(`  Clue hints backfilled:    ${clueResult.hintsAdded}`);
    console.log(`  Matches updated:          ${matchResult.modified}`);
    console.log(`  Settings initialized:     ${settingsResult.created ? 'yes (new)' : 'already existed'}`);
    console.log('═'.repeat(60));
    console.log('\n✅ Database is now compatible with Phase 1. Safe to start the server.\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    console.error('\nYour data has NOT been modified beyond what succeeded above.');
    console.error('Safe to re-run this script after fixing the issue — it is idempotent.\n');
    process.exit(1);
  }
}

run();
