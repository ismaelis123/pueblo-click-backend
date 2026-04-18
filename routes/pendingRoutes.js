const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Ruta directa sin pasar por el controlador
router.get('/', protect, roleCheck('mandadito'), async (req, res) => {
  console.log('🔍 [DIRECTO] Buscando órdenes para:', req.user._id);
  
  try {
    const orders = await Order.find({ 
      $or: [
        { status: 'pending' },
        { status: 'pending_confirmation', mandadito: req.user._id }
      ]
    })
    .populate('client', 'name phone')
    .sort({ createdAt: -1 })
    .lean();
    
    console.log(`✅ [DIRECTO] Encontradas ${orders.length} órdenes`);
    res.json(orders);
  } catch (error) {
    console.error('❌ [DIRECTO] Error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;