const User = require('../models/User');
const Order = require('../models/Order');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('🟢 Cliente conectado:', socket.id);

    socket.on('register', async (userId) => {
      socket.userId = userId;
      socket.join(userId);
      console.log(`📱 Usuario ${userId} registrado`);
      
      const user = await User.findById(userId);
      if (user) {
        if (user.role === 'mandadito') {
          const activeOrders = await Order.find({
            mandadito: userId,
            status: { $in: ['accepted', 'delivered'] }
          });
          activeOrders.forEach(order => {
            socket.join(`order_${order._id}`);
            console.log(`🛵 Mandadito ${userId} unido a order_${order._id}`);
          });
        } else if (user.role === 'client') {
          const activeOrders = await Order.find({
            client: userId,
            status: { $in: ['accepted', 'delivered', 'pending_confirmation'] }
          });
          activeOrders.forEach(order => {
            socket.join(`order_${order._id}`);
            console.log(`👤 Cliente ${userId} unido a order_${order._id}`);
          });
        }
      }
    });

    socket.on('updateLocation', async (data) => {
      const { orderId, location } = data;
      if (!orderId || !location) return;
      
      console.log(`📍 Actualizando ubicación para orden ${orderId}:`, location);
      
      const order = await Order.findById(orderId).populate('client', '_id');
      if (order && order.client) {
        io.to(order.client._id.toString()).emit('locationUpdate', {
          orderId,
          location,
          timestamp: new Date()
        });
        console.log(`✅ Ubicación enviada al cliente ${order.client._id}`);
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