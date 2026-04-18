const Order = require('../models/Order');
const User = require('../models/User');
const Deposit = require('../models/Deposit');

// ==================== FUNCIONES BÁSICAS ====================

const getProfile = async (req, res) => {
  try {
    const mandadito = await User.findById(req.user._id).select('-password');
    res.json(mandadito);
  } catch (error) {
    console.error('Error en getProfile:', error);
    res.status(500).json({ message: 'Error al obtener perfil' });
  }
};

const toggleAvailability = async (req, res) => {
  try {
    req.user.isAvailable = !req.user.isAvailable;
    await req.user.save();
    res.json({ isAvailable: req.user.isAvailable });
  } catch (error) {
    console.error('Error en toggleAvailability:', error);
    res.status(500).json({ message: 'Error al cambiar disponibilidad' });
  }
};

const updateWorkSchedule = async (req, res) => {
  try {
    const { startTime, endTime, lunchStart, lunchEnd, workDays, enabled } = req.body;
    
    if (req.user.role !== 'mandadito') {
      return res.status(403).json({ message: 'Solo mandaditos pueden tener horario' });
    }
    
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
    
    res.json({ 
      message: 'Horario actualizado', 
      workSchedule: req.user.workSchedule, 
      isAvailable: req.user.isAvailable 
    });
  } catch (error) {
    console.error('Error en updateWorkSchedule:', error);
    res.status(500).json({ message: 'Error al actualizar horario' });
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
    res.json([]);
  }
};

// ==================== ESTA ES LA FUNCIÓN CORREGIDA - SIMPLE Y SEGURA ====================
const getPendingOrders = async (req, res) => {
  try {
    console.log('🔍 Buscando órdenes pendientes para:', req.user._id);
    
    // Buscar órdenes con status 'pending'
    const publicOrders = await Order.find({ 
      status: 'pending' 
    })
    .populate('client', 'name phone')
    .sort({ createdAt: -1 })
    .lean()
    .catch(err => {
      console.error('Error buscando órdenes públicas:', err);
      return [];
    });
    
    // Buscar órdenes asignadas directamente a este mandadito
    const directOrders = await Order.find({ 
      status: 'pending_confirmation',
      mandadito: req.user._id 
    })
    .populate('client', 'name phone')
    .sort({ createdAt: -1 })
    .lean()
    .catch(err => {
      console.error('Error buscando órdenes directas:', err);
      return [];
    });
    
    // Combinar resultados
    const allOrders = [...publicOrders, ...directOrders];
    
    console.log(`📋 Encontradas ${allOrders.length} órdenes pendientes`);
    
    // Asegurar que cada orden tenga los campos necesarios
    const safeOrders = allOrders.map(order => ({
      _id: order._id,
      description: order.description || 'Sin descripción',
      pickupAddress: order.pickupAddress || 'Dirección no especificada',
      deliveryAddress: order.deliveryAddress || 'Dirección no especificada',
      amount: order.amount || 5,
      status: order.status || 'pending',
      createdAt: order.createdAt || new Date(),
      client: order.client || { _id: 'unknown', name: 'Cliente', phone: '' }
    }));
    
    res.json(safeOrders);
  } catch (error) {
    console.error('❌ Error general en getPendingOrders:', error);
    // Siempre devolver array vacío en caso de error
    res.json([]);
  }
};

// ==================== ACEPTAR ÓRDENES ====================

const acceptOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    
    // Verificar que la orden esté disponible
    if (order.status !== 'pending' && order.status !== 'pending_confirmation') {
      return res.status(400).json({ message: 'Esta orden ya no está disponible' });
    }
    
    // Si es orden directa, verificar que sea para este mandadito
    if (order.status === 'pending_confirmation') {
      if (!order.mandadito || order.mandadito.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Esta orden no es para ti' });
      }
    }
    
    // Verificar crédito
    if (req.user.credit < order.amount) {
      return res.status(400).json({ message: `Crédito insuficiente. Necesitas C$${order.amount}` });
    }
    
    // Descontar crédito
    req.user.credit -= order.amount;
    await req.user.save();
    
    // Actualizar orden
    order.mandadito = req.user._id;
    order.status = 'accepted';
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
      success: true,
      order, 
      creditRestante: req.user.credit, 
      message: `✅ Orden aceptada. Se descontaron C$${order.amount}` 
    });
  } catch (error) {
    console.error('Error en acceptOrder:', error);
    res.status(500).json({ message: 'Error al aceptar la orden' });
  }
};

const acceptDirectOrder = async (req, res) => {
  // Misma lógica que acceptOrder
  return acceptOrder(req, res);
};

const rejectDirectOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    
    if (order.status !== 'pending_confirmation') {
      return res.status(400).json({ message: 'Esta orden ya no está esperando confirmación' });
    }
    
    if (!order.mandadito || order.mandadito.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    
    // Liberar la orden para que otros mandaditos puedan tomarla
    order.mandadito = null;
    order.status = 'pending';
    await order.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('orderUpdated', order);
    }
    
    res.json({ 
      success: true,
      message: 'Has rechazado la orden' 
    });
  } catch (error) {
    console.error('Error en rejectDirectOrder:', error);
    res.status(500).json({ message: 'Error al rechazar la orden' });
  }
};

// ==================== MARCAR COMO ENTREGADO ====================

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
    
    res.json({ 
      success: true,
      order, 
      message: '📦 Pedido marcado como entregado' 
    });
  } catch (error) {
    console.error('Error en markAsDelivered:', error);
    res.status(500).json({ message: 'Error al marcar como entregado' });
  }
};

// ==================== GANANCIAS Y RECARGAS ====================

const getEarningsReport = async (req, res) => {
  try {
    const orders = await Order.find({ 
      mandadito: req.user._id, 
      status: 'completed' 
    });
    
    const totalEarnings = orders.length * 5;
    
    res.json({ 
      totalOrders: orders.length, 
      totalEarnings, 
      orders 
    });
  } catch (error) {
    console.error('Error en getEarningsReport:', error);
    res.json({ totalOrders: 0, totalEarnings: 0, orders: [] });
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
      reference,
    });
    
    res.json({
      success: true,
      message: 'Solicitud enviada. Realiza el depósito y espera confirmación.',
      adminPhone: '85202908',
      deposit
    });
  } catch (error) {
    console.error('Error en requestRecharge:', error);
    res.status(500).json({ message: 'Error al solicitar recarga' });
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
    res.status(500).json({ message: 'Error al cambiar estado' });
  }
};

const updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Coordenadas requeridas' });
    }
    
    req.user.currentLocation = { 
      lat, 
      lng, 
      lastUpdate: new Date() 
    };
    await req.user.save();
    
    // Notificar a clientes con órdenes activas
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
    
    res.json({ success: true, message: 'Ubicación actualizada' });
  } catch (error) {
    console.error('Error en updateLocation:', error);
    res.status(500).json({ message: 'Error al actualizar ubicación' });
  }
};

// ==================== DETALLES DE ORDEN ====================

const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('client', 'name phone profilePhoto')
      .populate('mandadito', 'name phone profilePhoto');
    
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error en getOrderDetails:', error);
    res.status(500).json({ message: 'Error al obtener detalles' });
  }
};

// ==================== EXPORTAR ====================

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