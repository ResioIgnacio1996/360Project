const express = require('express');
const router = express.Router();

const { login } = require('../controllers/usuario/Auth.controller');

// 🔓 Ruta pública (NO lleva middleware)
router.post('/login', login);

module.exports = router;