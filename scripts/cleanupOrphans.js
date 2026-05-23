const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');

dotenv.config({ path: path.join(__dirname, '../.env') });

const cleanupOrphans = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🚀 Connected successfully.');

    // 1. Find all active hotel IDs
    const hotels = await Hotel.find({}, '_id');
    const hotelIds = hotels.map(h => h._id.toString());
    console.log(`🏨 Found ${hotelIds.length} active hotels in the database.`);

    // 2. Find and delete orphan rooms
    const rooms = await Room.find({});
    let deletedRoomsCount = 0;
    
    for (const room of rooms) {
      if (!room.hotel || !hotelIds.includes(room.hotel.toString())) {
        console.log(`🧹 Deleting orphan room: "${room.name}" (ID: ${room._id}, Hotel ID: ${room.hotel})`);
        await room.deleteOne();
        deletedRoomsCount++;
      }
    }
    console.log(`✨ Deleted ${deletedRoomsCount} orphaned rooms.`);

    // 3. Find and fix users with invalid hotel assignments
    const users = await User.find({ role: 'hotel_admin' });
    let fixedUsersCount = 0;

    for (const user of users) {
      if (user.assignedHotel && !hotelIds.includes(user.assignedHotel.toString())) {
        console.log(`👤 Unassigning deleted hotel from user: "${user.name}" (ID: ${user._id}, Hotel ID: ${user.assignedHotel})`);
        user.assignedHotel = undefined;
        await user.save();
        fixedUsersCount++;
      }
    }
    console.log(`✨ Cleaned up ${fixedUsersCount} user hotel assignments.`);

    console.log('✅ Cleanup completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  }
};

cleanupOrphans();
