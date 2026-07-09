const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middlewares/auth.middleware');
const entidadController = require('../controllers/usuario/Entidad.controller');



router.get('/', verificarToken, entidadController.getEntidades);
router.get('/:id', verificarToken, entidadController.getEntidadById);
router.post('/', verificarToken, entidadController.createEntidad);
router.put('/:id', verificarToken, entidadController.updateEntidad);
router.delete('/:id', verificarToken, entidadController.deleteEntidad);

module.exports = router; 