const Message = require('../models/Message');
const Order = require('../models/Order');

// Obtener mensajes de una orden
const getMessages = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    
    // Verificar que el usuario está involucrado en la orden
    if (order.client.toString() !== req.user._id.toString() && 
        (!order.mandadito || order.mandadito.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    
    const messages = await Message.find({ orderId })
      .populate('sender', 'name profilePhoto role')
      .sort({ createdAt: 1 });
    
    // Marcar mensajes como leídos
    await Message.updateMany(
      { orderId, receiver: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );
    
    res.json(messages);
  } catch (error) {
    console.error('Error en getMessages:', error);
    res.status(500).json({ message: error.message });
  }
};

// Enviar mensaje
const sendMessage = async (req, res) => {
  try {
    const { orderId, message } = req.body;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ message: 'El mensaje no puede estar vacío' });
    }
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    
    // Determinar el receptor (el otro usuario involucrado)
    let receiverId;
    if (order.client.toString() === req.user._id.toString()) {
      receiverId = order.mandadito;
    } else if (order.mandadito && order.mandadito.toString() === req.user._id.toString()) {
      receiverId = order.client;
    } else {
      return res.status(403).json({ message: 'No estás involucrado en esta orden' });
    }
    
    if (!receiverId) {
      return res.status(400).json({ message: 'El mandadito aún no ha sido asignado' });
    }
    
    const newMessage = await Message.create({
      orderId,
      sender: req.user._id,
      receiver: receiverId,
      message: message.trim(),
    });
    
    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'name profilePhoto role');
    
    const io = req.app.get('io');
    // Emitir mensaje a ambos usuarios
    io.to(order.client.toString()).emit('newMessage', populatedMessage);
    if (order.mandadito) {
      io.to(order.mandadito.toString()).emit('newMessage', populatedMessage);
    }
    
    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error en sendMessage:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtener conversaciones activas del usuario
const getConversations = async (req, res) => {
  try {
    // Buscar órdenes donde el usuario esté involucrado
    const orders = await Order.find({
      $or: [
        { client: req.user._id },
        { mandadito: req.user._id }
      ],
      status: { $ne: 'cancelled' }
    }).populate('client mandadito', 'name profilePhoto phone');
    
    const conversations = [];
    
    for (const order of orders) {
      const otherUser = order.client.toString() === req.user._id.toString() 
        ? order.mandadito 
        : order.client;
      
      if (!otherUser) continue;
      
      const lastMessage = await Message.findOne({ orderId: order._id })
        .sort({ createdAt: -1 });
      
      const unreadCount = await Message.countDocuments({
        orderId: order._id,
        receiver: req.user._id,
        read: false
      });
      
      conversations.push({
        orderId: order._id,
        orderStatus: order.status,
        otherUser,
        lastMessage,
        unreadCount,
        updatedAt: order.updatedAt
      });
    }
    
    // Ordenar por última actividad
    conversations.sort((a, b) => {
      const dateA = a.lastMessage?.createdAt || a.updatedAt;
      const dateB = b.lastMessage?.createdAt || b.updatedAt;
      return new Date(dateB) - new Date(dateA);
    });
    
    res.json(conversations);
  } catch (error) {
    console.error('Error en getConversations:', error);
    res.status(500).json({ message: error.message });
  }
};

// SOLO UN EXPORT - CORREGIDO
module.exports = { getMessages, sendMessage, getConversations };