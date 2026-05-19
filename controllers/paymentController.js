const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { createRazorpayOrder, verifyPaymentSignature, initiateRefund } = require('../utils/razorpayHelper');
const { sendEmail } = require('../utils/sendEmail');
const { AppError } = require('../middleware/errorHandler');

// @POST /api/v1/payments/create-order
const createOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId).populate('hotel', 'name');
    if (!booking) return next(new AppError('Booking not found', 404));
    if (booking.customer.toString() !== req.user._id.toString()) return next(new AppError('Access denied', 403));
    if (booking.paymentStatus === 'paid') return next(new AppError('Already paid', 400));

    const order = await createRazorpayOrder({
      amount: booking.totalAmount,
      bookingId: booking._id,
      hotelName: booking.hotel.name,
    });

    const payment = await Payment.create({
      booking: bookingId,
      customer: req.user._id,
      razorpayOrderId: order.id,
      amount: order.amount,
      receipt: order.receipt,
    });

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        paymentId: payment._id,
        key: process.env.RAZORPAY_KEY_ID,
        bookingId,
        prefill: {
          name: req.user.name,
          email: req.user.email,
          contact: req.user.phone || '',
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/payments/verify
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body;

    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) return next(new AppError('Payment verification failed. Invalid signature.', 400));

    const payment = await Payment.findOne({ razorpayOrderId });
    if (!payment) return next(new AppError('Payment record not found', 404));
    if (payment.booking.toString() !== bookingId) {
      return next(new AppError('Payment does not belong to this booking', 400));
    }

    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.status = 'paid';
    await payment.save();

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { paymentStatus: 'paid', paymentId: payment._id, status: 'confirmed' },
      { new: true }
    ).populate('hotel', 'name city').populate('room', 'name roomType');

    // Send confirmation email
    sendEmail({
      to: booking.guestEmail,
      subject: 'AG Residency — Payment Confirmed & Booking Confirmed!',
      templateName: 'paymentReceipt.html',
      replacements: {
        guestName: booking.guestName,
        paymentId: razorpayPaymentId,
        bookingId: booking._id.toString(),
        hotelName: booking.hotel.name,
        checkIn: booking.checkIn.toDateString(),
        checkOut: booking.checkOut.toDateString(),
        nights: booking.nights,
        amount: (payment.amount / 100).toLocaleString('en-IN'),
        date: new Date().toDateString(),
      },
    }).catch((err) => {
      console.error(`📧 Failed to send payment confirmation email to ${booking.guestEmail}:`, err.message);
    });

    res.json({ success: true, message: 'Payment verified! Booking confirmed.', data: { payment, booking } });
  } catch (err) {
    next(err);
  }
};

// @GET /api/v1/payments/:bookingId/receipt
const getPaymentReceipt = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId).populate('paymentId').populate('hotel', 'name city').populate('room', 'name roomType');
    if (!booking) return next(new AppError('Booking not found', 404));
    const isOwner = booking.customer.toString() === req.user._id.toString();
    const isAdmin = ['hotel_admin', 'super_admin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return next(new AppError('Access denied', 403));
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// @POST /api/v1/payments/:bookingId/refund
const refundPayment = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId).populate('paymentId');
    if (!booking) return next(new AppError('Booking not found', 404));
    if (!booking.paymentId || booking.paymentId.status !== 'paid') {
      return next(new AppError('No paid payment found for refund', 400));
    }
    const refund = await initiateRefund(booking.paymentId.razorpayPaymentId, booking.totalAmount);
    await Payment.findByIdAndUpdate(booking.paymentId._id, { status: 'refunded' });
    await Booking.findByIdAndUpdate(booking._id, { paymentStatus: 'refunded' });
    res.json({ success: true, message: 'Refund initiated', data: refund });
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrder, verifyPayment, getPaymentReceipt, refundPayment };
