const express = require('express');
const { 
  getAllHotels, getHotelById, getHotelBySlug, createHotel, updateHotel, deleteHotel, 
  uploadHotelImages, deleteHotelImage, getDistinctCities, getLocationSuggestions, checkAvailability,
  getPendingHotelUpdates, approveHotelUpdate, rejectHotelUpdate, uploadImagesOnly
} = require('../controllers/hotelController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { uploadHotelImages: multerUpload, processUploads, handleMulterError } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.get('/', getAllHotels);
router.get('/locations/cities', getDistinctCities);
router.get('/locations/suggestions', getLocationSuggestions);
router.get('/availability/check', checkAvailability);
router.post(
  '/upload-images',
  verifyToken,
  requireRole('super_admin', 'hotel_admin'),
  (req, res, next) => multerUpload(req, res, (err) => err ? handleMulterError(err, req, res, next) : next()),
  processUploads('hotels'),
  uploadImagesOnly
);

// Admin approval routes (Must be BEFORE generic :id routes)
router.get('/admin/pending-updates', verifyToken, requireRole('super_admin'), getPendingHotelUpdates);
router.patch('/admin/approve-update/:updateId', verifyToken, requireRole('super_admin'), approveHotelUpdate);
router.patch('/admin/reject-update/:updateId', verifyToken, requireRole('super_admin'), rejectHotelUpdate);

router.get('/slug/:slug', getHotelBySlug);
router.get('/:id', getHotelById);
router.post('/', verifyToken, requireRole('super_admin'), createHotel);
router.put('/:id', verifyToken, requireRole('super_admin', 'hotel_admin'), updateHotel);
router.delete('/:id', verifyToken, requireRole('super_admin'), deleteHotel);
router.post(
  '/:id/images',
  verifyToken,
  requireRole('super_admin', 'hotel_admin'),
  (req, res, next) => multerUpload(req, res, (err) => err ? handleMulterError(err, req, res, next) : next()),
  processUploads('hotels'),
  uploadHotelImages
);
router.delete('/:id/images/:publicId', verifyToken, requireRole('super_admin', 'hotel_admin'), deleteHotelImage);

module.exports = router;
