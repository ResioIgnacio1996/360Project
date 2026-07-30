const router = require('express').Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const controller = require('../controllers/Sistema.controller');

router.get('/fecha-actual', verificarToken, controller.fechaActual);

module.exports = router;
