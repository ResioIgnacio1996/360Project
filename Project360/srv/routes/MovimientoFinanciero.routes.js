const router=require('express').Router();const {verificarToken}=require('../middlewares/auth.middleware');const {requierePermiso}=require('../middlewares/permiso.middleware');const c=require('../controllers/MovimientoFinanciero.controller');
router.get('/proyectos/:proyectoId',verificarToken,requierePermiso('MOVIMIENTO_FINANCIERO_VER'),c.listar);
router.post('/proyectos/:proyectoId',verificarToken,requierePermiso('MOVIMIENTO_FINANCIERO_CREAR'),c.crear);
router.patch('/proyectos/:proyectoId/:movimientoId/anular',verificarToken,requierePermiso('MOVIMIENTO_FINANCIERO_ANULAR'),c.anular);
module.exports=router;
