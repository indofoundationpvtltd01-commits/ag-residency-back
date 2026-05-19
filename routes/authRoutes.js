const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, logout, refreshToken, forgotPassword, verifyOTP, resetPassword, getMe, updateMe, changePassword } = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const { validate, registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../middleware/validateMiddleware');

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' } });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { success: false, message: 'Too many OTP attempts. Try again in 15 minutes.' } });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { success: false, message: 'Too many accounts created. Try again in an hour.' } });

router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', verifyToken, logout);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/verify-otp', otpLimiter, verifyOTP);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);
router.get('/me', verifyToken, getMe);
router.put('/me', verifyToken, updateMe);
router.put('/change-password', verifyToken, changePassword);

module.exports = router;
