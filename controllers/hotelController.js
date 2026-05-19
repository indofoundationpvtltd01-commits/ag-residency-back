const Hotel = require('../models/Hotel');
const User = require('../models/User');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const HotelUpdate = require('../models/HotelUpdate');
const cloudinary = require('../config/cloudinary');
const ApiFeatures = require('../utils/apiFeatures');
const { AppError } = require('../middleware/errorHandler');
const { escapeRegex } = require('../utils/sanitize');

// @GET /api/v1/hotels
const getAllHotels = async (req, res, next) => {
  try {
    const baseQuery = Hotel.find({ isActive: true });
    const features = new ApiFeatures(baseQuery, req.query)
      .search(['name', 'city', 'area', 'description'])
      .filter()
      .sort()
      .paginate(10);

    const hotels = await features.query.populate('managedBy', 'name email');
    const total = await Hotel.countDocuments({ isActive: true });

    res.json({
      success: true,
      count: hotels.length,
      total,
      page: features.page,
      pages: Math.ceil(total / features.limit),
      data: hotels,
    });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/hotels/:id
const getHotelById = async (req, res, next) => {
  try {
    const hotel = await Hotel.findById(req.params.id).populate('managedBy', 'name email');
    if (!hotel) return next(new AppError('Hotel not found', 404));
    const rooms = await Room.find({ hotel: hotel._id, isAvailable: true });
    res.json({ success: true, data: { ...hotel.toObject(), rooms } });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/hotels/slug/:slug
const getHotelBySlug = async (req, res, next) => {
  try {
    const hotel = await Hotel.findOne({ slug: req.params.slug, isActive: true }).populate('managedBy', 'name email');
    if (!hotel) return next(new AppError('Hotel not found', 404));
    const rooms = await Room.find({ hotel: hotel._id, isAvailable: true });
    res.json({ success: true, data: { ...hotel.toObject(), rooms } });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/hotels
const createHotel = async (req, res, next) => {
  try {
    const { managerName, managerEmail, managerPassword, ...hotelData } = req.body;
    
    // 1. Create the hotel
    const hotel = await Hotel.create({ 
      ...hotelData, 
      createdBy: req.user._id 
    });

    // 2. Handle Manager creation if provided
    if (managerEmail && managerPassword) {
      // Check if user already exists
      let user = await User.findOne({ email: managerEmail.toLowerCase() });
      
      if (user) {
        // If exists, update role and assign hotel
        user.role = 'hotel_admin';
        user.assignedHotel = hotel._id;
        if (managerName) user.name = managerName;
        // Update password securely via pre-save hook
        user.password = managerPassword; 
        await user.save();
      } else {
        // Create new hotel_admin
        user = await User.create({
          name: managerName || hotel.name + ' Manager',
          email: managerEmail.toLowerCase(),
          password: managerPassword,
          role: 'hotel_admin',
          assignedHotel: hotel._id
        });
      }

      // Link user back to hotel
      hotel.managedBy = user._id;
      await hotel.save();
    }

    res.status(201).json({ 
      success: true, 
      message: 'Hotel created successfully' + (managerEmail ? ' and manager account linked.' : '.'), 
      data: hotel 
    });
  } catch (err) {
    next(err);
  }
};

// @PUT /api/v1/hotels/:id
const updateHotel = async (req, res, next) => {
  try {
    const { managerName, managerEmail, managerPassword, ...updateData } = req.body;
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return next(new AppError('Hotel not found', 404));

    // Hotel admin can only update their assigned hotel
    if (req.user.role === 'hotel_admin' && hotel._id.toString() !== req.user.assignedHotel?.toString()) {
      return next(new AppError('Access denied: not your hotel', 403));
    }

    // Role-based logic: Super Admin updates live, Hotel Admin creates a pending request
    if (req.user.role === 'hotel_admin') {
      const pendingUpdate = await HotelUpdate.create({
        hotel: req.params.id,
        requester: req.user._id,
        data: updateData,
        status: 'pending'
      });
      return res.status(202).json({ 
        success: true, 
        message: 'Your update request has been submitted for Super Admin approval.', 
        data: pendingUpdate 
      });
    }

    // Super Admin logic: Update Hotel and possibly Manager
    const updated = await Hotel.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

    // Synchronization of Manager Access
    if (managerEmail) {
      let user;
      if (updated.managedBy) {
         user = await User.findById(updated.managedBy);
      }
      
      if (user) {
         // Update existing manager
         if (managerName) user.name = managerName;
         user.email = managerEmail.toLowerCase();
         // Only update password if a new one is provided
         if (managerPassword) {
            user.password = managerPassword;
         }
         await user.save();
      } else if (managerPassword) {
         // Create new manager if not exists (requires password)
         user = await User.create({
            name: managerName || updated.name + ' Manager',
            email: managerEmail.toLowerCase(),
            password: managerPassword,
            role: 'hotel_admin',
            assignedHotel: updated._id
         });
         updated.managedBy = user._id;
         await updated.save();
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/hotels/admin/pending-updates
const getPendingHotelUpdates = async (req, res, next) => {
  try {
    const updates = await HotelUpdate.find({ status: 'pending' })
      .populate('hotel', 'name city')
      .populate('requester', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, count: updates.length, data: updates });
  } catch (err) {
    next(err);
  }
};

// @PATCH /api/v1/hotels/admin/approve-update/:updateId
const approveHotelUpdate = async (req, res, next) => {
  try {
    const updateReq = await HotelUpdate.findById(req.params.updateId);
    if (!updateReq) return next(new AppError('Update request not found', 404));
    if (updateReq.status !== 'pending') return next(new AppError('Update is already actioned', 400));

    // Apply the changes to the Hotel
    const hotel = await Hotel.findById(updateReq.hotel);
    if (!hotel) return next(new AppError('Hotel not found', 404));

    Object.assign(hotel, updateReq.data);
    await hotel.save();

    // Mark as approved
    updateReq.status = 'approved';
    updateReq.actionedAt = new Date();
    updateReq.actionedBy = req.user._id;
    await updateReq.save();

    res.json({ success: true, message: 'Hotel update approved and applied live.' });
  } catch (err) {
    next(err);
  }
};

// @PATCH /api/v1/hotels/admin/reject-update/:updateId
const rejectHotelUpdate = async (req, res, next) => {
  try {
    const updateReq = await HotelUpdate.findById(req.params.updateId);
    if (!updateReq) return next(new AppError('Update request not found', 404));
    if (updateReq.status !== 'pending') return next(new AppError('Update is already actioned', 400));

    updateReq.status = 'rejected';
    updateReq.rejectionReason = req.body.reason || 'Rejected by Super Admin';
    updateReq.actionedAt = new Date();
    updateReq.actionedBy = req.user._id;
    await updateReq.save();

    res.json({ success: true, message: 'Hotel update request rejected.' });
  } catch (err) {
    next(err);
  }
};

// @DELETE /api/v1/hotels/:id
const deleteHotel = async (req, res, next) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return next(new AppError('Hotel not found', 404));
    // Delete Cloudinary images gracefully
    for (const img of hotel.images) {
      if (img.publicId) {
        try {
          await cloudinary.uploader.destroy(img.publicId);
        } catch (err) {
          console.warn(`Failed to delete image ${img.publicId} from Cloudinary:`, err.message);
        }
      }
    }
    await hotel.deleteOne();
    res.json({ success: true, message: 'Hotel deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/hotels/:id/images
const uploadHotelImages = async (req, res, next) => {
  try {
    const newImages = req.uploadedImages;
    if (!newImages || newImages.length === 0) return next(new AppError('No images provided', 400));
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return next(new AppError('Hotel not found', 404));

    hotel.images.push(...newImages);
    if (!hotel.coverImage?.url) hotel.coverImage = newImages[0];
    await hotel.save();

    res.json({ success: true, message: 'Images uploaded', data: hotel });
  } catch (err) {
    next(err);
  }
};

// @DELETE /api/v1/hotels/:id/images/:publicId
const deleteHotelImage = async (req, res, next) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return next(new AppError('Hotel not found', 404));
    
    const { publicId } = req.params;
    const isLocal = !publicId.includes('/') && publicId.includes('.'); // Simple check for local filename vs Cloudinary ID

    if (isLocal) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../uploads', publicId);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } else {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.warn(`Failed to delete image ${publicId} from Cloudinary:`, err.message);
      }
    }

    hotel.images = hotel.images.filter((img) => img.publicId !== publicId);
    await hotel.save();
    res.json({ success: true, message: 'Image deleted', data: hotel });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/hotels/locations/cities
const getDistinctCities = async (req, res, next) => {
  try {
    const cities = await Hotel.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 },
          areas: { $addToSet: '$area' },
        },
      },
      { $sort: { count: -1 } },
      {
        $project: {
          _id: 0,
          city: '$_id',
          count: 1,
          areas: {
            $filter: {
              input: '$areas',
              as: 'a',
              cond: { $and: [{ $ne: ['$$a', null] }, { $ne: ['$$a', ''] }] },
            },
          },
        },
      },
    ]);
    res.json({ success: true, data: cities });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/hotels/locations/suggestions?q=che
const getLocationSuggestions = async (req, res, next) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      // Return all cities
      const cities = await Hotel.distinct('city', { isActive: true });
      const suggestions = cities.map((c) => ({ type: 'city', label: c, value: c }));
      return res.json({ success: true, data: suggestions });
    }

    const regex = new RegExp(escapeRegex(q), 'i');
    const hotels = await Hotel.find(
      { isActive: true, $or: [{ city: regex }, { area: regex }, { name: regex }] },
      'city area name'
    ).limit(20);

    const seen = new Set();
    const suggestions = [];

    // Cities first
    for (const h of hotels) {
      if (regex.test(h.city) && !seen.has(`city:${h.city}`)) {
        seen.add(`city:${h.city}`);
        suggestions.push({ type: 'city', label: h.city, value: h.city });
      }
    }
    // Areas
    for (const h of hotels) {
      if (h.area && regex.test(h.area) && !seen.has(`area:${h.area}`)) {
        seen.add(`area:${h.area}`);
        suggestions.push({ type: 'area', label: `${h.area}, ${h.city}`, value: h.city });
      }
    }
    // Hotel names
    for (const h of hotels) {
      if (regex.test(h.name) && !seen.has(`hotel:${h.name}`)) {
        seen.add(`hotel:${h.name}`);
        suggestions.push({ type: 'hotel', label: h.name, sublabel: h.city, value: h.city });
      }
    }

    res.json({ success: true, data: suggestions.slice(0, 10) });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/hotels/availability/check
const checkAvailability = async (req, res, next) => {
  try {
    const { checkIn, checkOut, city } = req.query;
    if (!checkIn || !checkOut) {
      return next(new AppError('checkIn and checkOut dates are required', 400));
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Find overlapping bookings for confirmed or pending status
    const bookedRoomIds = await Booking.distinct('room', {
      status: { $in: ['confirmed', 'pending'] },
      $or: [
        { checkIn: { $lt: checkOutDate }, checkOut: { $gt: checkInDate } },
      ],
    });

    // Build hotel filter
    const hotelFilter = { isActive: true };
    if (city) hotelFilter.city = new RegExp(escapeRegex(city), 'i');

    const hotels = await Hotel.find(hotelFilter).lean();
    const hotelIds = hotels.map((h) => h._id);

    // For each hotel, find rooms that are NOT fully booked
    const rooms = await Room.find({
      hotel: { $in: hotelIds },
      isAvailable: true,
    }).lean();

    // Count available rooms per hotel
    const availabilityMap = {};
    for (const room of rooms) {
      const hotelId = room.hotel.toString();
      if (!availabilityMap[hotelId]) availabilityMap[hotelId] = 0;
      // If this room is not in the booked list, it's available
      if (!bookedRoomIds.some((id) => id.toString() === room._id.toString())) {
        availabilityMap[hotelId]++;
      }
    }

    const availableHotels = hotels
      .filter((h) => (availabilityMap[h._id.toString()] || 0) > 0)
      .map((h) => ({
        ...h,
        availableRooms: availabilityMap[h._id.toString()] || 0,
      }));

    res.json({
      success: true,
      count: availableHotels.length,
      data: availableHotels,
    });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/hotels/upload-images
const uploadImagesOnly = async (req, res, next) => {
  try {
    const uploaded = req.uploadedImages;
    if (!uploaded || uploaded.length === 0) return next(new AppError('No images uploaded', 400));
    res.json({ success: true, data: uploaded });
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  getAllHotels, getHotelById, getHotelBySlug, createHotel, updateHotel, deleteHotel, 
  uploadHotelImages, deleteHotelImage, getDistinctCities, getLocationSuggestions, 
  checkAvailability, getPendingHotelUpdates, approveHotelUpdate, rejectHotelUpdate,
  uploadImagesOnly
};
