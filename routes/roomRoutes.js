const express = require('express');
const { getRoomsByHotel, getRoomById, checkRoomAvailability, createRoom, updateRoom, deleteRoom, uploadRoomImages, toggleRoomAvailability, getHotelAvailabilityCalendar, getRoomBookedDates, validateRoomId } = require('../controllers/roomController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { uploadRoomImages: multerUpload, processUploads, handleMulterError } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.get('/hotel/:hotelId', getRoomsByHotel);
router.get('/:id', validateRoomId, getRoomById);
router.get('/:id/availability', validateRoomId, checkRoomAvailability);
router.get('/:id/booked-dates', validateRoomId, getRoomBookedDates);
router.post('/hotel/:hotelId', verifyToken, requireRole('super_admin', 'hotel_admin'), createRoom);
router.put('/:id', verifyToken, requireRole('super_admin', 'hotel_admin'), validateRoomId, updateRoom);
router.delete('/:id', verifyToken, requireRole('super_admin', 'hotel_admin'), validateRoomId, deleteRoom);
router.post(
  '/:id/images',
  verifyToken,
  requireRole('super_admin', 'hotel_admin'),
  validateRoomId,
  (req, res, next) => multerUpload(req, res, (err) => err ? handleMulterError(err, req, res, next) : next()),
  processUploads('rooms'),
  uploadRoomImages
);
router.patch('/:id/toggle', verifyToken, requireRole('super_admin', 'hotel_admin'), validateRoomId, toggleRoomAvailability);
router.get('/hotel/:hotelId/calendar', verifyToken, getHotelAvailabilityCalendar);

module.exports = router;
