require('dotenv').config();
const {conectarDB,sql}=require('../DB/dbConection');
const certificacion=require('../services/CertificacionCliente.service');

async function debeRechazar(pool,id,esperado){
  try{await certificacion.generarPreview(pool,id,new Date().toISOString().slice(0,10));return false;}
  catch(e){return e.status===409&&e.message.includes(esperado);}
}

(async()=>{
  const pool=await conectarDB(),hoy=new Date().toISOString().slice(0,10),resultado={};
  const datos=await pool.request().query(`
    SELECT TOP 1 proyecto_id FROM Proyecto WHERE eliminado=0 AND (activo=0 OR UPPER(estado)<>'ACTIVO') ORDER BY proyecto_id;
    SELECT TOP 1 proyecto_id FROM Proyecto WHERE eliminado=0 AND activo=1 AND UPPER(estado)='ACTIVO' AND cliente_id IS NULL ORDER BY proyecto_id;
    SELECT TOP 1 proyecto_id FROM Proyecto WHERE eliminado=0 AND activo=1 AND UPPER(estado)='ACTIVO' AND cliente_id IS NOT NULL ORDER BY proyecto_id DESC;
    SELECT c.name,c.precision,c.scale FROM sys.columns c WHERE c.object_id=OBJECT_ID('Operacion') AND c.name IN('precio_cliente','costo_responsable');
    SELECT TOP 1 cc.certificado_cliente_id,CONVERT(varchar(10),cc.fecha_certificacion,23) fecha,
      SUM(CASE WHEN d.porcentaje_actual>0 OR d.delta>0 THEN 1 ELSE 0 END) operaciones_certificadas,
      SUM(CASE WHEN d.porcentaje_actual=0 AND d.delta=0 THEN 1 ELSE 0 END) lineas_contexto
    FROM CertificadoCliente cc JOIN CertificadoClienteDetalle d ON d.certificado_cliente_id=cc.certificado_cliente_id
    GROUP BY cc.certificado_cliente_id,cc.fecha_certificacion ORDER BY cc.certificado_cliente_id DESC;`);
  if(datos.recordsets[0][0])resultado.proyecto_inactivo=await debeRechazar(pool,Number(datos.recordsets[0][0].proyecto_id),'activo');
  else resultado.proyecto_inactivo='SIN_DATO_PARA_PROBAR';
  if(datos.recordsets[1][0])resultado.proyecto_sin_cliente=await debeRechazar(pool,Number(datos.recordsets[1][0].proyecto_id),'cliente');
  else resultado.proyecto_sin_cliente='SIN_DATO_PARA_PROBAR';
  const activo=Number(datos.recordsets[2][0]?.proyecto_id||0);
  if(activo){const p=await certificacion.generarPreview(pool,activo,hoy);const conteo=await pool.request().input('p',sql.BigInt,activo).query(`SELECT SUM(CASE WHEN archivada=0 THEN 1 ELSE 0 END) vigentes,SUM(CASE WHEN archivada=1 THEN 1 ELSE 0 END) archivadas FROM Operacion o JOIN VersionPlan v ON v.version_id=o.version_id AND v.es_activa=1 WHERE o.proyecto_id=@p`);resultado.operaciones_archivadas_excluidas=p.lineas.length===Number(conteo.recordset[0].vigentes||0);}
  resultado.decimales_19_4=datos.recordsets[3].length===2&&datos.recordsets[3].every(x=>x.precision===19&&x.scale===4);
  resultado.certificado=datos.recordsets[4][0]||null;

  const positiva=await pool.request().query(`SELECT TOP 1 o.operacion_id,o.responsable_id FROM Operacion o JOIN CertificadoClienteDetalle d ON d.operacion_id=o.operacion_id JOIN CertificadoCliente c ON c.certificado_cliente_id=d.certificado_cliente_id WHERE c.estado='EMITIDO' AND (d.porcentaje_actual>0 OR d.delta>0)`);
  if(positiva.recordset[0]){let tx=new sql.Transaction(pool);await tx.begin();try{const op=positiva.recordset[0],nuevo=op.responsable_id===null?1:null;await new sql.Request(tx).input('id',sql.BigInt,op.operacion_id).input('r',sql.BigInt,nuevo).query('UPDATE Operacion SET responsable_id=@r WHERE operacion_id=@id');resultado.bloqueo_responsable_certificado=false;}catch(e){resultado.bloqueo_responsable_certificado=e.number===51001||String(e.message).includes('certificada');}finally{try{await tx.rollback();}catch{}}}
  const cero=await pool.request().query(`SELECT TOP 1 o.operacion_id,o.responsable_id FROM Operacion o JOIN CertificadoClienteDetalle d ON d.operacion_id=o.operacion_id JOIN CertificadoCliente c ON c.certificado_cliente_id=d.certificado_cliente_id WHERE c.estado='EMITIDO' AND d.porcentaje_actual=0 AND d.delta=0`);
  if(cero.recordset[0]){let tx=new sql.Transaction(pool);await tx.begin();try{const op=cero.recordset[0],nuevo=op.responsable_id===null?1:null;await new sql.Request(tx).input('id',sql.BigInt,op.operacion_id).input('r',sql.BigInt,nuevo).query('UPDATE Operacion SET responsable_id=@r WHERE operacion_id=@id');resultado.responsable_linea_cero_permitido=true;}catch(e){resultado.responsable_linea_cero_permitido=false;}finally{try{await tx.rollback();}catch{}}}
  console.log(JSON.stringify({ok:Object.values(resultado).every(x=>x===true||x==='SIN_DATO_PARA_PROBAR'||typeof x==='object'),resultado},null,2));await pool.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
