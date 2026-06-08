require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');

const isCloudinaryConfigured = 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_KEY !== 'your_cloudinary_api_key' &&
  !process.env.CLOUDINARY_API_KEY.includes('your_') &&
  process.env.DISABLE_CLOUDINARY !== 'true';

const getMigratedImage = (img) => {
  // Supports either old structure { url, publicId } or Mongoose subdocument
  const url = img.url || img.original;
  const publicId = img.publicId;

  if (!url) return null;

  // Simple local vs Cloudinary check
  const isLocal = !publicId || (!publicId.includes('/') && publicId.includes('.'));
  
  if (isCloudinaryConfigured && !isLocal) {
    return {
      publicId: publicId,
      original: url,
      large: cloudinary.url(publicId, { width: 1600, crop: 'fill', quality: 'auto', fetch_format: 'auto', secure: true }),
      medium: cloudinary.url(publicId, { width: 800, crop: 'fill', quality: 'auto', fetch_format: 'auto', secure: true }),
      thumbnail: cloudinary.url(publicId, { width: 300, crop: 'fill', quality: 'auto', fetch_format: 'auto', secure: true })
    };
  } else {
    // Local fallback
    return {
      publicId: publicId || 'local_migrated',
      original: url,
      large: url,
      medium: url,
      thumbnail: url
    };
  }
};

const runMigration = async () => {
  try {
    console.log('🔄 Connecting to MongoDB database...');
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'ag_residency',
    });
    console.log('✅ MongoDB Connected successfully!');
    console.log(`☁️ Cloudinary Mode: ${isCloudinaryConfigured ? 'ENABLED' : 'DISABLED (Local Fallback)'}`);

    // --- Migrate Hotels ---
    console.log('\n🏨 Fetching hotels for image migration...');
    const hotels = await Hotel.find({});
    console.log(`Found ${hotels.length} hotels.`);

    let migratedHotelsCount = 0;
    for (const hotel of hotels) {
      let isModified = false;

      // Cover image migration
      if (hotel.coverImage && hotel.coverImage.url && !hotel.coverImage.original) {
        const migratedCover = getMigratedImage(hotel.coverImage);
        if (migratedCover) {
          hotel.coverImage = migratedCover;
          isModified = true;
          console.log(`   └─ Migrated coverImage for Hotel: "${hotel.name}"`);
        }
      }

      // Gallery images array migration
      if (hotel.images && hotel.images.length > 0) {
        const newImagesList = [];
        let arrayModified = false;
        
        for (const img of hotel.images) {
          if (img.url && !img.original) {
            const migratedImg = getMigratedImage(img);
            if (migratedImg) {
              newImagesList.push(migratedImg);
              arrayModified = true;
            } else {
              newImagesList.push(img);
            }
          } else {
            newImagesList.push(img);
          }
        }
        
        if (arrayModified) {
          hotel.images = newImagesList;
          isModified = true;
          console.log(`   └─ Migrated ${hotel.images.length} gallery images for Hotel: "${hotel.name}"`);
        }
      }

      if (isModified) {
        // Disable pre-save validators that might interfere with manual migration edits
        await hotel.save({ validateBeforeSave: false });
        migratedHotelsCount++;
      }
    }
    console.log(`🎉 Migrated ${migratedHotelsCount} hotels.`);

    // --- Migrate Rooms ---
    console.log('\n🛏️ Fetching rooms for image migration...');
    const rooms = await Room.find({});
    console.log(`Found ${rooms.length} rooms.`);

    let migratedRoomsCount = 0;
    for (const room of rooms) {
      let isModified = false;

      // Gallery images array migration
      if (room.images && room.images.length > 0) {
        const newImagesList = [];
        let arrayModified = false;
        
        for (const img of room.images) {
          if (img.url && !img.original) {
            const migratedImg = getMigratedImage(img);
            if (migratedImg) {
              newImagesList.push(migratedImg);
              arrayModified = true;
            } else {
              newImagesList.push(img);
            }
          } else {
            newImagesList.push(img);
          }
        }
        
        if (arrayModified) {
          room.images = newImagesList;
          isModified = true;
          console.log(`   └─ Migrated ${room.images.length} gallery images for Room: "${room.name}"`);
        }
      }

      if (isModified) {
        await room.save({ validateBeforeSave: false });
        migratedRoomsCount++;
      }
    }
    console.log(`🎉 Migrated ${migratedRoomsCount} rooms.`);

    console.log('\n✅ Image and schema migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration script failed with error:', error.message);
    process.exit(1);
  }
};

runMigration();
