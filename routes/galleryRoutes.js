const express = require('express');
const {
  getGalleryItems,
  getSuperGalleryItems,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
} = require('../controllers/galleryController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { uploadSingleImage, processUploads, handleMulterError } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Public route: Get active gallery items
router.get('/', getGalleryItems);

// Super Admin routes
router.get('/super', verifyToken, requireRole('super_admin'), getSuperGalleryItems);

router.post(
  '/super',
  verifyToken,
  requireRole('super_admin'),
  (req, res, next) => uploadSingleImage(req, res, (err) => err ? handleMulterError(err, req, res, next) : next()),
  processUploads('gallery'),
  createGalleryItem
);

router.put(
  '/super/:id',
  verifyToken,
  requireRole('super_admin'),
  (req, res, next) => uploadSingleImage(req, res, (err) => err ? handleMulterError(err, req, res, next) : next()),
  processUploads('gallery'),
  updateGalleryItem
);

router.delete('/super/:id', verifyToken, requireRole('super_admin'), deleteGalleryItem);

module.exports = router;
