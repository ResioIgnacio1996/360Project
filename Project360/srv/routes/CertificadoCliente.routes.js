const router=require('express').Router();const {verificarToken}=require('../middlewares/auth.middleware');const {requierePermiso}=require('../middlewares/permiso.middleware');const c=require('../controllers/CertificadoCliente.controller');
router.post('/proyectos/:proyectoId/preview-fecha',verificarToken,requierePermiso('CERTIFICADO_CLIENTE_PREVIEW'),c.preview);
router.post('/proyectos/:proyectoId/preview',verificarToken,requierePermiso('CERTIFICADO_CLIENTE_PREVIEW'),c.preview);
router.post('/proyectos/:proyectoId',verificarToken,requierePermiso('CERTIFICADO_CLIENTE_EMITIR'),c.emitir);
router.delete('/proyectos/:proyectoId/:certificadoId',verificarToken,requierePermiso('CERTIFICADO_CLIENTE_ELIMINAR'),c.eliminar);
router.get('/proyectos/:proyectoId',verificarToken,requierePermiso('CERTIFICADO_CLIENTE_VER'),c.listar);
router.get('/proyectos/:proyectoId/:certificadoId/pdf',verificarToken,requierePermiso('CERTIFICADO_CLIENTE_VER'),c.pdf);
router.get('/proyectos/:proyectoId/:certificadoId',verificarToken,requierePermiso('CERTIFICADO_CLIENTE_VER'),c.detalle);
module.exports=router;
