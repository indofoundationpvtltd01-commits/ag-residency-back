const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const EmailLog = require('../models/EmailLog');
const { AppError } = require('../middleware/errorHandler');

// ================== HOTEL ADMIN ==================

// @GET /api/v1/admin/hotel/dashboard
const hotelAdminDashboard = async (req, res, next) => {
  try {
    const hotelId = req.user.assignedHotel;
    if (!hotelId) return next(new AppError('No hotel assigned to this admin', 400));

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // For weekly chart (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalBookings, 
      confirmedBookings, 
      pendingBookings, 
      cancelledBookings, 
      rooms, 
      monthlyRevenue, 
      recentBookings,
      arrivalsToday,
      departuresToday
    ] = await Promise.all([
      Booking.countDocuments({ hotel: hotelId }),
      Booking.countDocuments({ hotel: hotelId, status: 'confirmed' }),
      Booking.countDocuments({ hotel: hotelId, status: 'pending' }),
      Booking.countDocuments({ hotel: hotelId, status: 'cancelled' }),
      Room.find({ hotel: hotelId }),
      Booking.aggregate([
        { $match: { hotel: hotelId, paymentStatus: 'paid', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Booking.find({ hotel: hotelId }).sort({ createdAt: -1 }).limit(10)
        .populate('customer', 'name email').populate('room', 'name roomType'),
      Booking.find({ 
        hotel: hotelId, 
        status: 'confirmed', 
        checkIn: { $gte: startOfToday, $lte: endOfToday } 
      }).populate('customer', 'name email').populate('room', 'name'),
      Booking.find({ 
        hotel: hotelId, 
        status: 'confirmed', 
        checkOut: { $gte: startOfToday, $lte: endOfToday } 
      }).populate('customer', 'name email').populate('room', 'name'),
    ]);

    // Monthly revenue chart (last 6 months)
    const revenueChart = await Booking.aggregate([
      { $match: { hotel: hotelId, paymentStatus: 'paid' } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 },
    ]);

    // Weekly revenue chart
    const revenueWeekly = await Booking.aggregate([
      { $match: { hotel: hotelId, paymentStatus: 'paid', createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { day: { $dayOfMonth: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { '_id.month': 1, '_id.day': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalBookings, confirmedBookings, pendingBookings, cancelledBookings,
          revenueThisMonth: monthlyRevenue[0]?.total || 0,
          totalRooms: rooms.length,
          occupancyRate: rooms.length > 0 ? (confirmedBookings / rooms.length) * 100 : 0
        },
        recentBookings,
        arrivalsToday,
        departuresToday,
        revenueChart: revenueChart.reverse(),
        revenueWeekly
      },
    });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/admin/hotel/calendar
const getCalendar = async (req, res, next) => {
  try {
    const hotelId = req.user.assignedHotel;
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0);

    const bookings = await Booking.find({
      hotel: hotelId,
      status: { $in: ['pending', 'confirmed'] },
      $or: [{ checkIn: { $lte: endDate }, checkOut: { $gte: startDate } }],
    }).populate('room', 'name roomType').populate('customer', 'name');

    const rooms = await Room.find({ hotel: hotelId });

    res.json({ success: true, data: { bookings, rooms, month: m, year: y } });
  } catch (err) {
    next(err);
  }
};

// ================== SUPER ADMIN ==================

// @GET /api/v1/admin/super/dashboard
const superAdminDashboard = async (req, res, next) => {
  try {
    const [totalHotels, totalUsers, totalBookings, revenueData, topHotels, recentBookings] = await Promise.all([
      Hotel.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'customer' }),
      Booking.countDocuments(),
      Booking.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Booking.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: '$hotel', revenue: { $sum: '$totalAmount' }, bookings: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'hotels', localField: '_id', foreignField: '_id', as: 'hotel' } },
        { $unwind: '$hotel' },
      ]),
      Booking.find().sort({ createdAt: -1 }).limit(10)
        .populate('hotel', 'name city').populate('customer', 'name email').populate('room', 'name'),
    ]);

    const bookingTrend = await Booking.aggregate([
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalHotels, totalUsers, totalBookings,
          platformRevenue: revenueData[0]?.total || 0,
        },
        topHotels,
        recentBookings,
        bookingTrend: bookingTrend.reverse(),
      },
    });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/admin/super/users
const getAllUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) filter.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter).populate('assignedHotel', 'name city').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, count: users.length, total, pages: Math.ceil(total / parseInt(limit)), data: users });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/admin/super/users/hotel-admin
const createHotelAdmin = async (req, res, next) => {
  try {
    const { name, email, password, phone, assignedHotel } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return next(new AppError('Email already in use', 409));
    const hotel = await Hotel.findById(assignedHotel);
    if (!hotel) return next(new AppError('Hotel not found', 404));

    const admin = await User.create({ name, email, password, phone, role: 'hotel_admin', assignedHotel });
    await Hotel.findByIdAndUpdate(assignedHotel, { managedBy: admin._id });

    res.status(201).json({ success: true, message: 'Hotel admin created', data: admin });
  } catch (err) {
    next(err);
  }
};

// @PATCH /api/v1/admin/super/users/:id/toggle
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User not found', 404));
    if (user.role === 'super_admin') return next(new AppError('Cannot deactivate super admin', 403));
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, data: user });
  } catch (err) {
    next(err);
  }
};

// @DELETE /api/v1/admin/super/users/:id
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User not found', 404));
    if (user.role === 'super_admin') return next(new AppError('Cannot delete super admin', 403));
    await user.deleteOne();
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/admin/super/revenue
const getRevenueReport = async (req, res, next) => {
  try {
    const revenueByHotel = await Booking.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: '$hotel', revenue: { $sum: '$totalAmount' }, bookings: { $sum: 1 } } },
      { $lookup: { from: 'hotels', localField: '_id', foreignField: '_id', as: 'hotel' } },
      { $unwind: '$hotel' },
      { $sort: { revenue: -1 } },
    ]);
    const revenueByMonth = await Booking.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]);
    res.json({ success: true, data: { revenueByHotel, revenueByMonth: revenueByMonth.reverse() } });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/admin/super/settings
const getGlobalSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

// @PUT /api/v1/admin/super/settings
const updateGlobalSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ ...req.body, updatedBy: req.user._id });
    } else {
      settings = await Settings.findOneAndUpdate({}, { ...req.body, updatedBy: req.user._id, updatedAt: Date.now() }, { new: true });
    }
    res.json({ success: true, message: 'Settings updated successfully', data: settings });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/admin/super/emails
const getEmailLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      EmailLog.find().sort({ sentAt: -1 }).skip(skip).limit(parseInt(limit)),
      EmailLog.countDocuments(),
    ]);
    res.json({ success: true, count: logs.length, total, pages: Math.ceil(total / parseInt(limit)), data: logs });
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  hotelAdminDashboard, 
  getCalendar, 
  superAdminDashboard, 
  getAllUsers, 
  createHotelAdmin, 
  toggleUserStatus, 
  deleteUser, 
  getRevenueReport,
  getGlobalSettings,
  updateGlobalSettings,
  getEmailLogs
};
