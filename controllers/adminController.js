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

    res.json({ message: 'Crédito agregado', credit: mandadito.credit });
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
    const finishedOrders = await Order.find({ status: 'finished' });
    const totalOrders = finishedOrders.length;
    const totalEarnings = totalOrders * 5;

    const confirmedDeposits = await Deposit.aggregate([
      { $match: { adminConfirmed: true } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalDeposits = confirmedDeposits[0]?.total || 0;

    const totalMandaditos = await User.countDocuments({ role: 'mandadito' });
    const totalClients = await User.countDocuments({ role: 'client' });

    res.json({ totalOrders, totalEarnings, totalDeposits, totalMandaditos, totalClients });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { confirmDeposit, getPendingDeposits, getAdminReport };