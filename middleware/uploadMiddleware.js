const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const rateLimit = require('express-rate-limit');
const cloudinary = require('../config/cloudinary');

// Rate limiting: 20 uploads per hour per user/IP
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per window
  message: {
    success: false,
    message: 'Upload limit exceeded. You can only perform 20 file uploads per hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Check if Cloudinary is configured with actual credentials (not placeholders)
const isCloudinaryConfigured = 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_KEY !== 'your_cloudinary_api_key' &&
  !process.env.CLOUDINARY_API_KEY.includes('your_') &&
  process.env.DISABLE_CLOUDINARY !== 'true';

// Memory storage for Cloudinary, Disk storage for Local fallback
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

// Secure file validation helper (checks extensions, MIME-type, and double extensions)
const isAllowedExtension = (filename, mimetype) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  const ext = path.extname(filename).toLowerCase();
  const hasAllowedExt = allowedExtensions.includes(ext);
  const hasAllowedMime = allowedMimeTypes.includes(mimetype.toLowerCase());

  // Block double extension attacks (e.g. residentProof.png.exe or hotelImg.jpg.js)
  const parts = filename.split('.');
  if (parts.length > 2) {
    const dangerousExtensions = ['pdf', 'svg', 'exe', 'zip', 'js', 'html', 'sh', 'bat', 'vbs', 'scr'];
    const hasDangerous = parts.slice(1).some(part => dangerousExtensions.includes(part.toLowerCase()));
    if (hasDangerous) return false;
  }

  return hasAllowedExt && hasAllowedMime;
};

const fileFilter = (req, file, cb) => {
  if (isAllowedExtension(file.originalname, file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, JPEG, PNG, and WEBP image files are allowed. PDF and dangerous formats are rejected.'), false);
  }
};

const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `ag-residency/${folder}`
      },
      (error, result) => {
        if (error) reject(error);
        else resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
};

// Transformations helper generating Enterprise Responsive Sizes (Original, w1600 Large, w800 Medium, w300 Thumbnail)
const getTransformedUrls = (result) => {
  if (isCloudinaryConfigured) {
    return {
      publicId: result.public_id,
      original: result.secure_url,
      large: cloudinary.url(result.public_id, { width: 1600, crop: 'fill', quality: 'auto', fetch_format: 'auto', secure: true }),
      medium: cloudinary.url(result.public_id, { width: 800, crop: 'fill', quality: 'auto', fetch_format: 'auto', secure: true }),
      thumbnail: cloudinary.url(result.public_id, { width: 300, crop: 'fill', quality: 'auto', fetch_format: 'auto', secure: true })
    };
  } else {
    // Local storage fallback (return local paths across all sized properties)
    return {
      publicId: result.publicId,
      original: result.url,
      large: result.url,
      medium: result.url,
      thumbnail: result.url
    };
  }
};

const uploadOptions = {
  storage: isCloudinaryConfigured ? memoryStorage : diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  fileFilter,
};

const uploadHotelImages = multer(uploadOptions).array('images', 10);
const uploadRoomImages = multer(uploadOptions).array('images', 8);
const uploadSingleImage = multer(uploadOptions).single('image');
const uploadResidentProof = multer(uploadOptions).single('residentProof');

// Middleware to process uploads based on configuration and return multi-size responsive object
const processUploads = (folder) => async (req, res, next) => {
  try {
    const files = req.files || (req.file ? [req.file] : null);
    if (!files || files.length === 0) return next();

    if (isCloudinaryConfigured) {
      // Process RAM buffered files and upload to Cloudinary
      const uploaded = await Promise.all(
        files.map((file) => uploadToCloudinary(file.buffer, folder))
      );
      
      // Map to 4-sized responsive URLs
      const transformed = uploaded.map(img => getTransformedUrls(img));

      if (req.file) req.uploadedImages = transformed[0];
      else req.uploadedImages = transformed;
    } else {
      // Using local disk storage, map the local path across sizes
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host');
      const mapped = files.map(file => ({
        url: `${protocol}://${host}/uploads/${file.filename}`,
        publicId: file.filename
      }));

      // Map to 4-sized responsive URLs using helper
      const transformed = mapped.map(img => getTransformedUrls(img));

      if (req.file) req.uploadedImages = transformed[0];
      else req.uploadedImages = transformed;
    }
    next();
  } catch (err) {
    next(err);
  }
};

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Max 5MB per file.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Too many files.' });
    }
  }
  if (err && err.message) {
    return res.status(400).json({ success: false, message: err.message });
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
  uploadRateLimiter,
  getTransformedUrls
};
