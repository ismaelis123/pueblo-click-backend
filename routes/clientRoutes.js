const express = require('express');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const {
  createOrder,
  getClientOrders,
  completeOrderByClient,
  rateMandadito,
} = require('../controllers/clientController');
const router = express.Router();

router.use(protect);
router.use(roleCheck('client'));

router.post('/orders', createOrder);
router.get('/orders', getClientOrders);
router.put('/orders/:orderId/complete', completeOrderByClient);
router.post('/rate', rateMandadito);

module.exports = router;