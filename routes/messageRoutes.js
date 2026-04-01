const express = require('express');
const { protect } = require('../middleware/auth');
const { getMessages, sendMessage, getConversations } = require('../controllers/messageController');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Obtener todas las conversaciones del usuario
router.get('/conversations', getConversations);

// Obtener mensajes de una orden específica
router.get('/order/:orderId', getMessages);

// Enviar un mensaje
router.post('/', sendMessage);

module.exports = router;