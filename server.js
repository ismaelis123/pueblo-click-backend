const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Conectar a MongoDB
const connectDB = require('./config/db');
connectDB();

const app = express();
const server = http.createServer(app);

// Configuración CORS
const allowedOrigins = [
  'https://pueblo-click.netlify.app',
  'https://puebloclick.netlify.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'https://pueblo-click-backend.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ CORS bloqueado para:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Socket.IO
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  },
  transports: ['websocket', 'polling']
});
app.set('io', io);

// ==================== RUTA DE DIAGNÓSTICO ====================
// Poner esto ANTES de las demás rutas
app.get('/api/diagnostico/pending', async (req, res) => {
  try {
    const Order = require('./models/Order');
    const User = require('./models/User');
    
    console.log('🔍 Ejecutando diagnóstico de órdenes pendientes...');
    
    // Buscar un mandadito para prueba
    const mandadito = await User.findOne({ role: 'mandadito' }).select('-password');
    
    if (!mandadito) {
      console.log('❌ No hay mandaditos en la base de datos');
      return res.json({ 
        success: false, 
        error: 'No hay mandaditos registrados en la base de datos' 
      });
    }
    
    console.log('✅ Mandadito encontrado:', mandadito.name);
    
    // Buscar órdenes pendientes
    const publicOrders = await Order.find({ status: 'pending' })
      .populate('client', 'name phone')
      .limit(10)
      .lean();
    
    const directOrders = await Order.find({ 
      status: 'pending_confirmation',
      mandadito: mandadito._id 
    })
      .populate('client', 'name phone')
      .limit(10)
      .lean();
    
    const allOrders = [...publicOrders, ...directOrders];
    
    console.log(`✅ Encontradas ${publicOrders.length} órdenes públicas y ${directOrders.length} órdenes directas`);
    
    // Estadísticas de la base de datos
    const totalOrders = await Order.countDocuments();
    const pendingCount = await Order.countDocuments({ status: 'pending' });
    const pendingConfirmationCount = await Order.countDocuments({ status: 'pending_confirmation' });
    const acceptedCount = await Order.countDocuments({ status: 'accepted' });
    const deliveredCount = await Order.countDocuments({ status: 'delivered' });
    const completedCount = await Order.countDocuments({ status: 'completed' });
    
    res.json({
      success: true,
      mandadito: {
        _id: mandadito._id,
        name: mandadito.name,
        phone: mandadito.phone,
        isVerified: mandadito.isVerified,
        credit: mandadito.credit,
        isAvailable: mandadito.isAvailable
      },
      estadisticas: {
        totalOrdenes: totalOrders,
        pendientes: pendingCount,
        pendientesConfirmacion: pendingConfirmationCount,
        aceptadas: acceptedCount,
        entregadas: deliveredCount,
        completadas: completedCount
      },
      ordenesEncontradas: allOrders.length,
      ordenes: allOrders
    });
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// ==================== RUTAS PRINCIPALES ====================
const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const mandaditoRoutes = require('./routes/mandaditoRoutes');
const adminRoutes = require('./routes/adminRoutes');
const messageRoutes = require('./routes/messageRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/mandadito', mandaditoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Pueblo Click funcionando',
    version: '2.0.0',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('❌ Error del servidor:', err.stack);
  res.status(500).json({ 
    message: err.message || 'Error del servidor',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

// Socket Handler
const socketHandler = require('./sockets/socketHandler');
socketHandler(io);

// Iniciar servidor
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📱 API: http://localhost:${PORT}`);
  console.log(`🔍 Diagnóstico: http://localhost:${PORT}/api/diagnostico/pending`);
  console.log(`✅ MongoDB: ${process.env.MONGO_URI ? 'Configurada' : 'NO CONFIGURADA'}\n`);
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT recibido, cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado');
    process.exit(0);
  });
});

module.exports = app;