const Order = require('../models/Order');
const User = require('../models/User');
const Rating = require('../models/Rating');
const axios = require('axios');
const { notifyNewOrderToMandaditos, notifyClientConfirmed } = require('./notificationController');

// Coordenadas de referencia de Juigalpa
const JUIGALPA_CENTER = { lat: 12.106, lng: -85.364 };
const JUIGALPA_RADIUS_KM = 10; // Radio máximo de búsqueda: 10 km desde el centro

// Geocodificar dirección - SOLO JUIGALPA, CHONTALES
const geocodeAddress = async (address) => {
  try {
    // Intento 1: Dirección exacta + Juigalpa + Chontales + Nicaragua
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { 
        q: `${address}, Juigalpa, Chontales, Nicaragua`, 
        format: 'json', 
        limit: 3,
        countrycodes: 'ni',
        bounded: 1,
        viewbox: '-85.40,12.08,-85.32,12.13' // Bounding box de Juigalpa
      },
      headers: { 'User-Agent': 'PuebloClick/1.0' }
    });
    
    if (response.data && response.data.length > 0) {
      // Verificar que esté dentro del radio de Juigalpa
      for (const result of response.data) {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const distance = calculateDistance(JUIGALPA_CENTER.lat, JUIGALPA_CENTER.lng, lat, lng);
        
        if (distance <= JUIGALPA_RADIUS_KM) {
          console.log('✅ Dirección encontrada en Juigalpa:', result.display_name);
          return { 
            lat: lat, 
            lng: lng,
            displayName: result.display_name
          };
        }
      }
    }
    
    // Intento 2: Solo "Juigalpa" + dirección
    const response2 = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { 
        q: `${address}, Juigalpa`, 
        format: 'json', 
        limit: 5,
        countrycodes: 'ni'
      },
      headers: { 'User-Agent': 'PuebloClick/1.0' }
    });
    
    if (response2.data && response2.data.length > 0) {
      for (const result of response2.data) {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const distance = calculateDistance(JUIGALPA_CENTER.lat, JUIGALPA_CENTER.lng, lat, lng);
        
        if (distance <= JUIGALPA_RADIUS_KM) {
          console.log('✅ Dirección encontrada (intento 2):', result.display_name);
          return { 
            lat: lat, 
            lng: lng,
            displayName: result.display_name
          };
        }
      }
    }
    
    // Intento 3: "Chontales" + dirección
    const response3 = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { 
        q: `${address}, Chontales, Nicaragua`, 
        format: 'json', 
        limit: 5,
        countrycodes: 'ni'
      },
      headers: { 'User-Agent': 'PuebloClick/1.0' }
    });
    
    if (response3.data && response3.data.length > 0) {
      for (const result of response3.data) {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const distance = calculateDistance(JUIGALPA_CENTER.lat, JUIGALPA_CENTER.lng, lat, lng);
        
        if (distance <= JUIGALPA_RADIUS_KM) {
          console.log('✅ Dirección encontrada (intento 3):', result.display_name);
          return { 
            lat: lat, 
            lng: lng,
            displayName: result.display_name
          };
        }
      }
    }
    
    // Fallback: Puntos específicos de Juigalpa para zonas conocidas
    const juigalpaZones = [
      { name: 'parque central', lat: 12.106, lng: -85.364 },
      { name: 'mercado', lat: 12.108, lng: -85.362 },
      { name: 'hospital', lat: 12.104, lng: -85.367 },
      { name: 'barrio', lat: 12.107, lng: -85.361 },
      { name: 'iglesia', lat: 12.105, lng: -85.365 },
      { name: 'escuela', lat: 12.109, lng: -85.360 },
      { name: 'colegio', lat: 12.109, lng: -85.360 },
      { name: 'restaurante', lat: 12.107, lng: -85.363 },
      { name: 'tienda', lat: 12.106, lng: -85.362 },
      { name: 'casa', lat: 12.108, lng: -85.361 },
      { name: 'calle', lat: 12.107, lng: -85.363 },
      { name: 'avenida', lat: 12.106, lng: -85.364 },
    ];
    
    const addressLower = address.toLowerCase();
    let closestZone = juigalpaZones[0];
    
    for (const zone of juigalpaZones) {
      if (addressLower.includes(zone.name)) {
        closestZone = zone;
        break;
      }
    }
    
    // Agregar pequeña variación para que no sea exactamente el mismo punto
    const variation = () => (Math.random() * 0.004 - 0.002);
    
    console.log('⚠️ Usando zona de Juigalpa:', closestZone.name);
    return { 
      lat: closestZone.lat + variation(), 
      lng: closestZone.lng + variation(),
      displayName: `${address}, Juigalpa, Chontales`
    };
    
  } catch (error) {
    console.error('Error geocodificando:', error.message);
    // Fallback final: Juigalpa centro con variación
    return { 
      lat: JUIGALPA_CENTER.lat + (Math.random() * 0.004 - 0.002), 
      lng: JUIGALPA_CENTER.lng + (Math.random() * 0.004 - 0.002),
      displayName: 'Juigalpa, Chontales'
    };
  }
};

// Calcular distancia en km
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 0;
  
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10;
};

// Calcular tarifa según distancia
const calculateFare = (distanceKm, isUrgent) => {
  if (isUrgent) return 70;
  if (distanceKm <= 1.5) return 30;
  if (distanceKm <= 3) return 40;
  return 50;
};

const createOrder = async (req, res) => {
  try {
    const { 
      description, 
      pickupAddress, 
      deliveryAddress, 
      mandaditoId,
      isUrgent = false
    } = req.body;
    
    console.log('📍 [JUGALPA] Geocodificando recogida:', pickupAddress);
    const pickupLocation = await geocodeAddress(pickupAddress);
    console.log('✅ [JUGALPA] Recogida:', pickupLocation.lat, pickupLocation.lng);
    
    console.log('📍 [JUGALPA] Geocodificando entrega:', deliveryAddress);
    const deliveryLocation = await geocodeAddress(deliveryAddress);
    console.log('✅ [JUGALPA] Entrega:', deliveryLocation.lat, deliveryLocation.lng);
    
    const distance = calculateDistance(
      pickupLocation.lat, pickupLocation.lng,
      deliveryLocation.lat, deliveryLocation.lng
    );
    console.log(`📏 Distancia: ${distance} km`);
    
    const amount = calculateFare(distance, isUrgent);
    console.log(`💰 Tarifa: C$${amount}`);
    
    const orderData = {
      client: req.user._id,
      description,
      pickupAddress,
      deliveryAddress,
      pickupLocation: {
        lat: pickupLocation.lat,
        lng: pickupLocation.lng
      },
      deliveryLocation: {
        lat: deliveryLocation.lat,
        lng: deliveryLocation.lng
      },
      distance,
      isUrgent: isUrgent || false,
      amount,
    };
    
    if (mandaditoId && mandaditoId !== 'undefined' && mandaditoId !== 'null' && mandaditoId !== '') {
      const mandadito = await User.findById(mandaditoId);
      if (!mandadito || mandadito.role !== 'mandadito') {
        return res.status(404).json({ message: 'Mandadito no encontrado' });
      }
      if (!mandadito.isVerified) {
        return res.status(400).json({ message: 'Este mandadito aún no ha sido verificado' });
      }
      orderData.mandadito = mandaditoId;
      orderData.status = 'pending_confirmation';
    } else {
      orderData.status = 'pending';
    }
    
    const order = await Order.create(orderData);
    const populatedOrder = await Order.findById(order._id)
      .populate('client', 'name phone')
      .populate('mandadito', 'name phone');
    
    const io = req.app.get('io');
    
    if (orderData.mandadito) {
      io.to(mandaditoId).emit('directOrder', {
        order: populatedOrder,
        message: `Nueva solicitud de ${req.user.name}`
      });
    } else {
      io.emit('newOrder', populatedOrder);
      try {
        await notifyNewOrderToMandaditos(order, req.user.name);
      } catch (e) {
        console.log('Error notificando:', e.message);
      }
    }
    
    const distanceText = distance > 0 ? `${distance} km` : 'calculada';
    const fareMessage = isUrgent 
      ? `🚨 URGENTE: C$${amount}` 
      : `💰 Tarifa: C$${amount} (${distanceText})`;
    
    res.status(201).json({ 
      order: populatedOrder,
      fareInfo: {
        distance: distanceText,
        amount: amount,
        isUrgent: isUrgent,
        message: fareMessage
      },
      message: orderData.mandadito ? 'Mandado asignado.' : 'Mandado creado en Juigalpa.'
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getClientOrders = async (req, res) => {
  try {
    const orders = await Order.find({ client: req.user._id })
      .populate('mandadito', 'name phone profilePhoto rating totalRatings currentLocation isSharingLocation')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAvailableMandaditos = async (req, res) => {
  try {
    const mandaditos = await User.find({ 
      role: 'mandadito', 
      isActive: true,
      isVerified: true
    }).select('name phone profilePhoto rating totalRatings isAvailable motoPhotos workSchedule currentLocation');
    res.json(mandaditos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMandaditoProfile = async (req, res) => {
  try {
    const mandadito = await User.findById(req.params.id).select('-password');
    if (!mandadito || mandadito.role !== 'mandadito') {
      return res.status(404).json({ message: 'Mandadito no encontrado' });
    }
    const ratings = await Rating.find({ mandadito: mandadito._id })
      .populate('client', 'name')
      .sort({ createdAt: -1 })
      .limit(10);
    res.json({ mandadito, ratings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const confirmReceived = async (req, res) => {
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
    try {
      await notifyClientConfirmed(order, req.user.name);
    } catch (e) {
      console.log('Error notificando:', e.message);
    }

    res.json({ order, message: '¡Gracias por confirmar!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const rateMandadito = async (req, res) => {
  try {
    const { orderId, score, comment } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.status !== 'completed') {
      return res.status(400).json({ message: 'La orden debe estar completada' });
    }
    if (order.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const existingRating = await Rating.findOne({ order: orderId });
    if (existingRating) {
      return res.status(400).json({ message: 'Ya calificaste esta orden' });
    }

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
      rating: Math.round(avg * 10) / 10, 
      totalRatings: allRatings.length 
    });

    res.status(201).json({ rating, message: '¡Calificación guardada!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMandaditoLocation = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('mandadito', 'currentLocation isSharingLocation name phone');
    
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    
    res.json({
      location: order.mandadito?.currentLocation || null,
      isSharing: order.mandadito?.isSharingLocation || false,
      mandaditoName: order.mandadito?.name || 'Mandadito',
      lastUpdate: order.mandadito?.currentLocation?.lastUpdate || null,
      orderStatus: order.status,
      pickupLocation: order.pickupLocation,
      deliveryLocation: order.deliveryLocation
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  getClientOrders,
  getAvailableMandaditos,
  getMandaditoProfile,
  confirmReceived,
  rateMandadito,
  getMandaditoLocation
};