const router=require('express').Router();const {verificarToken}=require('../middlewares/auth.middleware');const {requierePermiso}=require('../middlewares/permiso.middleware');const c=require('../controllers/EconomiaOperacion.controller');
router.get('/permisos',verificarToken,c.permisos);
router.get('/proyectos/:proyectoId/operaciones',verificarToken,requierePermiso('COSTOS_VER'),c.listar);
router.get('/proyectos/:proyectoId/dashboard',verificarToken,requierePermiso('COSTOS_VER'),c.dashboard);
router.post('/proyectos/:proyectoId/importacion/preview',verificarToken,requierePermiso('ECONOMIA_OPERACION_EDITAR'),c.previewImportacion);
router.post('/proyectos/:proyectoId/importacion',verificarToken,requierePermiso('ECONOMIA_OPERACION_EDITAR'),c.importar);
router.patch('/operaciones/:operacionId',verificarToken,requierePermiso('ECONOMIA_OPERACION_EDITAR'),c.actualizar);
router.get('/operaciones/:operacionId/historial',verificarToken,requierePermiso('COSTOS_VER'),c.historial);
module.exports=router;
