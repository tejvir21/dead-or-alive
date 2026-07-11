/**
 * Clue Model — Phase 1
 * Supports difficulty 1-10, 14 categories, progressive hints
 */
const mongoose = require('mongoose');

const variableSchema = new mongoose.Schema(
  {
    name:    { type: String, default: '' },
    type:    { type: String, default: 'number', enum: ['number','letter','choice','word','symbol'] },
    min:     { type: Number, default: 1 },
    max:     { type: Number, default: 10 },
    options: { type: [String], default: [] },
  },
  { _id: false }
);

const clueSchema = new mongoose.Schema(
  {
    clueId:   { type: String, unique: true, required: true },
    category: {
      type: String,
      required: true,
      enum: [
        // Original 7
        'number','word','symbol','environment','logic','pattern','sound',
        // New 7
        'math','binary','cipher','spatial','time','color','riddle',
      ],
    },
    // NOTE: template is NOT a hard-unique DB constraint. Duplicate prevention
    // happens at the application level (see routes/clues.js sanitizeClue +
    // bulk-import dedup logic). A hard unique index here would fail to build
    // if any pre-existing duplicate templates exist in production data from
    // earlier seed runs — run `npm run migrate` to clean those up safely
    // before optionally adding a unique constraint yourself.
    template:   { type: String, required: true },
    answerRule: { type: String, required: true },
    variables:  { type: [variableSchema], default: [] },
    difficulty: { type: Number, min: 1, max: 10, default: 1 },
    flavorText: { type: String, default: '' },
    hints:      { type: [String], default: [] }, // 0-2 hints based on difficulty
    timesUsed:  { type: Number, default: 0 },
    isActive:   { type: Boolean, default: true },
    // Metadata for admin
    tags:       { type: [String], default: [] },
    createdBy:  { type: String, default: 'system' },
  },
  { timestamps: true }
);

clueSchema.index({ category: 1, difficulty: 1, isActive: 1 });
clueSchema.index({ template: 1 }); // non-unique, speeds up duplicate-check queries

module.exports = mongoose.model('Clue', clueSchema);
