const express = require('express');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const {
  getProfile,
  toggleAvailability,
  toggleShareLocation,
  updateLocation,
  getOrders,
  getPendingOrders,
  acceptDirectOrder,
  rejectDirectOrder,
  acceptOrder,
  markAsDelivered,
  requestRecharge,
  getEarningsReport,
} = require('../controllers/mandaditoController');

const router = express.Router();

router.use(protect);
router.use(roleCheck('mandadito'));

router.get('/profile', getProfile);
router.put('/availability', toggleAvailability);
router.put('/share-location/toggle', toggleShareLocation);
router.post('/location', updateLocation);
router.get('/orders', getOrders);
router.get('/orders/pending', getPendingOrders);
router.put('/orders/:orderId/accept-direct', acceptDirectOrder);
router.put('/orders/:orderId/reject-direct', rejectDirectOrder);
router.put('/orders/:orderId/accept', acceptOrder);
router.put('/orders/:orderId/deliver', markAsDelivered);
router.post('/recharge', requestRecharge);
router.get('/earnings', getEarningsReport);

module.exports = router;