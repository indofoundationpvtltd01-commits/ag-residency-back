const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a title for the gallery image'],
    trim: true,
  },
  category: {
    type: String,
    enum: ['Rooms', 'Exterior', 'Amenities', 'Retreat', 'Dining'],
    default: 'Rooms',
  },
  image: {
    publicId: { type: String, required: true },
    original: { type: String, required: true },
    large: { type: String },
    medium: { type: String },
    thumbnail: { type: String }
  },
  order: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Gallery', gallerySchema);
