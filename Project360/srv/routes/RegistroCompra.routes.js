// routes/RegistroCompra.routes.js

const express = require('express');
const multer = require('multer');

const { verificarToken } = require('../middlewares/auth.middleware');
const {
    extraerRegistroCompraDocumento
} = require('../controllers/materiales/procesoDocuemntos.controller');

const {
    getRegistrosCompra,
    getRegistroCompraById,
    crearRegistroCompra,
    actualizarRegistroCompra,
    cancelarRegistroCompra
} = require('../controllers/materiales/RegistroCompra.controller');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const tiposPermitidos = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp'
        ];

        if (!tiposPermitidos.includes(file.mimetype)) {
            return cb(new Error('Solo se permiten PDF, JPG, JPEG, PNG y WEBP'), false);
        }

        cb(null, true);
    }
});

router.get('/', verificarToken, getRegistrosCompra);

router.post(
    '/documento',
    verificarToken,
    upload.single('documento'),
    extraerRegistroCompraDocumento
);

router.get('/:id', verificarToken, getRegistroCompraById);

router.post('/', verificarToken, crearRegistroCompra);

router.put('/:id', verificarToken, actualizarRegistroCompra);

router.put('/:id/cancelar', verificarToken, cancelarRegistroCompra);

module.exports = router;
