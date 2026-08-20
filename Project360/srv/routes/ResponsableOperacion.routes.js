const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const controller = require('../controllers/ResponsableOperacion.controller');

router.get('/', verificarToken, controller.getResponsables);
router.get('/:id', verificarToken, controller.getResponsableById);
router.post('/', verificarToken, controller.createResponsable);
router.put('/:id', verificarToken, controller.updateResponsable);
router.patch('/:id/estado', verificarToken, controller.cambiarEstadoResponsable);

module.exports = router;
