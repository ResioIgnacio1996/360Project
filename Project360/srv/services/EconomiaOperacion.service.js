const { sql } = require('../DB/dbConection');

async function listar(pool,proyectoId){
  const r=await pool.request().input('p',sql.BigInt,proyectoId).query(`
    SELECT p.proyecto_id,p.nombre,p.estado,p.activo,p.eliminado,p.cliente_id,
      COALESCE(NULLIF(c.razon_social,''),LTRIM(RTRIM(CONCAT(c.apellido,' ',c.nombre)))) cliente_nombre
    FROM Proyecto p LEFT JOIN Cliente c ON c.id_cliente=p.cliente_id WHERE p.proyecto_id=@p;
    SELECT o.operacion_id,o.secuencia,o.nombre,e.etapa_id,e.codigo etapa_codigo,e.nombre etapa_nombre,
      e.orden etapa_orden,e.peso_pct etapa_peso_pct,o.peso_pct peso_operacion,o.responsable_id,r.nombre responsable_nombre,o.pct_avance_actual,
      o.precio_cliente,o.costo_responsable,o.economia_actualizada_en,u.nombre economia_actualizada_por_nombre,
      o.cronograma_certificacion_fecha,o.numero_certificado_planificado,
      o.cronograma_certificacion_responsable_fecha,o.numero_certificado_responsable_planificado,
      ISNULL(cert.porcentaje_actual,0) pct_certificado_actual,
      ISNULL(cert_resp.porcentaje_actual,0) pct_certificado_responsable_actual,
      CASE WHEN EXISTS(SELECT 1 FROM CertificadoClienteDetalle d JOIN CertificadoCliente cc ON cc.certificado_cliente_id=d.certificado_cliente_id
        WHERE d.operacion_id=o.operacion_id AND cc.estado='EMITIDO' AND (d.porcentaje_actual>0 OR d.delta>0)) THEN 1 ELSE 0 END ya_certificada
    FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
    JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id LEFT JOIN ResponsableOperacion r ON r.responsable_id=o.responsable_id
    LEFT JOIN Usuario u ON u.usuario_id=o.economia_actualizada_por
    OUTER APPLY(SELECT TOP 1 d.porcentaje_actual FROM CertificadoClienteDetalle d
      JOIN CertificadoCliente cc ON cc.certificado_cliente_id=d.certificado_cliente_id
      WHERE d.operacion_id=o.operacion_id AND cc.estado='EMITIDO'
      ORDER BY cc.fecha_certificacion DESC,cc.certificado_cliente_id DESC) cert
    OUTER APPLY(SELECT TOP 1 d.porcentaje_actual FROM CertificadoResponsableDetalle d
      JOIN CertificadoResponsable cr ON cr.certificado_responsable_id=d.certificado_responsable_id
      WHERE d.operacion_id=o.operacion_id AND cr.estado='EMITIDO'
      ORDER BY cr.fecha_certificacion DESC,cr.certificado_responsable_id DESC) cert_resp
    WHERE o.proyecto_id=@p AND ISNULL(o.archivada,0)=0 ORDER BY e.orden,o.secuencia`);
  if(!r.recordsets[0].length){const e=new Error('Proyecto no encontrado');e.status=404;throw e;}
  return {proyecto:r.recordsets[0][0],operaciones:r.recordsets[1]};
}
async function actualizar(pool,operacionId,data,usuarioId){
  const precio=Number(data.precio_cliente),costo=Number(data.costo_responsable),motivo=String(data.motivo||'').trim();
  if(!Number.isFinite(precio)||precio<0||!Number.isFinite(costo)||costo<0){const e=new Error('Precio y costo deben ser numeros iguales o mayores a cero');e.status=400;throw e;}
  if(motivo.length>500){const e=new Error('El motivo no puede superar 500 caracteres');e.status=422;throw e;}
  const tx=new sql.Transaction(pool);await tx.begin();
  try{
    const q=await new sql.Request(tx).input('id',sql.BigInt,operacionId).query(`SELECT operacion_id,precio_cliente,costo_responsable FROM Operacion WITH(UPDLOCK,HOLDLOCK) WHERE operacion_id=@id AND ISNULL(archivada,0)=0`);
    if(!q.recordset.length){const e=new Error('Operacion no encontrada');e.status=404;throw e;} const op=q.recordset[0];
    const cambios=[];if(Number(op.precio_cliente)!==precio)cambios.push(['precio_cliente',op.precio_cliente,precio]);
    if(Number(op.costo_responsable)!==costo)cambios.push(['costo_responsable',op.costo_responsable,costo]);
    if(cambios.length&&!motivo){const e=new Error('El motivo es obligatorio para modificar valores economicos');e.status=422;throw e;}
    if(cambios.length){await new sql.Request(tx).input('id',sql.BigInt,operacionId).input('precio',sql.Decimal(19,4),precio).input('costo',sql.Decimal(19,4),costo).input('u',sql.BigInt,usuarioId)
      .query('UPDATE Operacion SET precio_cliente=@precio,costo_responsable=@costo,economia_actualizada_por=@u,economia_actualizada_en=SYSDATETIME() WHERE operacion_id=@id');
      for(const c of cambios)await new sql.Request(tx).input('id',sql.BigInt,operacionId).input('campo',sql.NVarChar(50),c[0]).input('ant',sql.Decimal(19,4),c[1]).input('nuevo',sql.Decimal(19,4),c[2]).input('motivo',sql.NVarChar(500),motivo).input('u',sql.BigInt,usuarioId)
        .query('INSERT INTO HistorialEconomiaOperacion(operacion_id,campo_modificado,valor_anterior,valor_nuevo,motivo,usuario_id) VALUES(@id,@campo,@ant,@nuevo,@motivo,@u)');}
    await tx.commit();return {message:cambios.length?'Economia actualizada y auditada':'No hubo cambios',cambios:cambios.length};
  }catch(e){try{await tx.rollback();}catch{}throw e;}
}
module.exports={listar,actualizar};
