const mongoose = require('mongoose');
require('dotenv').config();
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');

const fixImageUrls = async () => {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.');

    const oldPrefix = 'http://ag-residency-server-production.up.railway.app';
    const newPrefix = 'https://ag-residency-server-production.up.railway.app';

    console.log('🔍 Searching for Hotels with insecure image URLs...');
    const hotels = await Hotel.find({
      $or: [
        { 'coverImage.url': { $regex: oldPrefix } },
        { 'images.url': { $regex: oldPrefix } }
      ]
    });

    console.log(`Found ${hotels.length} hotels to update.`);

    for (const hotel of hotels) {
      if (hotel.coverImage?.url?.startsWith(oldPrefix)) {
        hotel.coverImage.url = hotel.coverImage.url.replace(oldPrefix, newPrefix);
      }
      
      hotel.images = hotel.images.map(img => {
        if (img.url?.startsWith(oldPrefix)) {
          return { ...img, url: img.url.replace(oldPrefix, newPrefix) };
        }
        return img;
      });

      await hotel.save();
      console.log(`✅ Updated Hotel: ${hotel.name}`);
    }

    console.log('🔍 Searching for Rooms with insecure image URLs...');
    const rooms = await Room.find({
      'images.url': { $regex: oldPrefix }
    });

    console.log(`Found ${rooms.length} rooms to update.`);

    for (const room of rooms) {
      room.images = room.images.map(img => {
        if (img.url?.startsWith(oldPrefix)) {
          return { ...img, url: img.url.replace(oldPrefix, newPrefix) };
        }
        return img;
      });

      await room.save();
      console.log(`✅ Updated Room: ${room.name} (${room._id})`);
    }

    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
};

fixImageUrls();
