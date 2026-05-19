const express = require('express');
const { createBooking, getMyBookings, getBookingById, cancelBooking, getHotelBookings, approveBooking, rejectBooking, getAllBookings, updatePaymentStatus, getPaymentSettings } = require('../controllers/bookingController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { uploadResidentProof, processUploads, handleMulterError } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post(
  '/', 
  verifyToken, 
  requireRole('customer', 'hotel_admin', 'super_admin'), 
  (req, res, next) => uploadResidentProof(req, res, (err) => err ? handleMulterError(err, req, res, next) : next()),
  processUploads('proofs'),
  createBooking
);
router.get('/payment-settings', verifyToken, getPaymentSettings);
router.get('/my', verifyToken, getMyBookings);
router.get('/', verifyToken, requireRole('super_admin'), getAllBookings);
router.get('/hotel/:hotelId', verifyToken, requireRole('hotel_admin', 'super_admin'), getHotelBookings);
router.get('/:id', verifyToken, getBookingById);
router.patch('/:id/cancel', verifyToken, requireRole('customer'), cancelBooking);
router.patch('/:id/approve', verifyToken, requireRole('hotel_admin', 'super_admin'), approveBooking);
router.patch('/:id/reject', verifyToken, requireRole('hotel_admin', 'super_admin'), rejectBooking);
router.patch('/:id/payment-status', verifyToken, requireRole('hotel_admin', 'super_admin'), updatePaymentStatus);

module.exports = router;
