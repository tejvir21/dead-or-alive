/**
 * PLAYER_MODEL_ADDITIONS.md
 * =========================
 * Add these fields to your EXISTING models/Player.js schema.
 * Do NOT replace the whole file — just merge these fields in.
 * All fields are safe defaults, fully backward-compatible with existing data.
 */

/* ── Add to the main schema object in models/Player.js ── */

/*
  // ── Daily room limit tracking (rolling 24h window) ──────────────────────────
  roomsCreatedAt: [{ type: Date }],   // timestamps of rooms created, pruned to last 24h
  roomsJoinedAt:  [{ type: Date }],   // timestamps of rooms joined, pruned to last 24h

  // ── Beta access ───────────────────────────────────────────────────────────
  hasBetaAccess:  { type: Boolean, default: false },
*/

/**
 * Full example of where to add these — inside `new mongoose.Schema({ ... })`:
 *
 * const playerSchema = new mongoose.Schema({
 *   username: { ... },
 *   email: { ... },
 *   // ... all your existing fields ...
 *
 *   // ADD THESE:
 *   roomsCreatedAt: [{ type: Date }],
 *   roomsJoinedAt:  [{ type: Date }],
 *   hasBetaAccess:  { type: Boolean, default: false },
 *
 * }, { timestamps: true });
 */

/**
 * MIGRATION for existing players (run once via utils/migrate.js or manually):
 *
 * db.players.updateMany(
 *   { roomsCreatedAt: { $exists: false } },
 *   { $set: { roomsCreatedAt: [], roomsJoinedAt: [], hasBetaAccess: false } }
 * )
 *
 * Or in Node:
 *   await Player.updateMany(
 *     { roomsCreatedAt: { $exists: false } },
 *     { $set: { roomsCreatedAt: [], roomsJoinedAt: [], hasBetaAccess: false } }
 *   );
 */
