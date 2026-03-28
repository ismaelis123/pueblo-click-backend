const express = require('express');
const { registerClient, registerMandadito, login } = require('../controllers/authController');
const upload = require('../middleware/upload');
const router = express.Router();

router.post('/register/client', registerClient);
router.post(
  '/register/mandadito',
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'motoPhotos', maxCount: 2 },
  ]),
  registerMandadito
);
router.post('/login', login);

module.exports = router;