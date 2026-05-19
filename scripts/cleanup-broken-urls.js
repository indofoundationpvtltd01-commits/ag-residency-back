const mongoose = require('mongoose');
require('dotenv').config();
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');

const cleanupBrokenUrls = async () => {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.');

    const brokenPatterns = [
      'ag-residency-server-production.up.railway.app/uploads',
      'localhost:5000/uploads'
    ];

    console.log('🔍 Searching for Hotels with broken local/ephemeral image URLs...');
    
    const hotels = await Hotel.find({
      $or: [
        { 'coverImage.url': { $regex: brokenPatterns.join('|') } },
        { 'images.url': { $regex: brokenPatterns.join('|') } }
      ]
    });

    console.log(`Found ${hotels.length} hotels with broken URLs.`);

    for (const hotel of hotels) {
      let modified = false;

      // Check cover image
      if (hotel.coverImage?.url && brokenPatterns.some(p => hotel.coverImage.url.includes(p))) {
        console.log(`  - Clearing broken cover image for: ${hotel.name}`);
        hotel.coverImage = undefined;
        modified = true;
      }

      // Check gallery images
      const originalCount = hotel.images.length;
      hotel.images = hotel.images.filter(img => !img.url || !brokenPatterns.some(p => img.url.includes(p)));
      if (hotel.images.length !== originalCount) {
        console.log(`  - Removed ${originalCount - hotel.images.length} broken gallery images for: ${hotel.name}`);
        modified = true;
      }

      if (modified) {
        await hotel.save();
      }
    }

    console.log('\n🔍 Searching for Rooms with broken local/ephemeral image URLs...');
    const rooms = await Room.find({
      'images.url': { $regex: brokenPatterns.join('|') }
    });

    console.log(`Found ${rooms.length} rooms with broken URLs.`);

    for (const room of rooms) {
      const originalCount = room.images.length;
      room.images = room.images.filter(img => !img.url || !brokenPatterns.some(p => img.url.includes(p)));
      
      if (room.images.length !== originalCount) {
        console.log(`  - Removed ${originalCount - room.images.length} broken images for Room: ${room.name}`);
        await room.save();
      }
    }

    console.log('\n🎉 Cleanup completed! Broken links have been removed.');
    console.log('💡 Now the "Customer Side" will show beautiful fallback images instead of broken ones.');
    console.log('💡 You can now re-upload real images in the Admin Panel whenever you are ready.');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  }
};

cleanupBrokenUrls();
