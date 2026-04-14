const Order = require('../models/Order');
const User = require('../models/User');
const Deposit = require('../models/Deposit');
const axios = require('axios');
const { notifyOrderAccepted, notifyOrderDelivered } = require('./notificationController');

// Geocodificar dirección con fallback
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
        lng: parseFloat(response.data[0].lon),
        displayName: response.data[0].display_name
      };
    }
    
    // Fallback: Si no encuentra, usar coordenadas aproximadas de Juigalpa
    console.log('⚠️ Dirección no encontrada, usando fallback de Juigalpa');
    return { 
      lat: 12.106, 
      lng: -85.364, 
      displayName: 'Juigalpa, Chontales (ubicación aproximada)'
    };
  } catch (error) {
    console.error('Error geocodificando:', error.message);
    // Fallback en caso de error
    return { 
      lat: 12.106, 
      lng: -85.364, 
      displayName: 'Juigalpa, Chontales (ubicación aproximada)'
    };
  }
};

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

const updateWorkSchedule = async (req, res) => {
  try {
    const { startTime, endTime, lunchStart, lunchEnd, workDays, enabled } = req.body;
    
    if (req.user.role !== 'mandadito') {
      return res.status(403).json({ message: 'Solo mandaditos pueden tener horario' });
    }
    
    req.user.workSchedule = {
      enabled: enabled !== undefined ? enabled : req.user.workSchedule.enabled,
      startTime: startTime || req.user.workSchedule.startTime,
      endTime: endTime || req.user.workSchedule.endTime,
      lunchStart: lunchStart || req.user.workSchedule.lunchStart,
      lunchEnd: lunchEnd || req.user.workSchedule.lunchEnd,
      workDays: workDays || req.user.workSchedule.workDays
    };
    
    await req.user.save();
    await req.user.updateAvailability();
    
    res.json({ 
      message: 'Horario actualizado', 
      workSchedule: req.user.workSchedule, 
      isAvailable: req.user.isAvailable 
    });
  } catch (error) {
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

// NUEVO: Obtener detalles de una orden específica con coordenadas actualizadas
const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('client', 'name phone profilePhoto')
      .populate('mandadito', 'name phone profilePhoto currentLocation');
    
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    
    // Verificar que el mandadito sea el asignado
    if (order.mandadito?._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    
    // Si no hay coordenadas de pickup o delivery, geocodificarlas
    if (!order.pickupLocation?.lat || !order.deliveryLocation?.lat) {
      console.log('📍 Geocodificando direcciones para orden:', order._id);
      
      if (!order.pickupLocation?.lat) {
        const pickupCoords = await geocodeAddress(order.pickupAddress);
        order.pickupLocation = pickupCoords;
      }
      
      if (!order.deliveryLocation?.lat) {
        const deliveryCoords = await geocodeAddress(order.deliveryAddress);
        order.deliveryLocation = deliveryCoords;
      }
      
      await order.save();
    }
    
    res.json(order);
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
      return res.status(400).json({ message: `Crédito insuficiente. Necesitas C$${order.amount}.` });
    }

    req.user.credit -= order.amount;
    await req.user.save();
    order.status = 'accepted';
    
    // Asegurar que las coordenadas existan
    if (!order.pickupLocation?.lat) {
      const pickupCoords = await geocodeAddress(order.pickupAddress);
      order.pickupLocation = pickupCoords;
    }
    if (!order.deliveryLocation?.lat) {
      const deliveryCoords = await geocodeAddress(order.deliveryAddress);
      order.deliveryLocation = deliveryCoords;
    }
    
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);
    io.to(order.client.toString()).emit('orderConfirmed', {
      order,
      message: `Tu mandado ha sido aceptado por ${req.user.name}`
    });
    
    await notifyOrderAccepted(order, req.user.name);

    res.json({ 
      order, 
      creditRestante: req.user.credit, 
      message: `✅ Orden aceptada. Se descontaron C$${order.amount}.` 
    });
  } catch (error) {
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

    order.mandadito = null;
    order.status = 'pending';
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);
    io.to(order.client.toString()).emit('orderRejected', {
      order,
      message: `${req.user.name} ha rechazado tu mandado.`
    });

    res.json({ 
      order, 
      message: `Has rechazado la orden. Quedará disponible.` 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const acceptOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Orden no disponible' });
    }
    if (req.user.credit < order.amount) {
      return res.status(400).json({ message: `Crédito insuficiente. Necesitas C$${order.amount}.` });
    }

    req.user.credit -= order.amount;
    await req.user.save();
    order.mandadito = req.user._id;
    order.status = 'accepted';
    
    // Asegurar que las coordenadas existan
    if (!order.pickupLocation?.lat) {
      const pickupCoords = await geocodeAddress(order.pickupAddress);
      order.pickupLocation = pickupCoords;
    }
    if (!order.deliveryLocation?.lat) {
      const deliveryCoords = await geocodeAddress(order.deliveryAddress);
      order.deliveryLocation = deliveryCoords;
    }
    
    await order.save();

    const io = req.app.get('io');
    io.emit('orderUpdated', order);
    io.to(order.client.toString()).emit('orderConfirmed', {
      order,
      message: `Tu mandado ha sido aceptado por ${req.user.name}`
    });
    
    await notifyOrderAccepted(order, req.user.name);

    res.json({ 
      order, 
      creditRestante: req.user.credit, 
      message: `✅ Orden aceptada. Se descontaron C$${order.amount}.` 
    });
  } catch (error) {
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
      message: `Tu pedido ha sido entregado. Por favor confirma.`
    });
    
    if (req.user.currentLocation) {
      io.to(order.client.toString()).emit('locationUpdate', {
        orderId: order._id,
        location: req.user.currentLocation,
        final: true,
        timestamp: new Date()
      });
    }
    
    await notifyOrderDelivered(order, req.user.name);

    res.json({ order, message: '📦 Pedido marcado como entregado. Esperando confirmación.' });
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

    res.json({
      message: 'Solicitud enviada. Realiza el depósito y espera confirmación.',
      adminPhone: '85202908',
      adminMessage: `Hola, realicé un depósito de C$${amount} para recargar mi crédito. Referencia: ${reference}`,
      deposit
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

const toggleShareLocation = async (req, res) => {
  try {
    req.user.isSharingLocation = !req.user.isSharingLocation;
    await req.user.save();
    res.json({ 
      isSharingLocation: req.user.isSharingLocation, 
      message: req.user.isSharingLocation ? 'Compartiendo ubicación activado' : 'Compartiendo ubicación desactivado' 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateLocation = async (req, res) => {
  try {
    const { lat, lng, accuracy } = req.body;
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Coordenadas requeridas' });
    }
    
    console.log(`📍 Actualizando ubicación de ${req.user.name}: ${lat}, ${lng}`);
    
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
    }).populate('client', '_id');
    
    console.log(`📢 Notificando a ${activeOrders.length} clientes`);
    
    const io = req.app.get('io');
    for (const order of activeOrders) {
      io.to(order.client._id.toString()).emit('locationUpdate', { 
        orderId: order._id, 
        location: { lat, lng, accuracy },
        timestamp: new Date()
      });
      console.log(`✅ Ubicación enviada al cliente ${order.client._id} para orden ${order._id}`);
    }
    
    res.json({ message: 'Ubicación actualizada', location: req.user.currentLocation });
  } catch (error) {
    console.error('❌ Error en updateLocation:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProfile,
  toggleAvailability,
  updateWorkSchedule,
  getOrders,
  getOrderDetails, // NUEVO
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