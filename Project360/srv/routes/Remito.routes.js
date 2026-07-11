const express = require('express');
const multer = require('multer');

const { verificarToken } = require('../middlewares/auth.middleware');
const {
    extraerRemitoDocumento
} = require('../controllers/materiales/procesoDocuemntos.controller');

const {
    getRemitos,
    getRemitoById,
    getRemitosByRegistroCompra,
    crearRemito,
    liberarRemito
} = require('../controllers/materiales/Remito.controller');

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

router.get('/', verificarToken, getRemitos);

router.get('/registro-compra/:id',verificarToken,getRemitosByRegistroCompra);

router.post(
    '/documento',
    verificarToken,
    upload.single('documento'),
    extraerRemitoDocumento
);

router.get('/:id', verificarToken, getRemitoById);

router.post('/', verificarToken, crearRemito);

router.put('/:id/liberar', verificarToken, liberarRemito);

module.exports = router;
