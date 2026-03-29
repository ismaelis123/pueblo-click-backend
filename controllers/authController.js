const User = require('../models/User');
const generateToken = require('../utils/generateToken');

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
    const { name, phone, password } = req.body;
    const userExists = await User.findOne({ phone });
    if (userExists) return res.status(400).json({ message: 'Usuario ya existe' });

    const profilePhoto = req.files?.profilePhoto ? req.files.profilePhoto[0].path : '';
    const motoPhotos = req.files?.motoPhotos ? req.files.motoPhotos.map(file => file.path) : [];

    const user = await User.create({
      name, phone, password, role: 'mandadito',
      profilePhoto, motoPhotos, credit: 15, isActive: true
    });

    res.status(201).json({
      _id: user._id, name: user.name, phone: user.phone, role: user.role,
      credit: user.credit, token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    
    if (user && (await user.matchPassword(password))) {
      // Verificar si el usuario está activo
      if (!user.isActive) {
        return res.status(401).json({ message: 'Tu cuenta ha sido bloqueada. Contacta al administrador.' });
      }
      
      res.json({
        _id: user._id, name: user.name, phone: user.phone,
        role: user.role, credit: user.credit, token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Credenciales inválidas' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerClient, registerMandadito, login };