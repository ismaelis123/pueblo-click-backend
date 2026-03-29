const express = require('express');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const {
  createOrder,
  getClientOrders,
  getAvailableMandaditos,
  getMandaditoProfile,
  confirmReceived,
  rateMandadito,
} = require('../controllers/clientController');

const router = express.Router();

router.use(protect);
router.use(roleCheck('client'));

router.post('/orders', createOrder);
router.get('/orders', getClientOrders);
router.get('/mandaditos', getAvailableMandaditos);
router.get('/mandaditos/:id', getMandaditoProfile);
router.put('/orders/:orderId/confirm', confirmReceived);
router.post('/rate', rateMandadito);

module.exports = router;