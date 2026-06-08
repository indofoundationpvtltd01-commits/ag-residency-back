const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  checkIn: { type: Date, required: [true, 'Check-in date is required'] },
  checkOut: { type: Date, required: [true, 'Check-out date is required'] },
  nights: { type: Number, required: true, min: 1 },
  adults: { type: Number, default: 1, min: 1 },
  children: { type: Number, default: 0, min: 0 },
  numberOfGuests: { type: Number, default: 1, min: 1 },
  pricePerNight: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'],
    default: 'pending',
  },
  approvalMode: { type: String, enum: ['manual', 'automatic'], default: 'manual' },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'refunded'],
    default: 'unpaid',
  },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  specialRequests: { type: String },
  guestName: { type: String },
  guestEmail: { type: String },
  guestPhone: { type: String },
  cancelledAt: { type: Date },
  cancelReason: { type: String },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },
  source: { type: String, enum: ['online', 'walk-in'], default: 'online' },
  paymentMethod: { type: String, enum: ['Cash', 'UPI', 'UPI + Cash', 'Online', 'Other', 'Pay at Hotel'], default: 'Online' },
  cashAmount: { type: Number, default: 0 },
  upiAmount: { type: Number, default: 0 },
  residentProof: {
    url: String,
    publicId: String,
    documentType: {
      type: String,
      enum: ['aadhaar', 'passport', 'driving_license', 'voter_id']
    },
    verified: {
      type: Boolean,
      default: false
    },
    uploadedAt: Date
  },
  taxRate: { type: Number, default: 0.12 },
  createdAt: { type: Date, default: Date.now },
});

bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ hotel: 1, status: 1 });
bookingSchema.index({ hotel: 1, checkIn: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
