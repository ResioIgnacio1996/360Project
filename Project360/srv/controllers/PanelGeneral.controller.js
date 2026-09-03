const { conectarDB } = require('../DB/dbConection');
const service = require('../services/PanelGeneral.service');

const enteroOpcional = valor => valor === undefined || valor === '' ? null : Number(valor);
const fechaLocal = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

const obtener = async (req,res) => {
  const proyectoId=Number(req.params.id);
  const fecha=String(req.query.fecha_corte||fechaLocal());
  const etapa=enteroOpcional(req.query.etapa_id),responsable=enteroOpcional(req.query.responsable_id);
  const ventana=Math.min(365,Math.max(1,Number(req.query.ventana_dias)||30));
  if(!Number.isInteger(proyectoId)||proyectoId<=0)return res.status(400).json({message:'Proyecto inválido'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)))return res.status(400).json({message:'Fecha de corte inválida'});
  if((etapa!==null&&(!Number.isInteger(etapa)||etapa<=0))||(responsable!==null&&(!Number.isInteger(responsable)||responsable<=0)))return res.status(400).json({message:'Filtros inválidos'});
  try{res.json(await service.obtener(await conectarDB(),proyectoId,{fecha_corte:fecha,etapa_id:etapa,responsable_id:responsable,ventana_dias:ventana}));}
  catch(error){if(!error.status)console.error('Error al cargar Panel General:',error);res.status(error.status||500).json({message:error.status?error.message:'No se pudo cargar el Panel General',...(error.status?{}:{error:error.message})});}
};
module.exports={obtener};
