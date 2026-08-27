const { conectarDB }=require('../DB/dbConection');const service=require('../services/MovimientoFinanciero.service');
const error=(res,e)=>res.status(e.status||500).json({message:e.status?e.message:'No se pudo procesar el movimiento financiero',...(e.status?{}:{error:e.message})});
exports.listar=async(req,res)=>{try{res.json(await service.listar(await conectarDB(),Number(req.params.proyectoId)));}catch(e){error(res,e);}};
exports.crear=async(req,res)=>{try{res.status(201).json(await service.crear(await conectarDB(),Number(req.params.proyectoId),req.body,req.usuario.usuario_id));}catch(e){error(res,e);}};
exports.anular=async(req,res)=>{try{res.json(await service.anular(await conectarDB(),Number(req.params.proyectoId),Number(req.params.movimientoId),req.body.motivo,req.usuario.usuario_id));}catch(e){error(res,e);}};
