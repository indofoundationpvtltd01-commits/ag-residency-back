const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Hotel = require('../models/Hotel');
const User = require('../models/User');

dotenv.config();

const checkDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const hotelCount = await Hotel.countDocuments();
    const userCount = await User.countDocuments();
    const hotels = await Hotel.find().select('name city isActive');
    const users = await User.find().select('name email role assignedHotel');
    
    console.log('--- DB Check ---');
    console.log('Hotel Count:', hotelCount);
    console.log('User Count:', userCount);
    console.log('\nHotels:');
    hotels.forEach(h => console.log(`- ${h.name} (${h.city}) [Active: ${h.isActive}]`));
    console.log('\nUsers:');
    users.forEach(u => console.log(`- ${u.name} (${u.email}) [Role: ${u.role}, Assigned: ${u.assignedHotel}]`));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkDB();
