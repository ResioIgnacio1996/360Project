// routes/RegistroCompra.routes.js

const express = require('express');

const { verificarToken } = require('../middlewares/auth.middleware');

const {
    getRegistrosCompra,
    getRegistroCompraById,
    crearRegistroCompra,
    actualizarRegistroCompra,
    cancelarRegistroCompra
} = require('../controllers/materiales/RegistroCompra.controller');

const router = express.Router();

router.get('/', verificarToken, getRegistrosCompra);

router.get('/:id', verificarToken, getRegistroCompraById);

router.post('/', verificarToken, crearRegistroCompra);

router.put('/:id', verificarToken, actualizarRegistroCompra);

router.put('/:id/cancelar', verificarToken, cancelarRegistroCompra);

module.exports = router;