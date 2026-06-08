const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

const isConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' &&
  process.env.DISABLE_CLOUDINARY !== 'true';

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  logger.info(`☁️ Cloudinary CDN: Active [Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}]`);
} else {
  logger.warn(`☁️ Cloudinary CDN: Disabled (Using local uploads fallback)`);
}

module.exports = cloudinary;
