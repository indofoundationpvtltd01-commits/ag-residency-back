const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Payment
  razorpayKeyId: { type: String, default: '' },
  razorpaySecret: { type: String, default: '' },
  currency: { type: String, default: 'INR' },
  taxRate: { type: Number, default: 18 },
  allowedPaymentMethod: { type: String, enum: ['online', 'hotel', 'both'], default: 'both' },

  // SMTP & Email
  smtpHost: { type: String, default: '' },
  smtpPort: { type: String, default: '587' },
  smtpUser: { type: String, default: '' },
  smtpPass: { type: String, default: '' },
  fromEmail: { type: String, default: '' },
  fromName: { type: String, default: 'AG Residency' },

  // Security
  maxLoginAttempts: { type: Number, default: 5 },
  sessionTimeout: { type: Number, default: 60 }, // minutes
  maintenanceMode: { type: Boolean, default: false },

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
