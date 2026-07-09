const express = require('express');

const { verificarToken } = require('../middlewares/auth.middleware');

const {
    getStockGeneral,
    asignarStockAProyecto
} = require('../controllers/materiales/StockGeneral.controller');

const router = express.Router();

router.get('/', verificarToken, getStockGeneral);

router.post('/asignar-proyecto', verificarToken, asignarStockAProyecto);

module.exports = router;