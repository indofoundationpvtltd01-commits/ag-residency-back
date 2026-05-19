const express = require('express');
const { 
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
} = require('../controllers/adminController');
const { getAllHotels, createHotel } = require('../controllers/hotelController');
const { getAllBookings } = require('../controllers/bookingController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Hotel Admin routes
router.get('/hotel/dashboard', verifyToken, requireRole('hotel_admin', 'super_admin'), hotelAdminDashboard);
router.get('/hotel/calendar', verifyToken, requireRole('hotel_admin', 'super_admin'), getCalendar);

// Super Admin routes
router.get('/super/dashboard', verifyToken, requireRole('super_admin'), superAdminDashboard);
router.get('/super/users', verifyToken, requireRole('super_admin'), getAllUsers);
router.post('/super/users/hotel-admin', verifyToken, requireRole('super_admin'), createHotelAdmin);
router.patch('/super/users/:id/toggle', verifyToken, requireRole('super_admin'), toggleUserStatus);
router.delete('/super/users/:id', verifyToken, requireRole('super_admin'), deleteUser);
router.get('/super/bookings', verifyToken, requireRole('super_admin'), getAllBookings);
router.get('/super/revenue', verifyToken, requireRole('super_admin'), getRevenueReport);
router.get('/super/settings', verifyToken, requireRole('super_admin'), getGlobalSettings);
router.put('/super/settings', verifyToken, requireRole('super_admin'), updateGlobalSettings);
router.get('/super/emails', verifyToken, requireRole('super_admin'), getEmailLogs);

module.exports = router;
