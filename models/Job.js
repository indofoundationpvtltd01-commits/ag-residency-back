const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['email', 'sms'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  recipient: {
    type: String,
    required: true
  },
  subject: {
    type: String // Optional for SMS
  },
  templateName: {
    type: String
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  errorLogs: [{
    attempt: Number,
    error: String,
    runAt: Date
  }],
  scheduledFor: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

// Compound index to optimize finding next pending job
jobSchema.index({ status: 1, scheduledFor: 1 });

module.exports = mongoose.model('Job', jobSchema);
