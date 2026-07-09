const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middlewares/auth.middleware');
const usuarioController = require('../controllers/usuario/Usuarios.controller');

router.get('/', verificarToken, usuarioController.getUsuarios);
router.get('/:id', verificarToken, usuarioController.getUsuarioById);
router.post('/', verificarToken, usuarioController.crearUsuarioConRol);
router.put('/:id', verificarToken, usuarioController.updateUsuario);
router.delete('/:id', verificarToken, usuarioController.deleteUsuario);

router.put('/:id/rol', verificarToken, usuarioController.cambiarRolUsuario);
router.get('/:id/permisos', verificarToken, usuarioController.obtenerPermisosUsuario);
router.post('/roles/:rol_id/permisos', verificarToken, usuarioController.asignarPermisosRol);
router.put('/roles/:rol_id/permisos', verificarToken, usuarioController.reemplazarPermisosRol);
router.put('/:id/estado',verificarToken,usuarioController.cambiarEstadoUsuario);

module.exports = router;