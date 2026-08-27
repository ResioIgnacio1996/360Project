const { conectarDB, sql } = require('../DB/dbConection');

const requierePermiso = codigo => async (req,res,next) => {
  try {
    const rolId=Number(req.usuario?.rol_id);
    if(!Number.isInteger(rolId)) return res.status(403).json({message:'Rol no autorizado'});
    const pool=await conectarDB();
    const r=await pool.request().input('rol',sql.BigInt,rolId).input('codigo',sql.VarChar(100),codigo).query(`
      SELECT TOP 1 ar.permitido FROM Accion_Rol ar
      JOIN Accion a ON a.accion_id=ar.accion_id AND a.activo=1
      JOIN Entidad e ON e.entidad_id=ar.entidad_id AND e.activo=1
      WHERE ar.rol_id=@rol AND a.codigo=@codigo AND e.codigo='COSTOS_CERTIFICACIONES' AND ar.permitido=1`);
    if(!r.recordset.length) return res.status(403).json({message:`No posee el permiso ${codigo}`});
    next();
  } catch(error){ res.status(500).json({message:'No se pudo validar el permiso',error:error.message}); }
};
module.exports={requierePermiso};
