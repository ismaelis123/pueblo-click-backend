const express = require('express');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const {
  createOrder,
  getClientOrders,
  confirmReceived,
  rateMandadito,
} = require('../controllers/clientController');

const router = express.Router();

// Todas las rutas requieren autenticación y rol de cliente
router.use(protect);
router.use(roleCheck('client'));

// Rutas de cliente
router.post('/orders', createOrder);
router.get('/orders', getClientOrders);
router.put('/orders/:orderId/confirm', confirmReceived);
router.post('/rate', rateMandadito);

module.exports = router;