const express = require('express');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const {
  getProfile,
  toggleAvailability,
  getOrders,
  getPendingOrders,
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
router.get('/orders', getOrders);
router.get('/orders/pending', getPendingOrders);
router.put('/orders/:orderId/accept', acceptOrder);
router.put('/orders/:orderId/deliver', markAsDelivered); // Cambiado: marcar como entregado
router.post('/recharge', requestRecharge);
router.get('/earnings', getEarningsReport);

module.exports = router;