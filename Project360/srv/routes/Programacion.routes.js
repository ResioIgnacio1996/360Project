const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const controller = require('../controllers/Programacion.controller');

router.get('/proyectos/:id', verificarToken, controller.getProgramacion);
router.post('/proyectos/:id/operaciones', verificarToken, controller.crearOperacion);
router.post('/proyectos/:id/excepciones', verificarToken, controller.guardarExcepcionCalendario);
router.patch('/operaciones/:id/duracion', verificarToken, controller.actualizarDuracion);
router.patch('/operaciones/:id/nmt', verificarToken, controller.actualizarNmt);
router.patch('/operaciones/:id', verificarToken, controller.actualizarOperacion);

module.exports = router;
