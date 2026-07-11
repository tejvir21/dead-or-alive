#!/usr/bin/env node
/**
 * seedClues.js — Phase 1
 * Loads the 2,870 mega clue set into MongoDB.
 * Run: npm run seed
 *
 * Behavior:
 *   --fresh   wipes all existing clues first (default)
 *   --append  keeps existing clues, only adds new ones (skips duplicates by template)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Clue = require('../models/Clue');
const { assembleAll } = require('./generateMegaClues');

async function seed() {
  const mode = process.argv.includes('--append') ? 'append' : 'fresh';

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dead-or-alive');
    console.log('✅ MongoDB connected');

    const { clues } = assembleAll();
    console.log(`\n📦 Generated ${clues.length} unique clues in memory`);

    if (mode === 'fresh') {
      const before = await Clue.countDocuments();
      await Clue.deleteMany({});
      console.log(`🗑️  Cleared ${before} existing clues (fresh mode)`);

      await Clue.insertMany(clues, { ordered: false });
      console.log(`✅ Inserted ${clues.length} clues\n`);
    } else {
      // Append mode: skip duplicates by template
      const templates = clues.map(c => c.template);
      const existing = await Clue.find({ template: { $in: templates } }).select('template');
      const existingSet = new Set(existing.map(c => c.template));

      const toInsert = clues.filter(c => !existingSet.has(c.template));
      const skipped = clues.length - toInsert.length;

      if (toInsert.length > 0) {
        await Clue.insertMany(toInsert, { ordered: false });
      }
      console.log(`✅ Inserted ${toInsert.length} new clues, skipped ${skipped} duplicates (append mode)\n`);
    }

    // Final summary
    const total = await Clue.countDocuments();
    const byCategory = await Clue.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    console.log('📊 Database summary:');
    byCategory.forEach(c => console.log(`   ${c._id.padEnd(14)} ${c.count}`));
    console.log(`   ${'TOTAL'.padEnd(14)} ${total}\n`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();
