const { conectarDB, sql } = require('../DB/dbConection');
const campos = 'p.proyecto_id,p.cliente_id,p.nombre,p.cliente,p.direccion,p.fecha_inicio,p.fecha_fin_estimada,p.estado';

const normalizarFecha = (valor) => {
  if (!valor) return null;
  const texto = String(valor).substring(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null;
};

const getProyectos = async (_req,res) => { try { const pool=await conectarDB(); const r=await pool.request().query(`SELECT ${campos}, CONCAT(c.nombre,' ',c.apellido) cliente_nombre FROM Proyecto p LEFT JOIN Cliente c ON c.id_cliente=p.cliente_id ORDER BY p.proyecto_id DESC`); res.json(r.recordset); } catch(e){ res.status(500).json({message:'Error al obtener proyectos',error:e.message}); } };
const getProyectoById = async (req,res) => { try { const pool=await conectarDB(); const r=await pool.request().input('id',sql.BigInt,req.params.id).query(`SELECT ${campos}, CONCAT(c.nombre,' ',c.apellido) cliente_nombre FROM Proyecto p LEFT JOIN Cliente c ON c.id_cliente=p.cliente_id WHERE p.proyecto_id=@id`); if(!r.recordset.length)return res.status(404).json({message:'Proyecto no encontrado'}); res.json(r.recordset[0]); } catch(e){res.status(500).json({message:'Error al obtener proyecto',error:e.message});} };

const guardar = async (req,res,editar) => {
  const {cliente_id,nombre,direccion,estado}=req.body;
  const fecha_inicio = normalizarFecha(req.body.fecha_inicio);
  const fecha_fin_estimada = normalizarFecha(req.body.fecha_fin_estimada);
  if(!cliente_id||!nombre?.trim())return res.status(400).json({message:'Cliente y nombre son obligatorios'});
  if (req.body.fecha_inicio && !fecha_inicio) return res.status(400).json({message:'La fecha de inicio no es válida'});
  if (req.body.fecha_fin_estimada && !fecha_fin_estimada) return res.status(400).json({message:'La fecha de fin estimada no es válida'});
  if(fecha_inicio&&fecha_fin_estimada&&Date.parse(`${fecha_fin_estimada}T00:00:00`) < Date.parse(`${fecha_inicio}T00:00:00`))return res.status(400).json({message:'La fecha de fin estimada no puede ser anterior al inicio'});
  try { const pool=await conectarDB(); const q=pool.request().input('id',sql.BigInt,req.params.id||null).input('cliente_id',sql.BigInt,cliente_id).input('nombre',sql.VarChar(150),nombre.trim()).input('direccion',sql.VarChar(250),direccion?.trim()||null).input('inicio',sql.Date,fecha_inicio||null).input('fin',sql.Date,fecha_fin_estimada||null).input('estado',sql.VarChar(50),estado||'ACTIVO');
    const r=await q.query(editar?'UPDATE Proyecto SET cliente_id=@cliente_id,nombre=@nombre,direccion=@direccion,fecha_inicio=@inicio,fecha_fin_estimada=@fin,estado=@estado OUTPUT INSERTED.* WHERE proyecto_id=@id':'INSERT INTO Proyecto(cliente_id,nombre,direccion,fecha_inicio,fecha_fin_estimada,estado) OUTPUT INSERTED.* VALUES(@cliente_id,@nombre,@direccion,@inicio,@fin,@estado)');
    if(!r.recordset.length)return res.status(404).json({message:'Proyecto no encontrado'}); res.status(editar?200:201).json({message:`Proyecto ${editar?'actualizado':'creado'} correctamente`,proyecto:r.recordset[0]});
  } catch(e){res.status(500).json({message:'Error al guardar proyecto',error:e.message});}
};
const createProyecto=(req,res)=>guardar(req,res,false); const updateProyecto=(req,res)=>guardar(req,res,true);
const deleteProyecto=async(req,res)=>{try{const pool=await conectarDB();const r=await pool.request().input('id',sql.BigInt,req.params.id).query('DELETE FROM Proyecto WHERE proyecto_id=@id');if(!r.rowsAffected[0])return res.status(404).json({message:'Proyecto no encontrado'});res.json({message:'Proyecto eliminado correctamente'});}catch(e){res.status(409).json({message:'No se puede eliminar un proyecto con movimientos asociados'});}};
module.exports={getProyectos,getProyectoById,createProyecto,updateProyecto,deleteProyecto};
