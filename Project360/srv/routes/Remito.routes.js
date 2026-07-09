const express = require('express');

const { verificarToken } = require('../middlewares/auth.middleware');

const {
    getRemitos,
    getRemitoById,
    getRemitosByRegistroCompra,
    crearRemito,
    liberarRemito
} = require('../controllers/materiales/Remito.controller');

const router = express.Router();

router.get('/', verificarToken, getRemitos);

router.get('/:id', verificarToken, getRemitoById);

router.get('/registro-compra/:id',verificarToken,getRemitosByRegistroCompra);

router.post('/', verificarToken, crearRemito);

router.put('/:id/liberar', verificarToken, liberarRemito);

module.exports = router;