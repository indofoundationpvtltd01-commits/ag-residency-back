const crypto = require('crypto');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/generateToken');
const { sendEmail } = require('../utils/sendEmail');
const { AppError } = require('../middleware/errorHandler');

// @POST /api/v1/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return next(new AppError('Email already registered', 409));

    const user = await User.create({ name, email, password, phone });
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    await User.findByIdAndUpdate(user._id, { refreshToken });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      accessToken,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/auth/login
const login = async (req, res, next) => {
  try {
    let { email, password } = req.body;
    
    // Normalize short usernames to standard seeded email addresses for seamless UX
    if (email) {
      const trimmed = email.trim().toLowerCase();
      if (trimmed === 'superadmin') email = 'superadmin@agresidency.com';
      else if (trimmed === 'manager') email = 'manager@agresidency.com';
      else if (trimmed === 'guest') email = 'guest@gmail.com';
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Invalid email or password', 401));
    }
    if (!user.isActive) return next(new AppError('Account has been deactivated', 403));

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    await User.findByIdAndUpdate(user._id, { refreshToken });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, assignedHotel: user.assignedHotel },
    });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/auth/logout
const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/auth/refresh-token
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return next(new AppError('No refresh token', 401));
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== token) return next(new AppError('Invalid refresh token', 403));
    const newAccessToken = generateAccessToken(user._id, user.role);
    res.json({ success: true, accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return next(new AppError('No account found with that email', 404));

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await User.findByIdAndUpdate(user._id, {
      passwordResetOTPHash: otpHash,
      passwordResetExpiry: expiry,
    });

    await sendEmail({
      to: email,
      subject: 'AG Residency — Password Reset OTP',
      templateName: 'passwordReset.html',
      replacements: { name: user.name, otp, validity: '10 minutes' },
    });

    res.json({ success: true, message: 'OTP sent to your email address' });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/auth/verify-otp
const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email }).select('+passwordResetOTPHash +passwordResetExpiry');
    if (!user) return next(new AppError('User not found', 404));
    if (!user.passwordResetOTPHash || !user.passwordResetExpiry) {
      return next(new AppError('No OTP request found', 400));
    }
    if (user.passwordResetExpiry < new Date()) {
      return next(new AppError('OTP has expired. Please request a new one.', 400));
    }
    const hash = crypto.createHash('sha256').update(otp).digest('hex');
    if (hash !== user.passwordResetOTPHash) return next(new AppError('Invalid OTP', 400));
    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email }).select('+passwordResetOTPHash +passwordResetExpiry');
    if (!user) return next(new AppError('User not found', 404));
    if (user.passwordResetExpiry < new Date()) return next(new AppError('OTP expired', 400));
    const hash = crypto.createHash('sha256').update(otp).digest('hex');
    if (hash !== user.passwordResetOTPHash) return next(new AppError('Invalid OTP', 400));

    user.password = newPassword;
    user.passwordResetOTPHash = undefined;
    user.passwordResetExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. Please login.' });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/auth/me
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// @PUT /api/v1/auth/me
const updateMe = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone },
      { new: true, runValidators: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// @PUT /api/v1/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return next(new AppError('Current password is incorrect', 400));
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, refreshToken, forgotPassword, verifyOTP, resetPassword, getMe, updateMe, changePassword };
