const express = require('express');
const router = express.Router();

const {
    getProveedores,
    getProveedorById,
    getRubrosProveedor,
    createRubroProveedor,
    createProveedor,
    updateProveedor,
    deleteProveedor
} = require('../controllers/Proveedor.controller');

const { verificarToken } = require('../middlewares/auth.middleware');

router.get('/', verificarToken, getProveedores);
router.get('/rubros/lista', verificarToken, getRubrosProveedor);
router.post('/rubros', verificarToken, createRubroProveedor);
router.get('/:id', verificarToken, getProveedorById);

router.post('/', verificarToken, createProveedor);

router.put('/:id', verificarToken, updateProveedor);

router.delete('/:id', verificarToken, deleteProveedor);

module.exports = router;
