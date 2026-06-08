const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Hotel = require('../models/Hotel');
const Settings = require('../models/Settings');
const { checkAvailability } = require('./roomController');
const { queueEmail, queueSMS } = require('../utils/notificationQueue');
const { AppError } = require('../middleware/errorHandler');

// @POST /api/v1/bookings
const createBooking = async (req, res, next) => {
  try {
    const { 
      hotel, 
      room: roomId, 
      checkIn, 
      checkOut, 
      numberOfGuests, 
      adults, 
      children, 
      guestName, 
      guestEmail, 
      guestPhone, 
      specialRequests,
      source,
      paymentMethod,
      cashAmount,
      upiAmount,
      documentType
    } = req.body;

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (checkInDate >= checkOutDate) return next(new AppError('Check-out must be after check-in', 400));
    if (checkInDate < new Date().setHours(0,0,0,0)) return next(new AppError('Check-in cannot be in the past', 400));

    // Check payment method against global settings
    const settings = await Settings.findOne();
    const allowedMethod = settings?.allowedPaymentMethod || 'both';
    const resolvedPaymentMethod = paymentMethod || 'Online';

    if (allowedMethod !== 'both') {
      if (allowedMethod === 'online' && resolvedPaymentMethod !== 'Online') {
        return next(new AppError('Only online payments are allowed', 400));
      }
      if (allowedMethod === 'hotel' && resolvedPaymentMethod !== 'Pay at Hotel') {
        return next(new AppError('Only pay at hotel is allowed', 400));
      }
    }

    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const availability = await checkAvailability(roomId, checkInDate, checkOutDate);
    if (!availability.available) return next(new AppError('Room is not available for selected dates', 409));

    const roomDoc = await Room.findById(roomId);
    const hotelDoc = await Hotel.findById(hotel);
    if (!hotelDoc) return next(new AppError('Hotel not found', 404));

    // Permission check for hotel_admin
    if (req.user.role === 'hotel_admin') {
      const assignedHotelId = req.user.assignedHotel?._id?.toString() || req.user.assignedHotel?.toString();
      if (hotelDoc._id.toString() !== assignedHotelId) {
        return next(new AppError('Access denied: You can only create bookings for your assigned hotel', 403));
      }
    }

    // Dynamic Pricing Logic (Fetched from Hotel Model)
    const EXTRA_ADULT_CHARGE = hotelDoc.extraAdultCharge || 1500;
    const CHILD_CHARGE = hotelDoc.childCharge || 750;
    const BASE_ADULTS = 2;

    const baseRoomTotal = roomDoc.pricePerNight * nights;
    const curAdults = adults ? Number(adults) : 1;
    const curChildren = children ? Number(children) : 0;
    const extraAdultsCount = Math.max(0, curAdults - BASE_ADULTS);
    const extraAdultCharges = extraAdultsCount * EXTRA_ADULT_CHARGE * nights;
    const childCharges = curChildren * CHILD_CHARGE * nights;
    
    const totalRate = baseRoomTotal + extraAdultCharges + childCharges;
    const taxes = totalRate * (hotelDoc.taxRate || 0.12);
    const totalAmount = totalRate + taxes;

    const approvalMode = hotelDoc.approvalMode || 'manual';

    let residentProof = null;
    if (req.uploadedImages) {
      residentProof = {
        url: req.uploadedImages.original || req.uploadedImages.url,
        publicId: req.uploadedImages.publicId,
        documentType: documentType || 'aadhaar',
        verified: false,
        uploadedAt: new Date()
      };
    }

    const booking = await Booking.create({
      hotel,
      room: roomId,
      customer: req.user._id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      nights,
      adults: curAdults,
      children: curChildren,
      numberOfGuests: numberOfGuests ? Number(numberOfGuests) : (curAdults + curChildren),
      pricePerNight: roomDoc.pricePerNight,
      totalAmount,
      approvalMode,
      status: approvalMode === 'automatic' ? 'confirmed' : 'pending',
      guestName: guestName || req.user.name,
      guestEmail: guestEmail || req.user.email,
      guestPhone: guestPhone || req.user.phone,
      specialRequests,
      source: source || 'online',
      paymentMethod: paymentMethod || 'Online',
      cashAmount: cashAmount ? Number(cashAmount) : 0,
      upiAmount: upiAmount ? Number(upiAmount) : 0,
      residentProof,
      taxRate: hotelDoc.taxRate || 0.12,
    });

    // Queue admin notification email asynchronously
    if (hotelDoc && hotelDoc.managedBy) {
      const adminUser = await require('../models/User').findById(hotelDoc.managedBy);
      if (adminUser) {
        queueEmail({
          to: adminUser.email,
          subject: `New Booking — ${hotelDoc.name}`,
          templateName: 'adminNotification.html',
          replacements: {
            adminName: adminUser.name,
            guestName: booking.guestName,
            roomType: roomDoc.name,
            checkIn: checkInDate.toDateString(),
            checkOut: checkOutDate.toDateString(),
            totalAmount: totalAmount.toLocaleString('en-IN'),
            bookingId: booking._id.toString(),
          },
        }).catch(() => {});

        // Queue admin notification SMS
        if (adminUser.phone) {
          queueSMS({
            to: adminUser.phone,
            body: `Alert: New booking created at ${hotelDoc.name} by ${booking.guestName}. Check-in: ${checkInDate.toDateString()}. ID: ${booking._id.toString().substring(18).toUpperCase()}`
          }).catch(() => {});
        }
      }
    }

    const populated = await Booking.findById(booking._id).populate('hotel', 'name city').populate('room', 'name roomType');
    res.status(201).json({ success: true, message: 'Booking created', data: populated });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/bookings/my
const getMyBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { customer: req.user._id };
    if (status) filter.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(filter).populate('hotel', 'name city coverImage').populate('room', 'name roomType images')
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Booking.countDocuments(filter),
    ]);
    res.json({ success: true, count: bookings.length, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data: bookings });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/bookings/:id
const getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('hotel', 'name city address phone email coverImage')
      .populate('room', 'name roomType images bedType')
      .populate('customer', 'name email phone')
      .populate('paymentId');
    if (!booking) return next(new AppError('Booking not found', 404));

    const isOwner = booking.customer._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'hotel_admin' || req.user.role === 'super_admin';
    if (!isOwner && !isAdmin) return next(new AppError('Access denied', 403));

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// @PATCH /api/v1/bookings/:id/cancel
const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return next(new AppError('Booking not found', 404));
    if (booking.customer.toString() !== req.user._id.toString()) return next(new AppError('Access denied', 403));
    if (!['pending', 'confirmed'].includes(booking.status)) return next(new AppError('Cannot cancel this booking', 400));

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancelReason = req.body.reason || 'Cancelled by customer';
    await booking.save();

    // Queue cancellation email asynchronously
    queueEmail({
      to: booking.guestEmail,
      subject: 'AG Residency — Booking Cancelled',
      templateName: 'bookingCancellation.html',
      replacements: {
        guestName: booking.guestName,
        bookingId: booking._id.toString(),
        checkIn: booking.checkIn.toDateString(),
        checkOut: booking.checkOut.toDateString(),
        refundStatus: booking.paymentStatus === 'paid' ? 'A refund will be initiated within 5-7 business days.' : 'No payment was made.',
      },
    }).catch(() => {});

    // Queue cancellation SMS
    if (booking.guestPhone) {
      queueSMS({
        to: booking.guestPhone,
        body: `Dear ${booking.guestName}, your reservation at ${booking.hotel?.name || 'AG Residency'} has been cancelled successfully. ID: ${booking._id.toString().substring(18).toUpperCase()}.`
      }).catch(() => {});
    }

    res.json({ success: true, message: 'Booking cancelled', data: booking });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/bookings/hotel/:hotelId
const getHotelBookings = async (req, res, next) => {
  try {
    const hotel = await Hotel.findById(req.params.hotelId);
    if (!hotel) return next(new AppError('Hotel not found', 404));
    const assignedHotelId = req.user.assignedHotel?._id?.toString() || req.user.assignedHotel?.toString();
    if (req.user.role === 'hotel_admin' && hotel._id.toString() !== assignedHotelId) {
      return next(new AppError('Access denied', 403));
    }
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { hotel: req.params.hotelId };
    if (status) filter.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(filter).populate('customer', 'name email phone').populate('room', 'name roomType')
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Booking.countDocuments(filter),
    ]);
    res.json({ success: true, count: bookings.length, total, pages: Math.ceil(total / parseInt(limit)), data: bookings });
  } catch (err) {
    next(err);
  }
};

// @PATCH /api/v1/bookings/:id/approve
const approveBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('hotel');
    if (!booking) return next(new AppError('Booking not found', 404));
    const assignedHotelId = req.user.assignedHotel?._id?.toString() || req.user.assignedHotel?.toString();
    if (req.user.role === 'hotel_admin' && booking.hotel._id.toString() !== assignedHotelId) {
      return next(new AppError('Access denied', 403));
    }
    if (booking.status !== 'pending') return next(new AppError('Only pending bookings can be approved', 400));

    booking.status = 'confirmed';
    await booking.save();

    // Queue confirmation email asynchronously
    queueEmail({
      to: booking.guestEmail,
      subject: 'AG Residency — Booking Confirmed!',
      templateName: 'bookingConfirmation.html',
      replacements: {
        guestName: booking.guestName,
        hotelName: booking.hotel.name,
        checkIn: booking.checkIn.toDateString(),
        checkOut: booking.checkOut.toDateString(),
        nights: booking.nights,
        totalAmount: booking.totalAmount.toLocaleString('en-IN'),
        bookingId: booking._id.toString(),
        clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
      },
    }).catch(() => {});

    // Queue confirmation SMS
    if (booking.guestPhone) {
      queueSMS({
        to: booking.guestPhone,
        body: `Dear ${booking.guestName}, your booking at ${booking.hotel.name} is confirmed! Check-in: ${booking.checkIn.toDateString()}. ID: ${booking._id.toString().substring(18).toUpperCase()}`
      }).catch(() => {});
    }

    res.json({ success: true, message: 'Booking approved', data: booking });
  } catch (err) {
    next(err);
  }
};

// @PATCH /api/v1/bookings/:id/reject
const rejectBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('hotel');
    if (!booking) return next(new AppError('Booking not found', 404));
    const assignedHotelId = req.user.assignedHotel?._id?.toString() || req.user.assignedHotel?.toString();
    if (req.user.role === 'hotel_admin' && booking.hotel._id.toString() !== assignedHotelId) {
      return next(new AppError('Access denied', 403));
    }
    if (booking.status !== 'pending') return next(new AppError('Only pending bookings can be rejected', 400));

    booking.status = 'rejected';
    booking.rejectedAt = new Date();
    booking.rejectionReason = req.body.reason || 'Rejected by hotel admin';
    await booking.save();

    res.json({ success: true, message: 'Booking rejected', data: booking });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/bookings (super admin)
const getAllBookings = async (req, res, next) => {
  try {
    const { status, hotel, source, page = 1, limit = 20, startDate, endDate } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (hotel) filter.hotel = hotel;
    if (source) filter.source = source;
    if (startDate || endDate) {
      filter.checkIn = {};
      if (startDate) filter.checkIn.$gte = new Date(startDate);
      if (endDate) filter.checkIn.$lte = new Date(endDate);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(filter).populate('hotel', 'name city').populate('room', 'name roomType').populate('customer', 'name email')
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Booking.countDocuments(filter),
    ]);
    res.json({ success: true, count: bookings.length, total, pages: Math.ceil(total / parseInt(limit)), data: bookings });
  } catch (err) {
    next(err);
  }
};

// @PATCH /api/v1/bookings/:id/payment-status
const updatePaymentStatus = async (req, res, next) => {
  try {
    const { status: newStatus, paymentMethod } = req.body;
    if (!['paid', 'unpaid'].includes(newStatus)) {
      return next(new AppError('Invalid payment status. Must be paid or unpaid', 400));
    }

    const booking = await Booking.findById(req.params.id).populate('hotel');
    if (!booking) return next(new AppError('Booking not found', 404));

    const assignedHotelId = req.user.assignedHotel?._id?.toString() || req.user.assignedHotel?.toString();
    if (req.user.role === 'hotel_admin' && booking.hotel._id.toString() !== assignedHotelId) {
      return next(new AppError('Access denied', 403));
    }

    // Role-based restrictions
    if (req.user.role === 'hotel_admin') {
      if (booking.paymentStatus === 'paid' && newStatus === 'unpaid') {
        return next(new AppError('Access denied: Hotel admins cannot revert a paid status to unpaid. Please contact a super admin.', 403));
      }
    }

    booking.paymentStatus = newStatus;
    if (newStatus === 'paid') {
      if (paymentMethod) {
        booking.paymentMethod = paymentMethod;
      }
      // If payment is manually recorded as paid, we can also consider switching status to confirmed if it was pending
      if (booking.status === 'pending') {
        booking.status = 'confirmed';
      }
    }
    
    await booking.save();

    res.json({ success: true, message: `Payment status updated to ${newStatus}`, data: booking });
  } catch (err) {
    next(err);
  }
};

const getPaymentSettings = async (req, res, next) => {
  try {
    const settings = await Settings.findOne();
    res.json({ success: true, data: { allowedPaymentMethod: settings?.allowedPaymentMethod || 'both' } });
  } catch (err) {
    next(err);
  }
};

const verifyBookingDocument = async (req, res, next) => {
  try {
    const { verified } = req.body;
    if (typeof verified !== 'boolean') {
      return next(new AppError('Verified status must be a boolean', 400));
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return next(new AppError('Booking not found', 404));

    // Permission check for hotel_admin
    if (req.user.role === 'hotel_admin') {
      const assignedHotelId = req.user.assignedHotel?._id?.toString() || req.user.assignedHotel?.toString();
      if (booking.hotel.toString() !== assignedHotelId) {
        return next(new AppError('Access denied: You can only verify documents for bookings in your assigned hotel', 403));
      }
    }

    if (!booking.residentProof || !booking.residentProof.url) {
      return next(new AppError('No resident proof uploaded for this booking', 400));
    }

    booking.residentProof.verified = verified;
    booking.residentProof.uploadedAt = booking.residentProof.uploadedAt || new Date();
    await booking.save();

    res.json({ success: true, message: `Document verification status updated to ${verified}`, data: booking });
  } catch (err) {
    next(err);
  }
};

module.exports = { createBooking, getMyBookings, getBookingById, cancelBooking, getHotelBookings, approveBooking, rejectBooking, getAllBookings, updatePaymentStatus, getPaymentSettings, verifyBookingDocument };
