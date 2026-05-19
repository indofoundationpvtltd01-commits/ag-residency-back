const express = require('express');
const { createOrder, verifyPayment, getPaymentReceipt, refundPayment } = require('../controllers/paymentController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/create-order', verifyToken, requireRole('customer'), createOrder);
router.post('/verify', verifyToken, requireRole('customer'), verifyPayment);
router.get('/:bookingId/receipt', verifyToken, getPaymentReceipt);
router.post('/:bookingId/refund', verifyToken, requireRole('super_admin'), refundPayment);

module.exports = router;
