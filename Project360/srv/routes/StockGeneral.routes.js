const express = require('express');

const { verificarToken } = require('../middlewares/auth.middleware');

const {
    getStockGeneral,
    asignarStockAProyecto,
    getStockPorProyecto,
    devolverStockDeProyecto
} = require('../controllers/materiales/StockGeneral.controller');

const router = express.Router();

router.get('/', verificarToken, getStockGeneral);

router.post('/asignar-proyecto', verificarToken, asignarStockAProyecto);
router.get('/proyecto/:proyectoId', verificarToken, getStockPorProyecto);
router.post('/devolver-proyecto', verificarToken, devolverStockDeProyecto);

module.exports = router;
