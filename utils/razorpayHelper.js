const Razorpay = require('razorpay');
const crypto = require('crypto');

let razorpay = null;

const hasKeys = process.env.RAZORPAY_KEY_ID && 
                process.env.RAZORPAY_KEY_ID !== 'your_razorpay_key_id' && 
                process.env.RAZORPAY_KEY_SECRET && 
                process.env.RAZORPAY_KEY_SECRET !== 'your_razorpay_key_secret';

if (hasKeys) {
  try {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  } catch (err) {
    console.error('⚠️ Failed to initialize Razorpay client:', err.message);
  }
} else {
  console.warn('⚠️ Razorpay credentials not configured or set to placeholder values. Online payments will be disabled.');
}

const createRazorpayOrder = async ({ amount, bookingId, hotelName }) => {
  if (!razorpay) {
    throw new Error('Razorpay client is not initialized. Online payments are disabled.');
  }
  const options = {
    amount: Math.round(amount * 100), // Convert to paise
    currency: 'INR',
    receipt: `receipt_${bookingId}`,
    notes: { bookingId: bookingId.toString(), hotelName },
  };
  return await razorpay.orders.create(options);
};

const verifyPaymentSignature = (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  if (!hasKeys) {
    return false;
  }
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expectedSignature === razorpaySignature;
};

const initiateRefund = async (paymentId, amount) => {
  if (!razorpay) {
    throw new Error('Razorpay client is not initialized. Refunds cannot be processed.');
  }
  return await razorpay.payments.refund(paymentId, {
    amount: Math.round(amount * 100),
  });
};

module.exports = { razorpay, createRazorpayOrder, verifyPaymentSignature, initiateRefund };
