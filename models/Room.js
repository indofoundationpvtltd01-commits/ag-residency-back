const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  roomType: {
    type: String,
    enum: ['Standard', 'Deluxe', 'Suite', 'Family', 'Executive', 'Superior', 'Villa'],
    required: [true, 'Room type is required'],
  },
  name: { type: String, required: [true, 'Room name is required'], trim: true },
  description: { type: String },
  pricePerNight: { type: Number, required: [true, 'Price per night is required'], min: 0 },
  maxOccupancy: { type: Number, required: true, default: 2, min: 1 },
  totalRooms: { type: Number, default: 1, min: 1 },
  amenities: [{ type: String }],
  images: [{ url: String, publicId: String }],
  bedType: {
    type: String,
    enum: ['Single', 'Double', 'King', 'Twin', 'Queen'],
  },
  size: { type: Number },
  floor: { type: Number },
  isAvailable: { type: Boolean, default: true },
  discountPrice: { type: Number, min: 0 },
  metaTitle: { type: String, trim: true },
  metaDescription: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
});

roomSchema.index({ hotel: 1, roomType: 1 });
roomSchema.index({ hotel: 1, isAvailable: 1 });

module.exports = mongoose.model('Room', roomSchema);
