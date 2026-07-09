const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middlewares/auth.middleware');

const {
  cambiarEstadoRol,
  getRoles,
  getRolById,
  createRol,
  updateRol,
  deleteRol,
  getPermisosRol
} = require('../controllers/usuario/RolUsuario.controller');

// Middleware JWT
router.use(verificarToken);

// CRUD Roles
router.get('/', getRoles);

// IMPORTANTE:
// debe ir antes que /:id
router.get('/:id/permisos', getPermisosRol);
router.put('/:id/estado', cambiarEstadoRol);
router.get('/:id', getRolById);
router.post('/', createRol);
router.put('/:id', updateRol);
router.delete('/:id', deleteRol);

module.exports = router;