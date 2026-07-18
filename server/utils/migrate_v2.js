#!/usr/bin/env node
/**
 * migrate_v2.js — Adds new fields for the kick/auto-start/daily-limits/beta features
 * Run this ONCE after deploying the new server code:
 *   node utils/migrate_v2.js
 *
 * Safe to run multiple times (idempotent) — only touches documents missing the fields.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Player = require('../models/Player');
const GameSettings = require('../models/GameSettings');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dead-or-alive');
  console.log('[migrate_v2] Connected to MongoDB');

  // ── Add new Player fields ─────────────────────────────────────────────────
  const playerResult = await Player.updateMany(
    { roomsCreatedAt: { $exists: false } },
    { $set: { roomsCreatedAt: [], roomsJoinedAt: [], hasBetaAccess: false } }
  );
  console.log(`[migrate_v2] Players updated: matched=${playerResult.matchedCount} modified=${playerResult.modifiedCount}`);

  // ── Auto-grant beta access to existing Elite subscribers ─────────────────
  const eliteResult = await Player.updateMany(
    { 'subscription.plan': 'elite', hasBetaAccess: false },
    { $set: { hasBetaAccess: true } }
  );
  console.log(`[migrate_v2] Elite players auto-granted beta access: ${eliteResult.modifiedCount}`);

  // ── Ensure GameSettings singleton has the new nested objects ─────────────
  const settings = await GameSettings.getSingleton();
  console.log('[migrate_v2] GameSettings singleton verified/created');

  console.log('\n✅ Migration v2 complete. Safe to start the server.\n');
  process.exit(0);
}

run().catch(err => {
  console.error('[migrate_v2] Failed:', err);
  process.exit(1);
});
