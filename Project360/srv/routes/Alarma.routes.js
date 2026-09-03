const express = require('express');
const { verificarToken } = require('../middlewares/auth.middleware');
const { listar, marcarLeida, marcarTodasLeidas, aceptar, listarReglas, listarOpcionesCertificaciones, crearRegla, actualizarRegla, eliminarRegla } = require('../controllers/Alarma.controller');

const router = express.Router();
router.get('/', verificarToken, listar);
router.patch('/leer-todas', verificarToken, marcarTodasLeidas);
router.patch('/:id/leer', verificarToken, marcarLeida);
router.patch('/:id/aceptar', verificarToken, aceptar);
router.get('/proyectos/:proyectoId/reglas', verificarToken, listarReglas);
router.get('/proyectos/:proyectoId/certificaciones', verificarToken, listarOpcionesCertificaciones);
router.post('/proyectos/:proyectoId/reglas', verificarToken, crearRegla);
router.put('/proyectos/:proyectoId/reglas/:reglaId', verificarToken, actualizarRegla);
router.delete('/proyectos/:proyectoId/reglas/:reglaId', verificarToken, eliminarRegla);

module.exports = router;
