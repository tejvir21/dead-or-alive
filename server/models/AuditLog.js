const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    adminId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    adminName:  String,
    action:     { type: String, required: true },
    target:     String,     // e.g. "player:64abc123" or "clue:64def456"
    details:    mongoose.Schema.Types.Mixed,
    ip:         String,
    userAgent:  String,
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ adminId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
