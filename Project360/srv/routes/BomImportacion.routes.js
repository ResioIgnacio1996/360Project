const router = require('express').Router();
const multer = require('multer');
const { verificarToken } = require('../middlewares/auth.middleware');
const controller = require('../controllers/BomImportacion.controller');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

router.get('/proyectos/:id', verificarToken, controller.listar);
router.get('/proyectos/:id/contexto', verificarToken, controller.contextoEdicion);
router.post('/proyectos/:id/lineas', verificarToken, controller.crearLinea);
router.put('/proyectos/:id/lineas/:bomId', verificarToken, controller.actualizarLinea);
router.delete('/proyectos/:id/lineas/:bomId', verificarToken, controller.eliminarLinea);
router.post('/proyectos/:id/previsualizar', verificarToken, upload.single('bom'), controller.previsualizar);
router.post('/proyectos/:id/importar', verificarToken, controller.importar);

module.exports = router;
