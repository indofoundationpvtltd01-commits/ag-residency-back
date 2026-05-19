const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false,
  },
  phone: { type: String, trim: true },
  role: {
    type: String,
    enum: ['customer', 'hotel_admin', 'super_admin'],
    default: 'customer',
  },
  assignedHotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
  isActive: { type: Boolean, default: true },
  passwordResetOTP: { type: String, select: false },
  passwordResetOTPHash: { type: String, select: false },
  passwordResetExpiry: { type: Date, select: false },
  refreshToken: { type: String, select: false },
  createdAt: { type: Date, default: Date.now },
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
