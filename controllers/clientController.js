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

const completeOrderByClient = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.client.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'No autorizado' });
    if (order.status === 'client_completed' || order.status === 'finished') return res.status(400).json({ message: 'Ya completaste esta orden' });

    order.clientCompletedAt = new Date();
    order.status = order.status === 'mandadito_completed' ? 'finished' : 'client_completed';
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const rateMandadito = async (req, res) => {
  try {
    const { orderId, score, comment } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.status !== 'finished') return res.status(400).json({ message: 'La orden debe estar finalizada' });
    if (order.client.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'No autorizado' });

    const existingRating = await Rating.findOne({ order: orderId });
    if (existingRating) return res.status(400).json({ message: 'Ya calificaste' });

    const rating = await Rating.create({
      order: orderId,
      mandadito: order.mandadito,
      client: req.user._id,
      score,
      comment: comment || '',
    });

    const allRatings = await Rating.find({ mandadito: order.mandadito });
    const avg = allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length;
    await User.findByIdAndUpdate(order.mandadito, { rating: avg, totalRatings: allRatings.length });

    res.status(201).json(rating);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  getClientOrders,
  completeOrderByClient,
  rateMandadito,
};