/**
 * Match Model
 * Records full game history for stats, replays, and leaderboard
 */

const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    matchId: { type: String, required: true, unique: true },
    // ── Participants ──────────────────────────────────────────────────────────
    players: [
      {
        playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
        username: String,
        joinedAt: Date,
        eliminatedInRoom: { type: Number, default: null }, // null = survived
        doorChoices: [
          {
            room: Number,
            chosenDoor: String, // "LIVE" | "DIE"
            correctDoor: String,
            survived: Boolean,
            responseTimeMs: Number,
          },
        ],
        isWinner: { type: Boolean, default: false },
      },
    ],
    // ── Room log ──────────────────────────────────────────────────────────────
    rooms: [
      {
        roomNumber: Number,
        roomId: String,
        clueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clue' },
        clueText: String,       // rendered text at time of match
        correctDoor: String,    // "LIVE" | "DIE" (server-side, never sent early)
        difficulty: Number,
        survivorCount: Number,  // how many survived this room
        eliminatedCount: Number,
      },
    ],
    // ── Match metadata ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['waiting', 'in_progress', 'completed', 'abandoned'],
      default: 'waiting',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    roomCode: { type: String, unique: true },
    maxPlayers: { type: Number, default: 8 },
    minPlayers: { type: Number, default: 1 },
    totalRooms: { type: Number, default: 0 },
    startedAt: Date,
    endedAt: Date,
    winnersCount: { type: Number, default: 0 },
    // ── Spectators (bonus) ────────────────────────────────────────────────────
    spectators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  },
  {
    timestamps: true,
  }
);

matchSchema.index({ status: 1, createdAt: -1 });
matchSchema.index({ roomCode: 1 });

module.exports = mongoose.model('Match', matchSchema);
