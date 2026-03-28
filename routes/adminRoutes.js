const express = require('express');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { confirmDeposit, getPendingDeposits, getAdminReport } = require('../controllers/adminController');
const router = express.Router();

router.use(protect);
router.use(roleCheck('admin'));

router.get('/deposits/pending', getPendingDeposits);
router.put('/deposits/:depositId/confirm', confirmDeposit);
router.get('/report', getAdminReport);

module.exports = router;