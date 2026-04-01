const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const imageToBase64 = require('../utils/imageToBase64');

const registerClient = async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    const userExists = await User.findOne({ phone });
    if (userExists) return res.status(400).json({ message: 'Usuario ya existe' });
    
    const user = await User.create({ 
      name, phone, password, 
      role: 'client', 
      isActive: true 
    });
    
    res.status(201).json({ 
      _id: user._id, 
      name: user.name, 
      phone: user.phone, 
      role: user.role, 
      token: generateToken(user._id) 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const registerMandadito = async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    console.log('📝 Registrando mandadito:', { name, phone });
    console.log('📸 Archivos recibidos:', req.files ? Object.keys(req.files) : 'ninguno');
    
    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({ message: 'El teléfono ya está registrado' });
    }
    
    // Convertir imágenes a Base64
    let profilePhoto = '';
    let motoPhotos = [];
    let cedulaPhoto = '';
    let seguroPhoto = '';
    let licenciaPhoto = '';
    
    if (req.files) {
      if (req.files.profilePhoto) {
        profilePhoto = imageToBase64(req.files.profilePhoto[0]);
        console.log('✅ Foto de perfil convertida');
      }
      if (req.files.motoPhotos) {
        motoPhotos = req.files.motoPhotos.map(file => imageToBase64(file));
        console.log(`✅ ${motoPhotos.length} foto(s) de vehículo convertidas`);
      }
      if (req.files.cedulaPhoto) {
        cedulaPhoto = imageToBase64(req.files.cedulaPhoto[0]);
        console.log('✅ Foto de cédula convertida');
      }
      if (req.files.seguroPhoto) {
        seguroPhoto = imageToBase64(req.files.seguroPhoto[0]);
        console.log('✅ Foto de seguro convertida');
      }
      if (req.files.licenciaPhoto) {
        licenciaPhoto = imageToBase64(req.files.licenciaPhoto[0]);
        console.log('✅ Foto de licencia convertida');
      }
    }
    
    // Validaciones básicas
    if (!profilePhoto) {
      return res.status(400).json({ message: 'La foto de perfil es requerida' });
    }
    if (motoPhotos.length === 0) {
      return res.status(400).json({ message: 'Debes subir al menos una foto del vehículo' });
    }
    if (!cedulaPhoto) {
      return res.status(400).json({ message: 'La foto de la cédula es requerida' });
    }
    if (!seguroPhoto) {
      return res.status(400).json({ message: 'La foto del seguro es requerida' });
    }
    if (!licenciaPhoto) {
      return res.status(400).json({ message: 'La foto de la licencia de conducir es requerida' });
    }
    
    const user = await User.create({
      name,
      phone,
      password,
      role: 'mandadito',
      profilePhoto,
      motoPhotos,
      cedulaPhoto,
      seguroPhoto,
      licenciaPhoto,
      credit: 15,
      isActive: true,
      isVerified: false, // Pendiente de verificación por admin
    });
    
    console.log(`✅ Mandadito ${name} registrado exitosamente`);
    
    res.status(201).json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      credit: user.credit,
      isVerified: user.isVerified,
      message: 'Registro exitoso. Tus documentos están pendientes de verificación por el administrador. Podrás aceptar mandados una vez verificados.',
      token: generateToken(user._id),
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
      if (!user.isActive) {
        return res.status(401).json({ message: 'Tu cuenta ha sido bloqueada. Contacta al administrador.' });
      }
      
      res.json({
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        credit: user.credit,
        profilePhoto: user.profilePhoto,
        isVerified: user.isVerified,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Credenciales inválidas' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerClient, registerMandadito, login };