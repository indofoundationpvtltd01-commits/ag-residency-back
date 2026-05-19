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
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🚀 Connected to MongoDB for seeding...');

    // 2. Clear existing data
    await User.deleteMany();
    await Hotel.deleteMany();
    await Room.deleteMany();
    console.log('🧹 Cleared existing data...');

    // 3. Create Users
    const superAdmin = await User.create({
      name: 'Super Admin',
      email: 'superadmin@agresidency.com',
      password: 'password123',
      phone: '9876543210',
      role: 'super_admin'
    });

    const hotelAdmin = await User.create({
      name: 'Prem Kumar',
      email: 'manager@agresidency.com',
      password: 'password123',
      phone: '8765432109',
      role: 'hotel_admin'
    });

    const customer = await User.create({
      name: 'John Guest',
      email: 'guest@gmail.com',
      password: 'password123',
      phone: '7654321098',
      role: 'customer'
    });

    console.log('👤 Seed Users Created');

    // 4. Create Hotels
    const hotelsData = [
      {
        name: 'AG Residency Grand',
        description: 'Experience pure opulence at the AG Residency Grand. Nestled in the heart of the city, this architectural masterpiece offers panoramic city views, a world-class wellness spa, and curated dining experiences that redefine luxury.',
        city: 'Chennai',
        address: '12-A, Cathedral Road, Chennai - 600086',
        phone: '044-28114000',
        email: 'grand.chennai@agresidency.com',
        starRating: 5,
        amenities: ['WiFi', 'Parking', 'AC', 'Infinity Pool', 'Fine Dining', 'Gym', 'Spa'],
        managedBy: hotelAdmin._id,
        coverImage: { url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80', publicId: 'seed/hotel1' },
        location: { type: 'Point', coordinates: [80.244, 13.041] },
        slug: 'ag-residency-grand-chennai'
      },
      {
        name: 'AG Boutique T-Nagar',
        description: 'A contemporary urban sanctuary tailored for the modern traveler. AG Boutique blends minimalist design with high-tech amenities, situated just steps away from the city\'s premier shopping and business hubs.',
        city: 'Chennai',
        address: '45 South Boag Road, T-Nagar, Chennai - 600117',
        phone: '044-45001122',
        email: 'boutique.tnagar@agresidency.com',
        starRating: 4,
        amenities: ['WiFi', 'AC', 'Parking', 'Business Center', 'Rooftop Lounge'],
        managedBy: hotelAdmin._id,
        coverImage: { url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80', publicId: 'seed/hotel2' },
        location: { type: 'Point', coordinates: [80.241, 13.040] },
        slug: 'ag-boutique-t-nagar'
      },
      {
        name: 'AG Heritage Resort',
        description: 'Step into a world of timeless elegance at our Heritage Resort. Surrounded by lush landscapes, this property combines traditional Dravidian architecture with modern comforts, offering a peaceful escape from the urban hustle.',
        city: 'Coimbatore',
        address: 'Avinashi Road, Peelamedu, Coimbatore - 641004',
        phone: '0422-2571234',
        email: 'heritage.cbe@agresidency.com',
        starRating: 5,
        amenities: ['WiFi', 'Parking', 'AC', 'Pool', 'Garden Café', 'Yoga Center'],
        managedBy: hotelAdmin._id,
        coverImage: { url: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&q=80', publicId: 'seed/hotel3' },
        location: { type: 'Point', coordinates: [76.966, 11.016] },
        slug: 'ag-heritage-resort-coimbatore'
      },
      {
        name: 'AG Executive Suites OMR',
        description: 'The preferred destination for tech professionals and business executives. Strategically located on the IT Corridor, our suites offer spacious work areas, high-speed connectivity, and efficient service for long stays.',
        city: 'Chennai',
        address: '602 Old Mahabalipuram Rd, Sholinganallur, Chennai - 600119',
        phone: '044-66554433',
        email: 'omr.exec@agresidency.com',
        starRating: 4,
        amenities: ['High-speed WiFi', 'AC', 'Workspace', 'Laundry', 'Buffet Breakfast'],
        managedBy: hotelAdmin._id,
        coverImage: { url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80', publicId: 'seed/hotel4' },
        location: { type: 'Point', coordinates: [80.228, 12.891] },
        slug: 'ag-executive-suites-omr'
      },
      {
        name: 'AG Urban Stay Hyderabad',
        description: 'Vibrant, stylish, and centrally located in the heart of Gachibowli. AG Urban Stay is designed for those who love being amidst the city\'s energy without compromising on domestic comfort and security.',
        city: 'Hyderabad',
        address: 'Hitech City Road, Gachibowli, Hyderabad - 500032',
        phone: '040-44001122',
        email: 'urban.hyd@agresidency.com',
        starRating: 4,
        amenities: ['WiFi', 'Parking', 'AC', '24/7 Security', 'Fitness Pod'],
        managedBy: hotelAdmin._id,
        coverImage: { url: 'https://images.unsplash.com/photo-1618773928121-c32212887c3e?w=1200&q=80', publicId: 'seed/hotel5' },
        location: { type: 'Point', coordinates: [78.385, 17.444] },
        slug: 'ag-urban-stay-hyderabad'
      }
    ];

    const hotels = await Hotel.insertMany(hotelsData);
    console.log(`🏨 ${hotels.length} Hotels created`);

    // Link admin to first hotel
    await User.findByIdAndUpdate(hotelAdmin._id, { assignedHotel: hotels[0]._id });

    // 5. Create Rooms for each hotel
    for (const hotel of hotels) {
      const hotelRooms = [
        {
          hotel: hotel._id,
          name: 'Classic Deluxe Room',
          roomType: 'Deluxe',
          pricePerNight: hotel.starRating === 5 ? 5500 : 3800,
          maxOccupancy: 2,
          bedType: 'King',
          size: 320,
          amenities: ['AC', 'WiFi', 'Mini Bar', 'TV', 'Coffee Maker'],
          totalRooms: 15,
          isAvailable: true,
          images: [{ url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80', publicId: `seed/room_${hotel._id}_1` }],
          metaTitle: 'Classic Deluxe Room | AG Residency',
          metaDescription: 'Book our Classic Deluxe Room featuring modern amenities and exceptional comfort at AG Residency.'
        },
        {
          hotel: hotel._id,
          name: 'Executive Studio Suite',
          roomType: 'Suite',
          pricePerNight: hotel.starRating === 5 ? 8500 : 5200,
          maxOccupancy: 3,
          bedType: 'King',
          size: 450,
          amenities: ['AC', 'WiFi', 'Kitchenette', 'Work Station', 'Bathtub'],
          totalRooms: 5,
          isAvailable: true,
          images: [{ url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80', publicId: `seed/room_${hotel._id}_2` }],
          metaTitle: 'Executive Studio Suite | AG Residency',
          metaDescription: 'Experience luxury in our Executive Studio Suite with a workspace and kitchenette at AG Residency.'
        }
      ];
      
      await Room.create(hotelRooms);
      
      // Calculate and update minPrice
      const minPrice = Math.min(...hotelRooms.map(r => r.pricePerNight));
      await Hotel.findByIdAndUpdate(hotel._id, { minPrice });
    }
    console.log('🛌 Rooms created and minPrice updated for all hotels');

    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
};

seedData();
