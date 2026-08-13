const express = require('express');

const { verificarToken } = require('../middlewares/auth.middleware');

const {
    getStockGeneral,
    asignarStockAProyecto,
    getStockPorProyecto,
    getMovimientosMaterialProyecto,
    devolverStockDeProyecto
} = require('../controllers/materiales/StockGeneral.controller');

const router = express.Router();

router.get('/', verificarToken, getStockGeneral);

router.post('/asignar-proyecto', verificarToken, asignarStockAProyecto);
router.get('/proyecto/:proyectoId', verificarToken, getStockPorProyecto);
router.get('/proyecto/:proyectoId/material/:materialId/movimientos', verificarToken, getMovimientosMaterialProyecto);
router.post('/devolver-proyecto', verificarToken, devolverStockDeProyecto);

module.exports = router;
