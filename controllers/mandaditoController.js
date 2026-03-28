const Order = require('../models/Order');
const User = require('../models/User');
const Deposit = require('../models/Deposit');

const getProfile = async (req, res) => {
  try {
    const mandadito = await User.findById(req.user._id).select('-password');
    res.json(mandadito);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const toggleAvailability = async (req, res) => {
  try {
    req.user.isAvailable = !req.user.isAvailable;
    await req.user.save();
    res.json({ isAvailable: req.user.isAvailable });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ mandadito: req.user._id })
      .populate('client', 'name phone')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPendingOrders = async (req, res) => {
  try {
    const orders = await Order.find({ status: 'pending' })
      .populate('client', 'name phone')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const acceptOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.status !== 'pending') return res.status(400).json({ message: 'Orden no disponible' });
    if (req.user.credit < order.amount) return res.status(400).json({ message: 'Crédito insuficiente' });

    order.mandadito = req.user._id;
    order.status = 'accepted';
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const completeOrderByMandadito = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (!order.mandadito || order.mandadito.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'No autorizado' });
    if (order.status === 'mandadito_completed' || order.status === 'finished') return res.status(400).json({ message: 'Ya completaste' });
    if (req.user.credit < order.amount) return res.status(400).json({ message: 'Crédito insuficiente' });

    req.user.credit -= order.amount;
    await req.user.save();

    order.mandaditoCompletedAt = new Date();
    order.status = order.status === 'client_completed' ? 'finished' : 'mandadito_completed';
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const requestRecharge = async (req, res) => {
  try {
    const { amount, reference } = req.body;
    if (!amount || amount < 1) return res.status(400).json({ message: 'Monto inválido' });
    if (!reference) return res.status(400).json({ message: 'Referencia requerida' });

    const deposit = await Deposit.create({
      mandadito: req.user._id,
      amount,
      reference,
    });

    res.json({ message: 'Solicitud de recarga enviada', deposit });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEarningsReport = async (req, res) => {
  try {
    const orders = await Order.find({ mandadito: req.user._id, status: 'finished' });
    const totalEarnings = orders.length * 5;
    res.json({ totalOrders: orders.length, totalEarnings, orders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProfile,
  toggleAvailability,
  getOrders,
  getPendingOrders,
  acceptOrder,
  completeOrderByMandadito,
  requestRecharge,
  getEarningsReport,
};