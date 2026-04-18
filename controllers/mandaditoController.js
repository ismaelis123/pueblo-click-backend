const Order = require('../models/Order');
const User = require('../models/User');
const Deposit = require('../models/Deposit');
const axios = require('axios');

// Geocodificar dirección
const geocodeAddress = async (address) => {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { 
        q: `${address}, Juigalpa, Chontales, Nicaragua`, 
        format: 'json', 
        limit: 1 
      },
      headers: { 'User-Agent': 'PuebloClick/1.0' }
    });
    
    if (response.data && response.data.length > 0) {
      return { 
        lat: parseFloat(response.data[0].lat), 
        lng: parseFloat(response.data[0].lon) 
      };
    }
    return { lat: 12.106, lng: -85.364 };
  } catch (error) {
    console.error('Error geocodificando:', error.message);
    return { lat: 12.106, lng: -85.364 };
  }
};

// ==================== PERFIL Y DISPONIBILIDAD ====================
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Error en getProfile:', error);
    res.status(500).json({ message: error.message });
  }
};

const toggleAvailability = async (req, res) => {
  try {
    req.user.isAvailable = !req.user.isAvailable;
    await req.user.save();
    res.json({ isAvailable: req.user.isAvailable });
  } catch (error) {
    console.error('Error en toggleAvailability:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateWorkSchedule = async (req, res) => {
  try {
    const { startTime, endTime, lunchStart, lunchEnd, workDays, enabled } = req.body;
    
    req.user.workSchedule = {
      enabled: enabled !== undefined ? enabled : true,
      startTime: startTime || '08:00',
      endTime: endTime || '17:00',
      lunchStart: lunchStart || '12:00',
      lunchEnd: lunchEnd || '13:00',
      workDays: workDays || {
        monday: true, tuesday: true, wednesday: true, thursday: true,
        friday: true, saturday: false, sunday: false
      }
    };
    
    await req.user.save();
    res.json({ message: 'Horario actualizado', workSchedule: req.user.workSchedule });
  } catch (error) {
    console.error('Error en updateWorkSchedule:', error);
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
    console.error('Error en getOrders:', error);
    res.status(500).json({ message: error.message });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('client', 'name phone profilePhoto')
      .populate('mandadito', 'name phone profilePhoto currentLocation');
    
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error en getOrderDetails:', error);
    res.status(500).json({ message: error.message });
  }
};

// ==================== ÓRDENES PENDIENTES ====================
const getPendingOrders = async (req, res) => {
  try {
    console.log('🔍 Buscando órdenes pendientes para mandadito:', req.user._id);
    
    // Buscar órdenes públicas
    const publicOrders = await Order.find({ status: 'pending' })
      .populate('client', 'name phone profilePhoto')
      .sort({ createdAt: -1 })
      .lean();
    
    console.log(`📋 Órdenes públicas encontradas: ${publicOrders.length}`);
    
    // Buscar órdenes asignadas directamente
    const directOrders = await Order.find({ 
      status: 'pending_confirmation',
      mandadito: req.user._id 
    })
      .populate('client', 'name phone profilePhoto')
      .sort({ createdAt: -1 })
      .lean();
    
    console.log(`📋 Órdenes directas encontradas: ${directOrders.length}`);
    
    // Combinar resultados
    const allOrders = [...publicOrders, ...directOrders];
    
    res.json(allOrders);
  } catch (error) {
    console.error('❌ Error en getPendingOrders:', error);
    res.status(500).json({ message: error.message });
  }
};

// ==================== ACEPTAR ÓRDENES ====================
const acceptOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    
    if (order.status !== 'pending' && order.status !== 'pending_confirmation') {
      return res.status(400).json({ message: 'Orden no disponible' });
    }
    
    if (order.status === 'pending_confirmation' && order.mandadito.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    
    if (req.user.credit < order.amount) {
      return res.status(400).json({ message: `Crédito insuficiente. Necesitas C$${order.amount}` });
    }
    
    // Descontar crédito
    req.user.credit -= order.amount;
    await req.user.save();
    
    // Actualizar orden
    order.mandadito = req.user._id;
    order.status = 'accepted';
    
    if (!order.pickupLocation?.lat) {
      order.pickupLocation = await geocodeAddress(order.pickupAddress);
    }
    if (!order.deliveryLocation?.lat) {
      order.deliveryLocation = await geocodeAddress(order.deliveryAddress);
    }
    
    await order.save();
    
    // Notificar por socket
    const io = req.app.get('io');
    if (io) {
      io.emit('orderUpdated', order);
      io.to(order.client.toString()).emit('orderConfirmed', {
        order,
        message: `${req.user.name} ha aceptado tu mandado`
      });
    }
    
    res.json({
      order,
      creditRestante: req.user.credit,
      message: '✅ Orden aceptada correctamente'
    });
  } catch (error) {
    console.error('Error en acceptOrder:', error);
    res.status(500).json({ message: error.message });
  }
};

const acceptDirectOrder = acceptOrder;

const rejectDirectOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    
    if (order.status !== 'pending_confirmation') {
      return res.status(400).json({ message: 'Orden no está esperando confirmación' });
    }
    
    if (!order.mandadito || order.mandadito.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    
    order.mandadito = null;
    order.status = 'pending';
    await order.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('orderUpdated', order);
    }
    
    res.json({ message: 'Orden rechazada' });
  } catch (error) {
    console.error('Error en rejectDirectOrder:', error);
    res.status(500).json({ message: error.message });
  }
};

// ==================== MARCAR ENTREGADO ====================
const markAsDelivered = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    
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
    if (io) {
      io.emit('orderUpdated', order);
      io.to(order.client.toString()).emit('orderDelivered', {
        order,
        message: 'Tu pedido ha sido entregado. Por favor confirma.'
      });
    }
    
    res.json({ order, message: '📦 Pedido marcado como entregado' });
  } catch (error) {
    console.error('Error en markAsDelivered:', error);
    res.status(500).json({ message: error.message });
  }
};

// ==================== GANANCIAS Y RECARGAS ====================
const getEarningsReport = async (req, res) => {
  try {
    const orders = await Order.find({ 
      mandadito: req.user._id, 
      status: 'completed' 
    });
    
    res.json({
      totalOrders: orders.length,
      totalEarnings: orders.length * 5,
      orders
    });
  } catch (error) {
    console.error('Error en getEarningsReport:', error);
    res.status(500).json({ message: error.message });
  }
};

const requestRecharge = async (req, res) => {
  try {
    const { amount, reference } = req.body;
    
    if (!amount || amount < 1) {
      return res.status(400).json({ message: 'Monto inválido' });
    }
    
    if (!reference) {
      return res.status(400).json({ message: 'Referencia requerida' });
    }
    
    const deposit = await Deposit.create({
      mandadito: req.user._id,
      amount,
      reference
    });
    
    res.json({
      message: 'Solicitud enviada. Realiza el depósito y espera confirmación.',
      adminPhone: '85202908',
      deposit
    });
  } catch (error) {
    console.error('Error en requestRecharge:', error);
    res.status(500).json({ message: error.message });
  }
};

// ==================== UBICACIÓN ====================
const toggleShareLocation = async (req, res) => {
  try {
    req.user.isSharingLocation = !req.user.isSharingLocation;
    await req.user.save();
    
    res.json({
      isSharingLocation: req.user.isSharingLocation,
      message: req.user.isSharingLocation ? 'Compartiendo ubicación' : 'Ubicación desactivada'
    });
  } catch (error) {
    console.error('Error en toggleShareLocation:', error);
    res.status(500).json({ message: error.message });
  }
};

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
    
    const activeOrders = await Order.find({
      mandadito: req.user._id,
      status: { $in: ['accepted', 'delivered'] }
    });
    
    const io = req.app.get('io');
    if (io) {
      for (const order of activeOrders) {
        io.to(order.client.toString()).emit('locationUpdate', {
          orderId: order._id,
          location: { lat, lng }
        });
      }
    }
    
    res.json({ message: 'Ubicación actualizada', location: req.user.currentLocation });
  } catch (error) {
    console.error('Error en updateLocation:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProfile,
  toggleAvailability,
  updateWorkSchedule,
  getOrders,
  getOrderDetails,
  getPendingOrders,
  acceptDirectOrder,
  rejectDirectOrder,
  acceptOrder,
  markAsDelivered,
  requestRecharge,
  getEarningsReport,
  toggleShareLocation,
  updateLocation
};