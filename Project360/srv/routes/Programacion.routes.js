const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const controller = require('../controllers/Programacion.controller');

router.get('/proyectos/:id', verificarToken, controller.getProgramacion);
router.patch('/operaciones/:id/duracion', verificarToken, controller.actualizarDuracion);
router.patch('/operaciones/:id/nmt', verificarToken, controller.actualizarNmt);

module.exports = router;
