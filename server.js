require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const path = require('path');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');

const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/authRoutes');
const hotelRoutes = require('./routes/hotelRoutes');
const roomRoutes = require('./routes/roomRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const seoRoutes = require('./routes/seoRoutes');

const app = express();

// Trust proxy for secure cookies and protocol detection
app.set('trust proxy', 1);

// Connect DB
connectDB();

// Global middleware
app.use(compression());

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(mongoSanitize());
app.use(hpp());

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Too many requests from this IP' },
});
app.use('/api', globalLimiter);

// CORS
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://www.agrooms.in',
  'https://agrooms.in',
  'https://ag-residency-client.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

// Add origins from env variable if provided (space or comma separated)
if (process.env.ALLOWED_ORIGINS) {
  const envOrigins = process.env.ALLOWED_ORIGINS.split(/[ ,]+/).filter(Boolean);
  allowedOrigins.push(...envOrigins);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In production, we should be strict
    const isAllowed = allowedOrigins.includes(origin) || 
                     (process.env.NODE_ENV === 'production' && origin.endsWith('.agrooms.in')) ||
                     (process.env.NODE_ENV === 'production' && origin.endsWith('.vercel.app'));
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.error(`CORS Blocked: Origin ${origin} not in whitelist`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Pragma'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// HTTP logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/hotels', hotelRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);

// SEO Routes (Dynamic Sitemap)
app.use('/', seoRoutes);

// Static files (for local uploads)
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AG Residency Backend Live Successfully 🚀"
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'AG Residency API is running', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`🚀 AG Residency API server running on port ${PORT} [${process.env.NODE_ENV}]`);
});

// Graceful shutdown
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

module.exports = app;
