const express = require('express');
const { protect } = require('../middleware/auth');
const { createComplaint, getUserComplaints } = require('../controllers/complaintController');

const router = express.Router();

router.use(protect);

router.post('/', createComplaint);
router.get('/my', getUserComplaints);

module.exports = router;