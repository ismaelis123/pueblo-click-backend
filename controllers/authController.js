const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const imageToBase64 = require('../utils/imageToBase64');

const registerClient = async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    const userExists = await User.findOne({ phone });
    if (userExists) return res.status(400).json({ message: 'Usuario ya existe' });
    const user = await User.create({ name, phone, password, role: 'client' });
    res.status(201).json({ _id: user._id, name: user.name, phone: user.phone, role: user.role, token: generateToken(user._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const registerMandadito = async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    const userExists = await User.findOne({ phone });
    if (userExists) return res.status(400).json({ message: 'Usuario ya existe' });

    // Convertir imágenes a Base64
    let profilePhoto = '';
    let motoPhotos = [];

    if (req.files) {
      if (req.files.profilePhoto) {
        profilePhoto = imageToBase64(req.files.profilePhoto[0]);
      }
      if (req.files.motoPhotos) {
        motoPhotos = req.files.motoPhotos.map(file => imageToBase64(file));
      }
    }

    const user = await User.create({
      name,
      phone,
      password,
      role: 'mandadito',
      profilePhoto,
      motoPhotos,
      credit: 15,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      credit: user.credit,
      profilePhoto: user.profilePhoto ? user.profilePhoto.substring(0, 100) + '...' : '',
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('Error en registerMandadito:', error);
    res.status(500).json({ message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        credit: user.credit,
        profilePhoto: user.profilePhoto ? user.profilePhoto.substring(0, 100) + '...' : '',
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