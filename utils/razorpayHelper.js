const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazorpayOrder = async ({ amount, bookingId, hotelName }) => {
  const options = {
    amount: Math.round(amount * 100), // Convert to paise
    currency: 'INR',
    receipt: `receipt_${bookingId}`,
    notes: { bookingId: bookingId.toString(), hotelName },
  };
  return await razorpay.orders.create(options);
};

const verifyPaymentSignature = (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expectedSignature === razorpaySignature;
};

const initiateRefund = async (paymentId, amount) => {
  return await razorpay.payments.refund(paymentId, {
    amount: Math.round(amount * 100),
  });
};

module.exports = { razorpay, createRazorpayOrder, verifyPaymentSignature, initiateRefund };
