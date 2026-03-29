const Order = require('../models/Order');
const Rating = require('../models/Rating');
const User = require('../models/User');

const createOrder = async (req, res) => {
  try {
    const { description, pickupAddress, deliveryAddress } = req.body;
    const order = await Order.create({
      client: req.user._id,
      description,
      pickupAddress,
      deliveryAddress,
      status: 'pending',
    });
    const io = req.app.get('io');
    io.emit('newOrder', order);
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getClientOrders = async (req, res) => {
  try {
    const orders = await Order.find({ client: req.user._id })
      .populate('mandadito', 'name phone profilePhoto rating')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const confirmReceived = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    if (order.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado para esta orden' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ 
        message: 'El mandadito aún no ha marcado el pedido como entregado',
        currentStatus: order.status 
      });
    }

    order.clientConfirmedAt = new Date();
    order.status = 'completed';
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);

    res.json({ 
      order, 
      message: '¡Gracias por confirmar! El pedido ha sido completado.' 
    });
  } catch (error) {
    console.error('Error en confirmReceived:', error);
    res.status(500).json({ message: error.message });
  }
};

const rateMandadito = async (req, res) => {
  try {
    const { orderId, score, comment } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.status !== 'completed') return res.status(400).json({ message: 'La orden debe estar completada para calificar' });
    if (order.client.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'No autorizado' });

    const existingRating = await Rating.findOne({ order: orderId });
    if (existingRating) return res.status(400).json({ message: 'Ya calificaste esta orden' });

    const rating = await Rating.create({
      order: orderId,
      mandadito: order.mandadito,
      client: req.user._id,
      score,
      comment: comment || '',
    });

    const allRatings = await Rating.find({ mandadito: order.mandadito });
    const avg = allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length;
    await User.findByIdAndUpdate(order.mandadito, { 
      rating: avg, 
      totalRatings: allRatings.length 
    });

    res.status(201).json(rating);
  } catch (error) {
    console.error('Error en rateMandadito:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  getClientOrders,
  confirmReceived,
  rateMandadito,
};