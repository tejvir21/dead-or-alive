/**
 * Clue Model
 * Stores clue templates with variables for dynamic generation
 */

const mongoose = require('mongoose');

// ── Explicit subdocument schema for variables ─────────────────────────────────
// Using a named schema prevents Mongoose casting the array as [String]
const variableSchema = new mongoose.Schema(
  {
    name:    { type: String, default: '' },   // placeholder name, e.g. "X"
    type:    { type: String, default: 'number', enum: ['number', 'letter', 'choice', 'word', 'symbol'] },
    min:     { type: Number, default: 1 },
    max:     { type: Number, default: 10 },
    options: { type: [String], default: [] }, // for choice/word types
  },
  { _id: false } // no separate _id per variable
);

const clueSchema = new mongoose.Schema(
  {
    clueId: {
      type: String,
      unique: true,
      required: true,
    },
    // ── Category ─────────────────────────────────────────────────────────────
    category: {
      type: String,
      enum: ['number', 'word', 'symbol', 'environment', 'logic', 'pattern', 'sound'],
      required: true,
    },
    // ── Template with {variable} placeholders ────────────────────────────────
    template: {
      type: String,
      required: true,
    },
    // ── Answer rule describes how to evaluate correctness ────────────────────
    answerRule: {
      type: String,
      required: true,
    },
    // ── Variable definitions ─────────────────────────────────────────────────
    variables: {
      type: [variableSchema],
      default: [],
    },
    // ── Difficulty ───────────────────────────────────────────────────────────
    difficulty: {
      type: Number,
      min: 1,
      max: 5,
      default: 1,
    },
    // ── Flavor text ──────────────────────────────────────────────────────────
    flavorText: {
      type: String,
      default: '',
    },
    // ── Progressive hints ────────────────────────────────────────────────────
    hints: {
      type: [String],
      default: [],
    },
    // ── Usage tracking ────────────────────────────────────────────────────────
    timesUsed: { type: Number, default: 0 },
    isActive:  { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Index for efficient category + difficulty queries
clueSchema.index({ category: 1, difficulty: 1, isActive: 1 });

module.exports = mongoose.model('Clue', clueSchema);
