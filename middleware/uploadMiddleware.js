const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const cloudinary = require('../config/cloudinary');

// Check if Cloudinary is configured with actual credentials (not placeholders)
const isCloudinaryConfigured = 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_KEY !== 'your_cloudinary_api_key' &&
  !process.env.CLOUDINARY_API_KEY.includes('your_') &&
  process.env.DISABLE_CLOUDINARY !== 'true';

// Memory storage for Cloudinary, Disk storage for Local
const memoryStorage = multer.memoryStorage();

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `ag-residency/${folder}`,
        transformation: [{ width: 1200, height: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
};

const uploadOptions = {
  storage: isCloudinaryConfigured ? memoryStorage : diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
};

const uploadHotelImages = multer(uploadOptions).array('images', 10);
const uploadRoomImages = multer(uploadOptions).array('images', 8);
const uploadSingleImage = multer(uploadOptions).single('image');

const uploadResidentProof = multer(uploadOptions).single('residentProof');

// Middleware to process uploads based on configuration
const processUploads = (folder) => async (req, res, next) => {
  try {
    // Check if we have files (array) or a single file (single upload)
    const files = req.files || (req.file ? [req.file] : null);
    if (!files || files.length === 0) return next();

    if (isCloudinaryConfigured) {
      // Process buffered files and upload to Cloudinary
      const uploaded = await Promise.all(
        files.map((file) => uploadToCloudinary(file.buffer, folder))
      );
      
      // If single file, set single uploadedImages, else array
      if (req.file) req.uploadedImages = uploaded[0];
      else req.uploadedImages = uploaded;
    } else {
      // Using local disk storage, just map the paths to URLs
      // Use x-forwarded-proto if behind proxy, or protocol reported by req
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host');
      const mapped = files.map(file => ({
        url: `${protocol}://${host}/uploads/${file.filename}`,
        publicId: file.filename // Using filename as local ID for deletion
      }));

      if (req.file) req.uploadedImages = mapped[0];
      else req.uploadedImages = mapped;
    }
    next();
  } catch (err) {
    next(err);
  }
};

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Max 5MB per image.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Too many files.' });
    }
  }
  next(err);
};

module.exports = {
  uploadHotelImages,
  uploadRoomImages,
  uploadSingleImage,
  uploadResidentProof,
  processUploads,
  uploadToCloudinary,
  handleMulterError,
};
