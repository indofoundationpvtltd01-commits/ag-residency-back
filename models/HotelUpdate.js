const mongoose = require('mongoose');

const hotelUpdateSchema = new mongoose.Schema({
  hotel: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Hotel', 
    required: true 
  },
  requester: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  data: { 
    type: Object, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  rejectionReason: {
    type: String
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  actionedAt: {
    type: Date
  },
  actionedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

hotelUpdateSchema.index({ hotel: 1, status: 1 });

module.exports = mongoose.model('HotelUpdate', hotelUpdateSchema);
