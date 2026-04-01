const User = require('../models/User');
const Deposit = require('../models/Deposit');
const Order = require('../models/Order');

const confirmDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.depositId);
    if (!deposit) return res.status(404).json({ message: 'Depósito no encontrado' });
    if (deposit.adminConfirmed) return res.status(400).json({ message: 'Ya confirmado' });

    deposit.adminConfirmed = true;
    deposit.confirmedAt = new Date();
    await deposit.save();

    const mandadito = await User.findById(deposit.mandadito);
    mandadito.credit += deposit.amount;
    await mandadito.save();

    res.json({ message: `Crédito de C$${deposit.amount} agregado a ${mandadito.name}`, credit: mandadito.credit });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPendingDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({ adminConfirmed: false }).populate('mandadito', 'name phone');
    res.json(deposits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAdminReport = async (req, res) => {
  try {
    const completedOrders = await Order.find({ status: 'completed' });
    const totalOrders = completedOrders.length;
    const totalEarnings = totalOrders * 5;

    const confirmedDeposits = await Deposit.aggregate([
      { $match: { adminConfirmed: true } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalDeposits = confirmedDeposits[0]?.total || 0;

    const totalMandaditos = await User.countDocuments({ role: 'mandadito', isActive: true });
    const totalClients = await User.countDocuments({ role: 'client', isActive: true });
    const blockedUsers = await User.countDocuments({ isActive: false });
    const pendingVerification = await User.countDocuments({ role: 'mandadito', isVerified: false, isActive: true });

    res.json({ totalOrders, totalEarnings, totalDeposits, totalMandaditos, totalClients, blockedUsers, pendingVerification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const blockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    
    user.isActive = false;
    await user.save();
    
    res.json({ message: `Usuario ${user.name} bloqueado exitosamente`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const unblockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    
    user.isActive = true;
    await user.save();
    
    res.json({ message: `Usuario ${user.name} desbloqueado exitosamente`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    
    const activeOrders = await Order.findOne({
      $or: [
        { client: user._id, status: { $in: ['pending', 'accepted', 'delivered'] } },
        { mandadito: user._id, status: { $in: ['pending', 'accepted', 'delivered'] } }
      ]
    });
    
    if (activeOrders) {
      return res.status(400).json({ message: 'No se puede eliminar. El usuario tiene órdenes activas.' });
    }
    
    await user.deleteOne();
    res.json({ message: `Usuario ${user.name} eliminado exitosamente` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addCredit = async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    
    user.credit += amount;
    await user.save();
    
    res.json({ message: `C$${amount} agregados a ${user.name}`, credit: user.credit });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// NUEVO: Verificar mandadito (aprobar documentos)
const verifyMandadito = async (req, res) => {
  try {
    const { userId, approved, message } = req.body;
    const mandadito = await User.findById(userId);
    
    if (!mandadito || mandadito.role !== 'mandadito') {
      return res.status(404).json({ message: 'Mandadito no encontrado' });
    }
    
    mandadito.isVerified = approved;
    mandadito.verificationMessage = message || (approved ? 'Documentos verificados. Ya puedes aceptar mandados.' : 'Tus documentos no fueron aprobados. Contacta al administrador.');
    await mandadito.save();
    
    const io = req.app.get('io');
    io.to(userId).emit('verificationStatus', {
      isVerified: approved,
      message: mandadito.verificationMessage
    });
    
    res.json({ 
      message: approved ? `Mandadito ${mandadito.name} verificado exitosamente` : `Mandadito ${mandadito.name} no verificado`,
      mandadito 
    });
  } catch (error) {
    console.error('Error en verifyMandadito:', error);
    res.status(500).json({ message: error.message });
  }
};

// NUEVO: Obtener mandaditos pendientes de verificación
const getPendingVerification = async (req, res) => {
  try {
    const mandaditos = await User.find({ 
      role: 'mandadito', 
      isVerified: false,
      isActive: true 
    }).select('-password');
    res.json(mandaditos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  confirmDeposit,
  getPendingDeposits,
  getAdminReport,
  getAllUsers,
  blockUser,
  unblockUser,
  deleteUser,
  addCredit,
  verifyMandadito,
  getPendingVerification,
};