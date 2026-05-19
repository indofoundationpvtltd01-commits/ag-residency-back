const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  to: { type: String, required: true },
  subject: { type: String, required: true },
  template: { type: String },
  status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
  error: { type: String },
  sentAt: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed },
});

module.exports = mongoose.model('EmailLog', emailLogSchema);
