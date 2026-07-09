const express = require('express');
const router = express.Router();

const {
    getClientes,
    getClienteById,
    createCliente,
    updateCliente,
    deleteCliente
} = require('../controllers/Cliente.controller');

const { verificarToken } = require('../middlewares/auth.middleware');

router.get('/', verificarToken, getClientes);
router.get('/:id', verificarToken, getClienteById);

router.post('/', verificarToken, createCliente);

router.put('/:id', verificarToken, updateCliente);

router.delete('/:id', verificarToken, deleteCliente);

module.exports = router;