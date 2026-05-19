const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const cloudinary = require('../config/cloudinary');
const { AppError } = require('../middleware/errorHandler');

// @GET /api/v1/rooms/hotel/:hotelId
const getRoomsByHotel = async (req, res, next) => {
  try {
    const { checkIn, checkOut } = req.query;
    const rooms = await Room.find({ hotel: req.params.hotelId });

    if (checkIn && checkOut) {
      const roomsWithAvailability = await Promise.all(
        rooms.map(async (room) => {
          const availability = await checkAvailability(room._id, new Date(checkIn), new Date(checkOut));
          return { ...room.toObject(), ...availability };
        })
      );
      return res.json({ success: true, count: roomsWithAvailability.length, data: roomsWithAvailability });
    }

    res.json({ success: true, count: rooms.length, data: rooms });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/rooms/:id
const getRoomById = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id).populate('hotel', 'name city address');
    if (!room) return next(new AppError('Room not found', 404));
    res.json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/rooms/:id/availability
const checkRoomAvailability = async (req, res, next) => {
  try {
    const { checkIn, checkOut } = req.query;
    if (!checkIn || !checkOut) return next(new AppError('checkIn and checkOut dates required', 400));
    const availability = await checkAvailability(req.params.id, new Date(checkIn), new Date(checkOut));
    res.json({ success: true, data: availability });
  } catch (err) {
    next(err);
  }
};

// Internal availability helper
const checkAvailability = async (roomId, checkIn, checkOut) => {
  const room = await Room.findById(roomId);
  if (!room) throw new AppError('Room not found', 404);

  const conflicting = await Booking.countDocuments({
    room: roomId,
    status: { $in: ['pending', 'confirmed'] },
    $or: [{ checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } }],
  });

  return {
    available: conflicting < room.totalRooms,
    remainingRooms: Math.max(0, room.totalRooms - conflicting),
    totalRooms: room.totalRooms,
    bookedRooms: conflicting,
  };
};

// Helper: Update Hotel minPrice based on cheapest room (considering discounts)
const updateHotelMinPrice = async (hotelId) => {
  try {
    const rooms = await Room.find({ hotel: hotelId, isAvailable: true });
    
    if (rooms.length === 0) {
      await Hotel.findByIdAndUpdate(hotelId, { minPrice: 0 });
      return;
    }

    // Find the absolute minimum price across all rooms (original or discounted)
    const minPrice = rooms.reduce((min, room) => {
      const activePrice = (room.discountPrice && room.discountPrice > 0) ? room.discountPrice : room.pricePerNight;
      return activePrice < min ? activePrice : min;
    }, rooms[0].discountPrice || rooms[0].pricePerNight);

    await Hotel.findByIdAndUpdate(hotelId, { minPrice });
  } catch (err) {
    console.error(`Failed to update hotel minPrice for ${hotelId}:`, err.message);
  }
};

// @POST /api/v1/rooms/hotel/:hotelId
const createRoom = async (req, res, next) => {
  try {
    const hotel = await Hotel.findById(req.params.hotelId);
    if (!hotel) return next(new AppError('Hotel not found', 404));

    // Handle both populated and unpopulated assignedHotel
    const userAssignedHotelId = req.user.assignedHotel?._id?.toString() || req.user.assignedHotel?.toString();
    
    if (req.user.role === 'hotel_admin' && hotel._id.toString() !== userAssignedHotelId) {
      return next(new AppError('Access denied: not your hotel', 403));
    }
    
    const room = await Room.create({ ...req.body, hotel: req.params.hotelId });
    await updateHotelMinPrice(req.params.hotelId);
    res.status(201).json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
};

// @PUT /api/v1/rooms/:id
const updateRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id).populate('hotel');
    if (!room) return next(new AppError('Room not found', 404));

    // Handle both populated and unpopulated assignedHotel
    const userAssignedHotelId = req.user.assignedHotel?._id?.toString() || req.user.assignedHotel?.toString();

    if (req.user.role === 'hotel_admin' && room.hotel._id.toString() !== userAssignedHotelId) {
      return next(new AppError('Access denied', 403));
    }
    const updated = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    await updateHotelMinPrice(room.hotel._id);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// @DELETE /api/v1/rooms/:id
const deleteRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id).populate('hotel');
    if (!room) return next(new AppError('Room not found', 404));

    // Hotel admin can only delete their own rooms
    const userAssignedHotelId = req.user.assignedHotel?._id?.toString() || req.user.assignedHotel?.toString();
    
    if (req.user.role === 'hotel_admin' && room.hotel._id.toString() !== userAssignedHotelId) {
      return next(new AppError('Access denied: not your hotel', 403));
    }

    for (const img of room.images) {
      if (img.publicId) {
        const isLocal = !img.publicId.includes('/') && img.publicId.includes('.');
        if (isLocal) {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.join(__dirname, '../uploads', img.publicId);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } else {
          try {
            await cloudinary.uploader.destroy(img.publicId);
          } catch (err) {
            console.warn(`Failed to delete room image ${img.publicId} from Cloudinary:`, err.message);
          }
        }
      }
    }
    await room.deleteOne();
    await updateHotelMinPrice(room.hotel._id);
    res.json({ success: true, message: 'Room deleted' });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/rooms/:id/images
const uploadRoomImages = async (req, res, next) => {
  try {
    const newImages = req.uploadedImages;
    if (!newImages || newImages.length === 0) return next(new AppError('No images provided', 400));
    const room = await Room.findById(req.params.id);
    if (!room) return next(new AppError('Room not found', 404));
    room.images.push(...newImages);
    await room.save();
    res.json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
};

// @PATCH /api/v1/rooms/:id/toggle
const toggleRoomAvailability = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return next(new AppError('Room not found', 404));
    room.isAvailable = !room.isAvailable;
    await room.save();
    await updateHotelMinPrice(room.hotel);
    res.json({ success: true, message: `Room ${room.isAvailable ? 'enabled' : 'disabled'}`, data: room });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/rooms/hotel/:hotelId/calendar
const getHotelAvailabilityCalendar = async (req, res, next) => {
  try {
    const { hotelId } = req.params;
    const { month, year } = req.query; // e.g., ?month=6&year=2025 (month is 1-indexed)

    if (!month || !year) return next(new AppError('Month and Year are required', 400));

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of the requested month
    endDate.setHours(23, 59, 59, 999);

    const rooms = await Room.find({ hotel: hotelId });
    const bookings = await Booking.find({
      hotel: hotelId,
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        { checkIn: { $lte: endDate }, checkOut: { $gte: startDate } }
      ]
    });

    const calendar = [];
    const daysInMonth = endDate.getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const currentDay = new Date(year, month - 1, d);
      const dayData = {
        date: d,
        fullDate: currentDay.toISOString().split('T')[0],
        isToday: currentDay.toDateString() === new Date().toDateString(),
        rooms: rooms.map(room => {
          const bookedCount = bookings.filter(b => {
            // A booking occupies the room if checkIn <= currentDay < checkOut
            return b.room.toString() === room._id.toString() &&
                   new Date(b.checkIn) <= currentDay &&
                   new Date(b.checkOut) > currentDay;
          }).length;

          return {
            type: room.roomType,
            id: room._id,
            name: room.name,
            booked: bookedCount,
            total: room.totalRooms
          };
        })
      };
      calendar.push(dayData);
    }

    res.json({ success: true, count: calendar.length, data: calendar });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/rooms/:id/booked-dates
const getRoomBookedDates = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return next(new AppError('Room not found', 404));

    const bookings = await Booking.find({
      room: req.params.id,
      status: { $in: ['pending', 'confirmed'] },
      checkOut: { $gte: new Date() }
    });

    const bookedDates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check availability for the next 180 days
    for (let i = 0; i < 180; i++) {
      const currentDay = new Date(today);
      currentDay.setDate(today.getDate() + i);
      
      const bookedCount = bookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        const checkOut = new Date(b.checkOut);
        checkIn.setHours(0,0,0,0);
        checkOut.setHours(0,0,0,0);
        return currentDay >= checkIn && currentDay < checkOut;
      }).length;

      if (bookedCount >= room.totalRooms) {
        bookedDates.push(currentDay.toISOString().split('T')[0]);
      }
    }

    res.json({ success: true, data: bookedDates });
  } catch (err) {
    next(err);
  }
};

module.exports = { getRoomsByHotel, getRoomById, checkRoomAvailability, createRoom, updateRoom, deleteRoom, uploadRoomImages, toggleRoomAvailability, checkAvailability, getHotelAvailabilityCalendar, getRoomBookedDates };
