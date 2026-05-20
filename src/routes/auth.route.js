const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const uploadMedicalLicense = require('../middlewares/medical-license.middleware');

// Route Login & Register
router.post('/register', uploadMedicalLicense, authController.register);
router.post('/login', authController.login);
router.get('/google', authController.redirectToGoogle);
router.get('/google/callback', authController.googleCallback);
// router.get('/users', authMiddleware, authController.getUsers);
// router.get('/users/:id', authMiddleware, authController.getUserById);

module.exports = router;
