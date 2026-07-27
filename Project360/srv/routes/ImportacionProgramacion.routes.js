const express=require('express');
const multer=require('multer');
const {verificarToken}=require('../middlewares/auth.middleware');
const controller=require('../controllers/ImportacionProgramacion.controller');
const router=express.Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:6}});
router.post('/proyectos/:id/previsualizar',verificarToken,upload.fields([{name:'etapas',maxCount:1},{name:'responsables',maxCount:1},{name:'operaciones',maxCount:1},{name:'materiales',maxCount:1},{name:'calendario',maxCount:1},{name:'excepciones',maxCount:1}]),controller.previsualizar);
router.post('/proyectos/:id/importar',verificarToken,controller.importar);
module.exports=router;
