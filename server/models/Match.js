const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    matchId:   { type: String, required: true, unique: true },
    roomCode:  { type: String, unique: true },
    status:    { type: String, enum: ['waiting','in_progress','completed','abandoned'], default: 'waiting' },
    mode:      { type: String, enum: ['solo','co-op','vs-teams'], default: 'solo' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    maxPlayers:{ type: Number, default: 16 },
    minPlayers:{ type: Number, default: 1 },
    isPasswordProtected: { type: Boolean, default: false },
    difficultyCurve:     { type: String, default: 'stepped' },

    players: [{
      playerId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
      username:         String,
      joinedAt:         Date,
      eliminatedInRoom: { type: Number, default: null },
      isWinner:         { type: Boolean, default: false },
      teamId:           String,
      doorChoices: [{
        room:           Number,
        chosenDoor:     String,
        correctDoor:    String,
        survived:       Boolean,
        responseTimeMs: Number,
      }],
    }],

    rooms: [{
      roomNumber:     Number,
      roomId:         String,
      clueId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Clue' },
      clueText:       String,
      correctDoor:    String,
      difficulty:     Number,
      survivorCount:  Number,
      eliminatedCount:Number,
    }],

    totalRooms:   { type: Number, default: 0 },
    winnersCount: { type: Number, default: 0 },
    startedAt:    Date,
    endedAt:      Date,
    spectators:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  },
  { timestamps: true }
);

matchSchema.index({ status: 1, createdAt: -1 });
matchSchema.index({ roomCode: 1 });

module.exports = mongoose.model('Match', matchSchema);
