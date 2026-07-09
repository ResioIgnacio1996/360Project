const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middlewares/auth.middleware');
const accionRolController = require('../controllers/usuario/AccionRol.controller');

router.get('/', verificarToken, accionRolController.getAccionesRol);
router.get('/:id', verificarToken, accionRolController.getAccionRolById);
router.post('/', verificarToken, accionRolController.createAccionRol);
router.put('/:id', verificarToken, accionRolController.updateAccionRol);
router.delete('/:id', verificarToken, accionRolController.deleteAccionRol);

module.exports = router;