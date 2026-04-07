const express = require('express');
const { protect } = require('../middleware/auth');
const { saveSubscription, deleteSubscription } = require('../controllers/notificationController');

const router = express.Router();

router.use(protect);
router.post('/subscribe', saveSubscription);
router.post('/unsubscribe', deleteSubscription);

module.exports = router;