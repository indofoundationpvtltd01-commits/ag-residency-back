const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({ success: false, message: messages });
    }
    next(err);
  }
};

// Auth schemas
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// Booking schema
const bookingSchema = z.object({
  room: z.string().min(1, 'Room ID is required'),
  hotel: z.string().min(1, 'Hotel ID is required'),
  checkIn: z.string().min(1, 'Check-in date is required'),
  checkOut: z.string().min(1, 'Check-out date is required'),
  numberOfGuests: z.number().min(1).optional(),
  guestName: z.string().min(1, 'Guest name is required'),
  guestEmail: z.string().email('Valid email required'),
  guestPhone: z.string().optional(),
  specialRequests: z.string().optional(),
});

// Hotel schema
const hotelSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  city: z.string().min(2, 'City is required'),
  address: z.string().min(5, 'Address is required'),
  description: z.string().min(10, 'Description is required'),
  starRating: z.number().min(1).max(5).optional(),
  amenities: z.array(z.string()).optional(),
  policies: z.array(z.string()).optional(),
});

// Room schema
const roomSchema = z.object({
  hotel: z.string().min(1, 'Hotel ID is required'),
  roomNumber: z.string().min(1, 'Room number is required'),
  type: z.enum(['Standard', 'Deluxe', 'Executive', 'Suite'], {
    errorMap: () => ({ message: 'Invalid room type' }),
  }),
  price: z.number().positive('Price must be positive'),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  amenities: z.array(z.string()).optional(),
  description: z.string().optional(),
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  bookingSchema,
  hotelSchema,
  roomSchema,
};
