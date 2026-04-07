const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const imageToBase64 = require('../utils/imageToBase64');

const registerClient = async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    const userExists = await User.findOne({ phone });
    if (userExists) return res.status(400).json({ message: 'Usuario ya existe' });
    
    const user = await User.create({ name, phone, password, role: 'client', isActive: true });
    res.status(201).json({ _id: user._id, name: user.name, phone: user.phone, role: user.role, token: generateToken(user._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const registerMandadito = async (req, res) => {
  try {
    const { name, phone, password, workSchedule } = req.body;
    console.log('📝 Registrando mandadito:', { name, phone });
    
    const userExists = await User.findOne({ phone });
    if (userExists) return res.status(400).json({ message: 'El teléfono ya está registrado' });
    
    // Convertir imágenes a Base64
    let profilePhoto = '', cedulaPhoto = '', seguroPhoto = '', licenciaPhoto = '';
    let motoPhotos = [];
    
    if (req.files) {
      if (req.files.profilePhoto) profilePhoto = imageToBase64(req.files.profilePhoto[0]);
      if (req.files.motoPhotos) motoPhotos = req.files.motoPhotos.map(file => imageToBase64(file));
      if (req.files.cedulaPhoto) cedulaPhoto = imageToBase64(req.files.cedulaPhoto[0]);
      if (req.files.seguroPhoto) seguroPhoto = imageToBase64(req.files.seguroPhoto[0]);
      if (req.files.licenciaPhoto) licenciaPhoto = imageToBase64(req.files.licenciaPhoto[0]);
    }
    
    // Parsear horario de trabajo si viene
    let parsedWorkSchedule = {
      enabled: true,
      startTime: '08:00',
      endTime: '17:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      workDays: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false }
    };
    
    if (workSchedule) {
      try {
        parsedWorkSchedule = typeof workSchedule === 'string' ? JSON.parse(workSchedule) : workSchedule;
      } catch (e) {
        console.log('Error parseando workSchedule:', e);
      }
    }
    
    const user = await User.create({
      name, phone, password, role: 'mandadito',
      profilePhoto, motoPhotos, cedulaPhoto, seguroPhoto, licenciaPhoto,
      credit: 15, isActive: true, isVerified: false,
      workSchedule: parsedWorkSchedule
    });
    
    res.status(201).json({
      _id: user._id, name: user.name, phone: user.phone, role: user.role,
      credit: user.credit, isVerified: user.isVerified, workSchedule: user.workSchedule,
      message: 'Registro exitoso. Tus documentos están pendientes de verificación.',
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error('❌ Error en registerMandadito:', error);
    res.status(500).json({ message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    
    if (user && (await user.matchPassword(password))) {
      if (!user.isActive) return res.status(401).json({ message: 'Tu cuenta ha sido bloqueada.' });
      
      // Actualizar disponibilidad según horario
      if (user.role === 'mandadito') await user.updateAvailability();
      
      res.json({
        _id: user._id, name: user.name, phone: user.phone, role: user.role,
        credit: user.credit, profilePhoto: user.profilePhoto,
        isVerified: user.isVerified, workSchedule: user.workSchedule,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Credenciales inválidas' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerClient, registerMandadito, login };