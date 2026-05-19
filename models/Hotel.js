const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Hotel name is required'], trim: true },
  slug: { type: String, unique: true, lowercase: true },
  description: { type: String, required: [true, 'Description is required'] },
  city: { type: String, required: [true, 'City is required'], trim: true },
  area: { type: String, trim: true },
  address: { type: String, required: [true, 'Address is required'] },
  pincode: { type: String },
  phone: { type: String },
  email: { type: String },
  tagline: { type: String, trim: true },
  category: { 
    type: String, 
    enum: ['Budget', 'Mid-range', 'Premium', 'Luxury'],
    default: 'Mid-range'
  },
  starRating: { type: Number, min: 1, max: 5, default: 3 },
  amenities: [{ type: String }],
  images: [{ url: String, publicId: String }],
  coverImage: { url: String, publicId: String },
  location: {
    type: { 
      type: String, 
      enum: ['Point']
    },
    coordinates: {
      type: [Number]
    },
  },
  checkInTime: { type: String, default: '14:00' },
  checkOutTime: { type: String, default: '12:00' },
  policies: { type: String },
  cancellationPolicy: { type: String },
  isActive: { type: Boolean, default: true },
  managedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalMode: { type: String, enum: ['manual', 'automatic'], default: 'manual' },
  extraAdultCharge: { type: Number, default: 1500 },
  childCharge: { type: Number, default: 750 },
  taxRate: { type: Number, default: 0.12 },
  minPrice: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

hotelSchema.index({ location: '2dsphere' });
hotelSchema.index({ city: 1, isActive: 1 });
hotelSchema.index({ name: 'text', description: 'text', city: 'text', area: 'text' });

// Auto-generate slug from name
hotelSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }
  next();
});

// Clean up location if coordinates are missing during findOneAndUpdate (Super Admin paths)
hotelSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Check if location is being updated (either directly or via $set)
  const location = update.location || (update.$set && update.$set.location);
  
  if (location && (!location.coordinates || location.coordinates.length === 0)) {
    // Remove the invalid location from the update object
    delete update.location;
    if (update.$set) delete update.$set.location;
    
    // Explicitly $unset the location field in the database
    update.$unset = update.$unset || {};
    update.$unset.location = "";
  } else if (location && !location.type) {
    // Ensure type is 'Point' if coordinates are present
    if (update.$set) {
      update.$set['location.type'] = 'Point';
    } else {
      update.location.type = 'Point';
    }
  }
  next();
});

// Clean up location if coordinates are missing to avoid 2dsphere indexing errors
hotelSchema.pre('validate', function(next) {
  if (this.location && (!this.location.coordinates || this.location.coordinates.length === 0)) {
    this.location = undefined;
  } else if (this.location && !this.location.type) {
    this.location.type = 'Point';
  }
  next();
});

module.exports = mongoose.model('Hotel', hotelSchema);
