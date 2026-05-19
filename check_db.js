const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Hotel = require('../server/models/Hotel');

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const checkData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    const hotels = await Hotel.find({});
    console.log(`Found ${hotels.length} hotels`);
    hotels.forEach(h => {
        console.log(`- ${h.name} in ${h.city} (isActive: ${h.isActive})`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkData();
