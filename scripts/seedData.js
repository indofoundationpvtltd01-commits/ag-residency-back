const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');

dotenv.config({ path: path.join(__dirname, '../.env') });

const seedData = async () => {
  try {
    // 1. Connect to Database
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME || 'ag_residency'
    });
    console.log('🚀 Connected to MongoDB for seeding...');

    // 2. Clear existing data
    await User.deleteMany();
    await Hotel.deleteMany();
    await Room.deleteMany();
    console.log('🧹 Cleared existing data...');

    // 3. Create Super Admin User
    await User.create({
      name: 'Super Admin',
      email: 'superadmin@agresidency.com',
      password: 'password123',
      phone: '9876543210',
      role: 'super_admin'
    });

    console.log('👤 Super Admin User Created');
    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
};

seedData();
