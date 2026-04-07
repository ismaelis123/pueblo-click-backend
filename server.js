const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

// ==================== 1. CARGAR VARIABLES DE ENTORNO PRIMERO ====================
dotenv.config();

// ==================== 2. VERIFICAR VARIABLES INMEDIATAMENTE ====================
console.log('🔍 Verificando variables de entorno:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('PORT:', process.env.PORT || 5000);
console.log('MONGO_URI:', process.env.MONGO_URI ? '✅ Configurada' : '❌ FALTA');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Configurada' : '❌ FALTA');
console.log('VAPID_PUBLIC_KEY:', process.env.VAPID_PUBLIC_KEY ? '✅ Configurada' : '❌ FALTA');
console.log('VAPID_PRIVATE_KEY:', process.env.VAPID_PRIVATE_KEY ? '✅ Configurada' : '❌ FALTA');

// ==================== 3. IMPORTAR DEPENDENCIAS QUE USAN ENV ====================
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const mandaditoRoutes = require('./routes/mandaditoRoutes');
const adminRoutes = require('./routes/adminRoutes');
const messageRoutes = require('./routes/messageRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const socketHandler = require('./sockets/socketHandler');

// ==================== 4. CONECTAR A MongoDB ====================
connectDB();

const app = express();
const server = http.createServer(app);

// ==================== 5. CONFIGURACIÓN CORS ====================
const allowedOrigins = [
  'https://puebloclick.netlify.app',
  'https://www.puebloclick.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://pueblo-click-backend.onrender.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`❌ CORS bloqueado para origen: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== 6. CONFIGURAR SOCKET.IO ====================
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

app.set('io', io);

// ==================== 7. RUTAS ====================
app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/mandadito', mandaditoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Pueblo Click funcionando correctamente',
    version: '2.0.0',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Health check para Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ==================== 8. MANEJO DE ERRORES ====================
app.use(notFound);
app.use(errorHandler);

// ==================== 9. SOCKET HANDLER ====================
socketHandler(io);

// ==================== 10. INICIAR SERVIDOR ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📱 API disponible en http://localhost:${PORT}`);
  console.log(`🌍 Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Servidor listo para recibir peticiones\n`);
});

// Manejar cierre graceful
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