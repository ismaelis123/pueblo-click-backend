const express = require('express');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const {
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
} = require('../controllers/adminController');
const router = express.Router();

router.use(protect);
router.use(roleCheck('admin'));

router.get('/deposits/pending', getPendingDeposits);
router.put('/deposits/:depositId/confirm', confirmDeposit);
router.get('/report', getAdminReport);
router.get('/users', getAllUsers);
router.put('/users/:userId/block', blockUser);
router.put('/users/:userId/unblock', unblockUser);
router.delete('/users/:userId', deleteUser);
router.put('/users/:userId/credit', addCredit);
router.get('/mandaditos/pending', getPendingVerification);
router.put('/mandaditos/verify', verifyMandadito);

module.exports = router;