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

// MODIFICADO: Al aceptar, se descuenta el crédito inmediatamente
const acceptOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.status !== 'pending') return res.status(400).json({ message: 'Orden no disponible' });
    
    // Verificar crédito suficiente ANTES de aceptar
    if (req.user.credit < order.amount) {
      return res.status(400).json({ message: 'Crédito insuficiente. Recarga para aceptar mandados' });
    }

    // DESCONTAR CRÉDITO AL ACEPTAR
    req.user.credit -= order.amount;
    await req.user.save();

    order.mandadito = req.user._id;
    order.status = 'accepted';
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);

    res.json({ 
      order, 
      creditRestante: req.user.credit,
      message: `Orden aceptada. Se descontaron C$${order.amount} de tu crédito.`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// MODIFICADO: Mandadito marca como entregado (NO descuenta crédito, ya se descontó al aceptar)
const markAsDelivered = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (!order.mandadito || order.mandadito.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    if (order.status !== 'accepted') {
      return res.status(400).json({ message: 'La orden no está en estado aceptado' });
    }

    order.mandaditoDeliveredAt = new Date();
    order.status = 'delivered'; // Entregado, esperando confirmación del cliente
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);

    res.json({ order, message: 'Pedido marcado como entregado. Esperando confirmación del cliente.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// MODIFICADO: Cliente confirma que recibió - se completa la orden
const completeOrderByMandadito = async (req, res) => {
  // Este endpoint ya no descuenta crédito, solo cambia estado
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (!order.mandadito || order.mandadito.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    if (order.status === 'completed') {
      return res.status(400).json({ message: 'Esta orden ya está completada' });
    }

    order.mandaditoDeliveredAt = new Date();
    order.status = 'delivered';
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// NUEVO: Cliente confirma que recibió el pedido
const clientConfirmReceived = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ message: 'El mandadito aún no ha marcado el pedido como entregado' });
    }

    order.clientConfirmedAt = new Date();
    order.status = 'completed';
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);

    res.json({ order, message: '¡Gracias por confirmar! El pedido ha sido completado.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// MODIFICADO: Solicitar recarga con número de admin
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

    // Devolver también el número del admin para que el mandadito sepa dónde depositar
    res.json({
      message: 'Solicitud de recarga enviada. Realiza el depósito y espera confirmación.',
      adminPhone: '85202908', // Número del admin
      deposit,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEarningsReport = async (req, res) => {
  try {
    const orders = await Order.find({ mandadito: req.user._id, status: 'completed' });
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
  markAsDelivered,
  completeOrderByMandadito,
  clientConfirmReceived,
  requestRecharge,
  getEarningsReport,
};