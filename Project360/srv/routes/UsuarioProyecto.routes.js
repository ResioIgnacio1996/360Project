const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middlewares/auth.middleware');

const {
    asignarUsuarioProyecto,
    eliminarUsuarioProyecto
} = require('../controllers/usuario/UsuarioProyecto.controller');


// INSERT
router.post(
    '/',
    verificarToken,
    asignarUsuarioProyecto
);


// DELETE
router.delete(
    '/:id',
    verificarToken,
    eliminarUsuarioProyecto
);

module.exports = router;