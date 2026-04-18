const express = require('express');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const {
  getProfile,
  toggleAvailability,
  updateWorkSchedule,
  getOrders,
  getOrderDetails,
  getPendingOrders,
  acceptDirectOrder,
  rejectDirectOrder,
  acceptOrder,
  markAsDelivered,
  requestRecharge,
  getEarningsReport,
  toggleShareLocation,
  updateLocation
} = require('../controllers/mandaditoController');

const router = express.Router();

router.use(protect);
router.use(roleCheck('mandadito'));

router.get('/profile', getProfile);
router.put('/availability', toggleAvailability);
router.put('/schedule', updateWorkSchedule);
router.get('/orders', getOrders);
router.get('/orders/:orderId', getOrderDetails);
router.get('/orders/pending', getPendingOrders);  // ESTA ES LA RUTA
router.put('/orders/:orderId/accept-direct', acceptDirectOrder);
router.put('/orders/:orderId/reject-direct', rejectDirectOrder);
router.put('/orders/:orderId/accept', acceptOrder);
router.put('/orders/:orderId/deliver', markAsDelivered);
router.post('/recharge', requestRecharge);
router.get('/earnings', getEarningsReport);
router.put('/share-location/toggle', toggleShareLocation);
router.post('/location', updateLocation);

module.exports = router;