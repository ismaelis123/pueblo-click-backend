const Order = require('../models/Order');
const Rating = require('../models/Rating');
const User = require('../models/User');

const createOrder = async (req, res) => {
  try {
    const { description, pickupAddress, deliveryAddress, mandaditoId } = req.body;
    
    console.log('📝 Creando orden con datos:', { description, pickupAddress, deliveryAddress, mandaditoId });
    
    const orderData = {
      client: req.user._id,
      description,
      pickupAddress,
      deliveryAddress,
      amount: 5,
    };
    
    if (mandaditoId && mandaditoId !== 'undefined' && mandaditoId !== 'null') {
      const mandadito = await User.findById(mandaditoId);
      if (!mandadito || mandadito.role !== 'mandadito') {
        return res.status(404).json({ message: 'Mandadito no encontrado' });
      }
      
      // Verificar que el mandadito está verificado
      if (!mandadito.isVerified) {
        return res.status(400).json({ message: 'Este mandadito aún no ha sido verificado por el administrador' });
      }
      
      orderData.mandadito = mandaditoId;
      orderData.status = 'pending_confirmation';
    } else {
      orderData.status = 'pending';
    }
    
    const order = await Order.create(orderData);
    const populatedOrder = await Order.findById(order._id).populate('client', 'name phone');
    
    const io = req.app.get('io');
    
    if (mandaditoId && mandaditoId !== 'undefined' && mandaditoId !== 'null') {
      io.to(mandaditoId).emit('directOrder', {
        order: populatedOrder,
        message: `Tienes una nueva solicitud de mandado de ${req.user.name}`
      });
      console.log(`📢 Notificando al mandadito ${mandaditoId} sobre orden directa`);
    } else {
      io.emit('newOrder', populatedOrder);
      console.log('📢 Notificando a todos los mandaditos sobre nueva orden');
    }
    
    res.status(201).json({ 
      order: populatedOrder,
      message: mandaditoId ? 'Mandado asignado. Esperando confirmación del mandadito.' : 'Mandado creado. Buscando mandadito disponible.'
    });
  } catch (error) {
    console.error('❌ Error en createOrder:', error);
    res.status(500).json({ message: error.message });
  }
};

const getClientOrders = async (req, res) => {
  try {
    const orders = await Order.find({ client: req.user._id })
      .populate('mandadito', 'name phone profilePhoto rating totalRatings')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('❌ Error en getClientOrders:', error);
    res.status(500).json({ message: error.message });
  }
};

const getAvailableMandaditos = async (req, res) => {
  try {
    const mandaditos = await User.find({ 
      role: 'mandadito', 
      isActive: true,
      isAvailable: true,
      isVerified: true  // Solo mostrar mandaditos verificados
    }).select('name phone profilePhoto rating totalRatings isAvailable motoPhotos');
    res.json(mandaditos);
  } catch (error) {
    console.error('❌ Error en getAvailableMandaditos:', error);
    res.status(500).json({ message: error.message });
  }
};

const getMandaditoProfile = async (req, res) => {
  try {
    const mandadito = await User.findById(req.params.id).select('-password');
    
    if (!mandadito || mandadito.role !== 'mandadito') {
      return res.status(404).json({ message: 'Mandadito no encontrado' });
    }
    
    // Obtener calificaciones del mandadito
    const ratings = await Rating.find({ mandadito: mandadito._id })
      .populate('client', 'name')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({ 
      mandadito: {
        _id: mandadito._id,
        name: mandadito.name,
        phone: mandadito.phone,
        profilePhoto: mandadito.profilePhoto,
        motoPhotos: mandadito.motoPhotos,
        cedulaPhoto: mandadito.cedulaPhoto,
        seguroPhoto: mandadito.seguroPhoto,
        licenciaPhoto: mandadito.licenciaPhoto,
        rating: mandadito.rating,
        totalRatings: mandadito.totalRatings,
        isAvailable: mandadito.isAvailable,
        isVerified: mandadito.isVerified,
        createdAt: mandadito.createdAt
      }, 
      ratings 
    });
  } catch (error) {
    console.error('❌ Error en getMandaditoProfile:', error);
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

    res.json({ order, message: '¡Gracias por confirmar! El pedido ha sido completado.' });
  } catch (error) {
    console.error('❌ Error en confirmReceived:', error);
    res.status(500).json({ message: error.message });
  }
};

const rateMandadito = async (req, res) => {
  try {
    const { orderId, score, comment } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.status !== 'completed') {
      return res.status(400).json({ message: 'La orden debe estar completada para calificar' });
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
      rating: avg, 
      totalRatings: allRatings.length 
    });

    res.status(201).json({ 
      rating, 
      message: '¡Calificación guardada! Gracias por tu feedback.' 
    });
  } catch (error) {
    console.error('❌ Error en rateMandadito:', error);
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
};