const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const dbUri = process.env.MONGODB_URI || '';
    const redactedUri = dbUri.replace(/:([^@]+)@/, ':******@');
    
    logger.info(`🔌 Connecting to Database URI: ${redactedUri}`);

    const conn = await mongoose.connect(dbUri, {
      maxPoolSize: 10,
      dbName: process.env.DB_NAME || 'ag_residency',
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    logger.info(`📁 Active Database: ${conn.connection.name}`);
  } catch (error) {
    logger.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
