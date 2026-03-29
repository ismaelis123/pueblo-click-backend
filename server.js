const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const mandaditoRoutes = require('./routes/mandaditoRoutes');
const adminRoutes = require('./routes/adminRoutes');
const socketHandler = require('./sockets/socketHandler');

// Cargar variables de entorno
dotenv.config();

// Conectar a MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Configurar CORS para producción
const allowedOrigins = [
  'https://puebloclick.netlify.app/',  // Cambia por tu frontend cuando lo tengas
  'http://localhost:5173',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Socket.io
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

app.set('io', io);

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/mandadito', mandaditoRoutes);
app.use('/api/admin', adminRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Pueblo Click funcionando correctamente',
    version: '1.0.0',
    status: 'online'
  });
});

// Manejo de errores
app.use(notFound);
app.use(errorHandler);

// Socket handler
socketHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📱 API disponible en http://localhost:${PORT}`);
  console.log(`🌍 Modo: ${process.env.NODE_ENV || 'development'}`);
});