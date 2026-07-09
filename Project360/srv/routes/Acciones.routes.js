const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const accionesController = require('../controllers/usuario/Acciones.controller');

const verificarToken = authMiddleware.verificarToken;

router.get('/', verificarToken, accionesController.getAcciones);
router.get('/:id', verificarToken, accionesController.getAccionById);
router.post('/', verificarToken, accionesController.createAccion);
router.put('/:id', verificarToken, accionesController.updateAccion);
router.delete('/:id', verificarToken, accionesController.deleteAccion);

module.exports = router;