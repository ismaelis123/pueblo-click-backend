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

// NUEVO: Activar/Desactivar compartir ubicación
const toggleShareLocation = async (req, res) => {
  try {
    req.user.isSharingLocation = !req.user.isSharingLocation;
    await req.user.save();
    
    const io = req.app.get('io');
    io.emit('locationStatusChanged', {
      mandaditoId: req.user._id,
      isSharing: req.user.isSharingLocation
    });
    
    res.json({ 
      isSharingLocation: req.user.isSharingLocation,
      message: req.user.isSharingLocation ? 'Compartiendo ubicación activado' : 'Compartiendo ubicación desactivado'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// NUEVO: Actualizar ubicación en tiempo real
const updateLocation = async (req, res) => {
  try {
    const { lat, lng, accuracy } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Coordenadas requeridas' });
    }
    
    req.user.currentLocation = {
      lat,
      lng,
      accuracy: accuracy || null,
      lastUpdate: new Date()
    };
    await req.user.save();
    
    // Emitir a los clientes que tienen órdenes activas con este mandadito
    const activeOrders = await Order.find({
      mandadito: req.user._id,
      status: { $in: ['accepted', 'delivered'] }
    }).select('client');
    
    const io = req.app.get('io');
    activeOrders.forEach(order => {
      io.to(order.client.toString()).emit('locationUpdate', {
        orderId: order._id,
        location: { lat, lng, accuracy },
        timestamp: new Date()
      });
    });
    
    res.json({ 
      message: 'Ubicación actualizada',
      location: req.user.currentLocation
    });
  } catch (error) {
    console.error('Error en updateLocation:', error);
    res.status(500).json({ message: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ mandadito: req.user._id })
      .populate('client', 'name phone profilePhoto')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPendingOrders = async (req, res) => {
  try {
    const orders = await Order.find({ 
      $or: [
        { status: 'pending' },
        { status: 'pending_confirmation', mandadito: req.user._id }
      ]
    }).populate('client', 'name phone profilePhoto')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const acceptDirectOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.status !== 'pending_confirmation') {
      return res.status(400).json({ message: 'Esta orden ya no está esperando tu confirmación' });
    }
    if (order.mandadito.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    
    if (req.user.credit < order.amount) {
      return res.status(400).json({ 
        message: `Crédito insuficiente. Necesitas C$${order.amount} para aceptar este mandado.` 
      });
    }

    req.user.credit -= order.amount;
    await req.user.save();

    order.status = 'accepted';
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);
    io.to(order.client.toString()).emit('orderConfirmed', {
      order,
      message: `Tu mandado ha sido aceptado por ${req.user.name}`
    });

    res.json({ 
      order, 
      creditRestante: req.user.credit,
      message: `✅ Orden aceptada. Se descontaron C$${order.amount} de tu crédito.`
    });
  } catch (error) {
    console.error('❌ Error en acceptDirectOrder:', error);
    res.status(500).json({ message: error.message });
  }
};

const rejectDirectOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.status !== 'pending_confirmation') {
      return res.status(400).json({ message: 'Esta orden ya no está esperando tu confirmación' });
    }
    if (order.mandadito.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const clientName = order.client?.name || 'Cliente';
    
    order.mandadito = null;
    order.status = 'pending';
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);
    io.to(order.client.toString()).emit('orderRejected', {
      order,
      message: `${req.user.name} ha rechazado tu mandado. Buscando otro mandadito...`
    });

    res.json({ 
      order, 
      message: `Has rechazado la orden de ${clientName}. Quedará disponible para otros mandaditos.` 
    });
  } catch (error) {
    console.error('❌ Error en rejectDirectOrder:', error);
    res.status(500).json({ message: error.message });
  }
};

const acceptOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.status !== 'pending') return res.status(400).json({ message: 'Orden no disponible' });
    
    if (req.user.credit < order.amount) {
      return res.status(400).json({ 
        message: `Crédito insuficiente. Necesitas C$${order.amount} para aceptar este mandado.` 
      });
    }

    req.user.credit -= order.amount;
    await req.user.save();

    order.mandadito = req.user._id;
    order.status = 'accepted';
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);
    io.to(order.client.toString()).emit('orderConfirmed', {
      order,
      message: `Tu mandado ha sido aceptado por ${req.user.name}`
    });

    res.json({ 
      order, 
      creditRestante: req.user.credit,
      message: `✅ Orden aceptada. Se descontaron C$${order.amount} de tu crédito.`
    });
  } catch (error) {
    console.error('❌ Error en acceptOrder:', error);
    res.status(500).json({ message: error.message });
  }
};

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
    order.status = 'delivered';
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);
    io.to(order.client.toString()).emit('orderDelivered', {
      order,
      message: `Tu pedido ha sido entregado. Por favor confirma la recepción.`
    });

    res.json({ order, message: '📦 Pedido marcado como entregado. Esperando confirmación del cliente.' });
  } catch (error) {
    console.error('❌ Error en markAsDelivered:', error);
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

    res.json({
      message: 'Solicitud de recarga enviada. Realiza el depósito y espera confirmación.',
      adminPhone: '85202908',
      adminMessage: `Hola, realicé un depósito de C$${amount} para recargar mi crédito. Referencia: ${reference}`,
      deposit,
    });
  } catch (error) {
    console.error('❌ Error en requestRecharge:', error);
    res.status(500).json({ message: error.message });
  }
};

const getEarningsReport = async (req, res) => {
  try {
    const orders = await Order.find({ mandadito: req.user._id, status: 'completed' });
    const totalEarnings = orders.length * 5;
    res.json({ totalOrders: orders.length, totalEarnings, orders });
  } catch (error) {
    console.error('❌ Error en getEarningsReport:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProfile,
  toggleAvailability,
  toggleShareLocation,
  updateLocation,
  getOrders,
  getPendingOrders,
  acceptDirectOrder,
  rejectDirectOrder,
  acceptOrder,
  markAsDelivered,
  requestRecharge,
  getEarningsReport,
};