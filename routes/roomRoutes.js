const express = require('express');
const { getRoomsByHotel, getRoomById, checkRoomAvailability, createRoom, updateRoom, deleteRoom, uploadRoomImages, toggleRoomAvailability, getHotelAvailabilityCalendar, getRoomBookedDates } = require('../controllers/roomController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { uploadRoomImages: multerUpload, processUploads, handleMulterError } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.get('/hotel/:hotelId', getRoomsByHotel);
router.get('/:id', getRoomById);
router.get('/:id/availability', checkRoomAvailability);
router.get('/:id/booked-dates', getRoomBookedDates);
router.post('/hotel/:hotelId', verifyToken, requireRole('super_admin', 'hotel_admin'), createRoom);
router.put('/:id', verifyToken, requireRole('super_admin', 'hotel_admin'), updateRoom);
router.delete('/:id', verifyToken, requireRole('super_admin', 'hotel_admin'), deleteRoom);
router.post(
  '/:id/images',
  verifyToken,
  requireRole('super_admin', 'hotel_admin'),
  (req, res, next) => multerUpload(req, res, (err) => err ? handleMulterError(err, req, res, next) : next()),
  processUploads('rooms'),
  uploadRoomImages
);
router.patch('/:id/toggle', verifyToken, requireRole('super_admin', 'hotel_admin'), toggleRoomAvailability);
router.get('/hotel/:hotelId/calendar', verifyToken, getHotelAvailabilityCalendar);

module.exports = router;
