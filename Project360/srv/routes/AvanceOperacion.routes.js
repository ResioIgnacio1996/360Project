const router = require('express').Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const controller = require('../controllers/AvanceOperacion.controller');

router.get('/proyectos/:id', verificarToken, controller.obtener);
router.post('/operaciones/:id/iniciar', verificarToken, controller.iniciar);
router.patch('/operaciones/:id/fecha-inicio', verificarToken, controller.modificarFechaInicio);
router.post('/operaciones/:id/finalizar', verificarToken, controller.finalizar);
router.patch('/operaciones/:id/fecha-fin', verificarToken, controller.modificarFechaFin);
router.post('/operaciones/:id/avances', verificarToken, controller.registrarAvance);
router.post('/operaciones/:id/consumos', verificarToken, controller.registrarConsumos);

module.exports = router;
