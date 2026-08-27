require('dotenv').config();
const {conectarDB,sql}=require('../DB/dbConection');
const certificados=require('../services/CertificacionResponsable.service');
const movimientos=require('../services/MovimientoFinanciero.service');

const PROYECTO_ID=7;
const FECHA='2026-08-25';
const MARCA='PRUEBA COMPLETA CERTIFICADO RESPONSABLE 20260825';

function asegurar(condicion,mensaje){if(!condicion)throw new Error(mensaje);}
async function rechaza(promesa,patron){try{await promesa;}catch(error){asegurar(patron.test(error.message),`Error inesperado: ${error.message}`);return error.message;}throw new Error('La operacion debia ser rechazada');}

async function main(){
  const pool=await conectarDB();
  const base=await pool.request().input('p',sql.BigInt,PROYECTO_ID).input('marca',sql.NVarChar(1000),MARCA).query(`
    SELECT TOP 1 o.responsable_id,r.nombre responsable_nombre,COUNT(*) operaciones,
      SUM(CASE WHEN ISNULL(o.pct_avance_actual,0)>0 AND o.costo_responsable>0 THEN 1 ELSE 0 END) con_avance,
      MAX(CASE WHEN ISNULL(o.pct_avance_actual,0)>0 AND o.costo_responsable>0 THEN o.secuencia END) secuencia_corte
    FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
    JOIN ResponsableOperacion r ON r.responsable_id=o.responsable_id
    WHERE o.proyecto_id=@p AND ISNULL(o.archivada,0)=0 AND r.activo=1
    GROUP BY o.responsable_id,r.nombre
    HAVING SUM(CASE WHEN ISNULL(o.pct_avance_actual,0)>0 AND o.costo_responsable>0 THEN 1 ELSE 0 END)>=2
    ORDER BY con_avance DESC,o.responsable_id;
    SELECT TOP 1 usuario_id,nombre FROM Usuario WHERE activo=1 ORDER BY usuario_id;
    SELECT certificado_responsable_id FROM CertificadoResponsable WHERE proyecto_id=@p AND observaciones=@marca`);
  const responsable=base.recordsets[0][0],usuario=base.recordsets[1][0];
  asegurar(responsable,'No existe un responsable con suficientes operaciones avanzadas');
  asegurar(usuario,'No existe usuario activo');
  asegurar(!base.recordsets[2].length,'La prueba completa ya fue ejecutada y no se duplicara');

  const corteResult=await pool.request().input('p',sql.BigInt,PROYECTO_ID).input('r',sql.BigInt,responsable.responsable_id)
    .input('s',sql.Int,responsable.secuencia_corte).query(`SELECT operacion_id FROM Operacion WHERE proyecto_id=@p AND responsable_id=@r AND secuencia=@s`);
  const opciones={responsable_id:Number(responsable.responsable_id),metodo_corte:'POR_OPERACION',
    operacion_corte_id:Number(corteResult.recordset[0].operacion_id),fecha_certificacion:FECHA};

  const preview1=await certificados.generarPreview(pool,PROYECTO_ID,opciones);
  asegurar(preview1.lineas.length>0,'El primer preview no contiene operaciones');
  asegurar(preview1.lineas.every(l=>Number(l.responsable_id)===Number(responsable.responsable_id)),'El preview mezclo responsables');
  const lineasParciales=preview1.lineas.map(l=>{
    const pendiente=Number(l.porcentaje_sugerido)-Number(l.porcentaje_anterior);
    const porcentaje_actual=pendiente>0?Number((Number(l.porcentaje_anterior)+pendiente/2).toFixed(3)):Number(l.porcentaje_anterior);
    return{operacion_id:l.operacion_id,porcentaje_actual,motivo_modificacion:pendiente>0?'Certificacion parcial para validar regla delta':null,base:l.base};
  });
  const cert1=await certificados.emitir(pool,PROYECTO_ID,{...opciones,observaciones:`${MARCA} - PARCIAL`,lineas:lineasParciales},usuario.usuario_id);
  asegurar(cert1.total>0,'El primer certificado debe tener total positivo');

  const preview2=await certificados.generarPreview(pool,PROYECTO_ID,opciones);
  asegurar(preview2.total>0,'El segundo preview debe contener el delta restante');
  const cert2=await certificados.emitir(pool,PROYECTO_ID,{...opciones,observaciones:`${MARCA} - DELTA`,lineas:preview2.lineas},usuario.usuario_id);
  asegurar(cert2.total>0,'El segundo certificado debe tener total positivo');

  const rechazoNoUltimo=await rechaza(certificados.eliminar(pool,PROYECTO_ID,Number(cert1.certificado_responsable_id),'Debe rechazarse por no ser el ultimo',usuario.usuario_id),/ultimo/);
  const pago=await movimientos.crear(pool,PROYECTO_ID,{tipo:'EGRESO',vinculo_tipo:'CERTIFICADO_RESPONSABLE',
    certificado_responsable_id:Number(cert2.certificado_responsable_id),fecha:FECHA,importe:Number((cert2.total/2).toFixed(4)),
    descripcion:'Pago parcial de prueba al contratista',medio_pago:'TRANSFERENCIA',referencia:'TEST-RESP-20260825'},usuario.usuario_id);
  const rechazoSobrepago=await rechaza(movimientos.crear(pool,PROYECTO_ID,{tipo:'EGRESO',vinculo_tipo:'CERTIFICADO_RESPONSABLE',
    certificado_responsable_id:Number(cert2.certificado_responsable_id),fecha:FECHA,importe:Number(cert2.total)+1,
    descripcion:'Sobrepago que debe rechazarse'},usuario.usuario_id),/supera el saldo/);
  const rechazoConPago=await rechaza(certificados.eliminar(pool,PROYECTO_ID,Number(cert2.certificado_responsable_id),'Debe rechazarse por tener pago',usuario.usuario_id),/egresos asociados/);

  await movimientos.anular(pool,PROYECTO_ID,Number(pago.movimiento_id),'Continuar prueba de borrado y recalculo',usuario.usuario_id);
  await certificados.eliminar(pool,PROYECTO_ID,Number(cert2.certificado_responsable_id),'Validar recuperacion del delta',usuario.usuario_id);
  const previewRecuperado=await certificados.generarPreview(pool,PROYECTO_ID,opciones);
  asegurar(Math.abs(Number(previewRecuperado.total)-Number(cert2.total))<0.0001,'El delta no regreso al certificado anterior despues de eliminar');
  const certFinal=await certificados.emitir(pool,PROYECTO_ID,{...opciones,observaciones:MARCA,lineas:previewRecuperado.lineas},usuario.usuario_id);
  const pagoFinal=await movimientos.crear(pool,PROYECTO_ID,{tipo:'EGRESO',vinculo_tipo:'CERTIFICADO_RESPONSABLE',
    certificado_responsable_id:Number(certFinal.certificado_responsable_id),fecha:FECHA,importe:Number((certFinal.total/4).toFixed(4)),
    descripcion:'Pago parcial vigente al contratista',medio_pago:'TRANSFERENCIA',referencia:'PAGO-PARCIAL-RESP'},usuario.usuario_id);

  const listado=await certificados.listar(pool,PROYECTO_ID);
  const finalListado=listado.find(c=>Number(c.certificado_responsable_id)===Number(certFinal.certificado_responsable_id));
  asegurar(finalListado&&finalListado.estado_pago==='PAGADO_PARCIAL','El certificado final no refleja pago parcial');
  const detalle=await certificados.detalle(pool,PROYECTO_ID,Number(certFinal.certificado_responsable_id));
  asegurar(detalle.pagos.length===1,'El detalle no devuelve el egreso asociado');
  asegurar(detalle.detalles.every(d=>Number(d.costo_responsable_aplicado)>=0),'El detalle no conservo costos aplicados');
  const finanzas=await movimientos.listar(pool,PROYECTO_ID);
  asegurar(finanzas.certificados_responsable.some(c=>Number(c.certificado_responsable_id)===Number(certFinal.certificado_responsable_id)),'El certificado no aparece como vinculo financiero');

  console.log(JSON.stringify({proyecto_id:PROYECTO_ID,responsable,certificado_parcial:cert1,
    certificado_delta_eliminado:cert2,certificado_final:certFinal,pago_final:pagoFinal,
    rechazos:{no_ultimo:rechazoNoUltimo,sobrepago:rechazoSobrepago,con_pago:rechazoConPago},
    verificacion:{estado_pago:finalListado.estado_pago,total_pagado:finalListado.total_pagado,saldo_pago:finalListado.saldo_pago,
      operaciones_detalle:detalle.detalles.length,etapas:detalle.etapas.length}},null,2));
}

main().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);});
