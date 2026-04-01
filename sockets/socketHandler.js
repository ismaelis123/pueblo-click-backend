const User = require('../models/User');
const Order = require('../models/Order');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('🟢 Cliente conectado:', socket.id);

    socket.on('register', async (userId) => {
      socket.userId = userId;
      socket.join(userId);
      console.log(`📱 Usuario ${userId} registrado en sala ${userId}`);
      
      // Si es mandadito, unirse a las salas de sus órdenes activas
      const user = await User.findById(userId);
      if (user && user.role === 'mandadito') {
        const activeOrders = await Order.find({
          mandadito: userId,
          status: { $in: ['accepted', 'delivered'] }
        });
        activeOrders.forEach(order => {
          socket.join(`order_${order._id}`);
          console.log(`🛵 Mandadito ${userId} unido a sala order_${order._id}`);
        });
      }
    });

    // NUEVO: Actualizar ubicación en tiempo real
    socket.on('updateLocation', async (data) => {
      const { orderId, location } = data;
      if (!orderId || !location) return;
      
      // Emitir al cliente específico que está viendo esta orden
      const order = await Order.findById(orderId);
      if (order && order.client) {
        io.to(order.client.toString()).emit('locationUpdate', {
          orderId,
          location,
          timestamp: new Date()
        });
        console.log(`📍 Ubicación actualizada para orden ${orderId}`);
      }
    });

    socket.on('joinOrderRoom', (orderId) => {
      socket.join(`order_${orderId}`);
      console.log(`📦 Usuario ${socket.userId} unido a sala order_${orderId}`);
    });

    socket.on('leaveOrderRoom', (orderId) => {
      socket.leave(`order_${orderId}`);
      console.log(`📦 Usuario ${socket.userId} salió de sala order_${orderId}`);
    });

    socket.on('disconnect', () => {
      console.log('🔴 Cliente desconectado:', socket.id);
    });
  });
};