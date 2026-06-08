const Gallery = require('../models/Gallery');
const { AppError } = require('../middleware/errorHandler');
const cloudinary = require('../config/cloudinary');

// @GET /api/v1/gallery
const getGalleryItems = async (req, res, next) => {
  try {
    const items = await Gallery.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/admin/super/gallery
const getSuperGalleryItems = async (req, res, next) => {
  try {
    const items = await Gallery.find().sort({ order: 1, createdAt: -1 }).populate('createdBy', 'name email');
    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/admin/super/gallery
const createGalleryItem = async (req, res, next) => {
  try {
    const { title, category, order, isActive } = req.body;
    
    if (!req.uploadedImages) {
      return next(new AppError('Please upload an image for the gallery', 400));
    }

    const item = await Gallery.create({
      title,
      category,
      order: order ? Number(order) : 0,
      isActive: isActive === 'false' ? false : true,
      image: req.uploadedImages, // from uploadMiddleware
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, message: 'Gallery image uploaded successfully', data: item });
  } catch (err) {
    next(err);
  }
};

// @PUT /api/v1/admin/super/gallery/:id
const updateGalleryItem = async (req, res, next) => {
  try {
    const { title, category, order, isActive } = req.body;
    
    const item = await Gallery.findById(req.params.id);
    if (!item) {
      return next(new AppError('Gallery item not found', 404));
    }

    if (title !== undefined) item.title = title;
    if (category !== undefined) item.category = category;
    if (order !== undefined) item.order = Number(order);
    if (isActive !== undefined) item.isActive = isActive;

    // Check if new image uploaded
    if (req.uploadedImages) {
      // Try to destroy the old cloudinary asset if not local fallback
      if (item.image && item.image.publicId && !item.image.publicId.endsWith('.jpg') && !item.image.publicId.endsWith('.png') && !item.image.publicId.endsWith('.webp')) {
        try {
          await cloudinary.uploader.destroy(item.image.publicId);
        } catch (error) {
          console.error('Failed to destroy Cloudinary image during gallery update:', error);
        }
      }
      item.image = req.uploadedImages;
    }

    await item.save();
    res.json({ success: true, message: 'Gallery item updated successfully', data: item });
  } catch (err) {
    next(err);
  }
};

// @DELETE /api/v1/admin/super/gallery/:id
const deleteGalleryItem = async (req, res, next) => {
  try {
    const item = await Gallery.findById(req.params.id);
    if (!item) {
      return next(new AppError('Gallery item not found', 404));
    }

    // Delete image asset from cloud / disk
    if (item.image && item.image.publicId) {
      const isLocal = item.image.publicId.endsWith('.jpg') || item.image.publicId.endsWith('.png') || item.image.publicId.endsWith('.webp') || item.image.publicId.includes('uploads/');
      if (!isLocal) {
        try {
          await cloudinary.uploader.destroy(item.image.publicId);
        } catch (error) {
          console.error('Failed to destroy Cloudinary image during gallery delete:', error);
        }
      } else {
        // local disk delete
        const fs = require('fs');
        const path = require('path');
        const localPath = path.join(__dirname, '../uploads', item.image.publicId);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }
    }

    await item.deleteOne();
    res.json({ success: true, message: 'Gallery item deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getGalleryItems,
  getSuperGalleryItems,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
};
