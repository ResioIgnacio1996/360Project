const {sql}=require('../DB/dbConection');
const {redondear,calcularLinea}=require('./reglasCostos');
const {construirProgramacion,fechaISO}=require('./ProgramacionFechas.service');
const {normalizarCorte,validarObservaciones,validarMotivoEliminacion,calcularAvanceEtapas}=require('./CertificacionCliente.service');

function fallo(message,status=400){const error=new Error(message);error.status=status;return error;}

function normalizarOpciones(body={}){
  const corte=normalizarCorte(body);
  const responsable_id=Number(body.responsable_id);
  if(!Number.isInteger(responsable_id)||responsable_id<=0)throw fallo('Debe seleccionar un responsable',400);
  return {...corte,responsable_id};
}

function validarContexto(proyecto,responsable){
  if(!proyecto)throw fallo('Proyecto no encontrado',404);
  if(!proyecto.activo||proyecto.eliminado||String(proyecto.estado).toUpperCase()!=='ACTIVO')throw fallo('El proyecto debe estar activo',409);
  if(!responsable)throw fallo('El responsable no pertenece a operaciones activas del proyecto',404);
  if(!responsable.activo)throw fallo('El responsable seleccionado esta inactivo',409);
}

async function contexto(request,proyectoId,opciones,bloquear=false){
  const hint=bloquear?'WITH (UPDLOCK,HOLDLOCK)':'';
  return request.input('proyecto',sql.BigInt,proyectoId)
    .input('responsable',sql.BigInt,opciones.responsable_id)
    .input('fecha',sql.Date,opciones.fecha_certificacion).query(`
      SELECT proyecto_id,nombre,estado,activo,eliminado FROM Proyecto ${hint} WHERE proyecto_id=@proyecto;

      SELECT DISTINCT r.responsable_id,r.codigo,r.nombre,r.tipo,r.activo
      FROM ResponsableOperacion r ${hint}
      JOIN Operacion o ON o.responsable_id=r.responsable_id
      JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
      WHERE r.responsable_id=@responsable AND o.proyecto_id=@proyecto AND ISNULL(o.archivada,0)=0;

      SELECT o.operacion_id,o.proyecto_id,o.responsable_id,o.secuencia,o.nombre,o.duracion_hs,o.desfase_inicio_hs,
        o.fecha_inicio_estimada,o.fecha_fin_estimada,o.fecha_inicio_real,o.fecha_fin_real,o.fecha_no_antes_del,
        e.etapa_id,e.nombre etapa_nombre,e.orden etapa_orden,o.peso_pct peso_operacion,
        r.nombre responsable_nombre,r.codigo responsable_codigo,o.costo_responsable,
        CONVERT(varchar(34),o.economia_row_version,1) economia_version,deps.dependencias,
        av.avance_id,av.fecha_registro avance_fecha,av.fecha_creacion avance_creacion,
        ISNULL(av.pct_avance_nuevo,0) avance_fisico_referencia,
        ant.detalle_id detalle_anterior_id,ISNULL(ant.porcentaje_actual,0) porcentaje_anterior
      FROM Operacion o ${hint}
      JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
      JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id
      JOIN ResponsableOperacion r ON r.responsable_id=o.responsable_id
      OUTER APPLY(SELECT STRING_AGG(CONVERT(varchar(20),od.operacion_predecesora_id),',') dependencias
        FROM OperacionDependencia od WHERE od.operacion_id=o.operacion_id) deps
      OUTER APPLY(SELECT TOP 1 a.avance_id,a.fecha_registro,a.fecha_creacion,a.pct_avance_nuevo
        FROM AvanceOperacion a WHERE a.operacion_id=o.operacion_id AND a.fecha_registro<=@fecha
        ORDER BY a.fecha_registro DESC,a.fecha_creacion DESC,a.avance_id DESC) av
      OUTER APPLY(SELECT TOP 1 d.detalle_id,d.porcentaje_actual
        FROM CertificadoResponsableDetalle d
        JOIN CertificadoResponsable cr ON cr.certificado_responsable_id=d.certificado_responsable_id
        WHERE d.operacion_id=o.operacion_id AND cr.estado='EMITIDO'
        ORDER BY cr.fecha_certificacion DESC,cr.certificado_responsable_id DESC,d.detalle_id DESC) ant
      WHERE o.proyecto_id=@proyecto AND o.responsable_id=@responsable AND ISNULL(o.archivada,0)=0
      ORDER BY o.secuencia;

      SELECT TOP 1 fecha_certificacion FROM CertificadoResponsable ${hint}
      WHERE proyecto_id=@proyecto AND responsable_id=@responsable AND estado='EMITIDO'
      ORDER BY fecha_certificacion DESC,certificado_responsable_id DESC;

      SELECT TOP 1 * FROM CalendarioProyecto WHERE proyecto_id=@proyecto;
      SELECT ex.* FROM ExcepcionCalendario ex JOIN CalendarioProyecto c ON c.calendario_id=ex.calendario_id
      WHERE c.proyecto_id=@proyecto;
    `);
}

function lineaPreview(op){
  const avance=redondear(op.avance_fisico_referencia,3),anterior=redondear(op.porcentaje_anterior,3);
  const sugerido=Math.max(avance,anterior),costo=redondear(op.costo_responsable,4),delta=redondear(sugerido-anterior,3);
  return {...op,avance_fisico_referencia:avance,porcentaje_anterior:anterior,porcentaje_sugerido:sugerido,
    porcentaje_actual:sugerido,delta,costo_responsable:costo,importe:redondear(costo*delta/100,4),
    base:{economia_version:op.economia_version,avance_id:op.avance_id||null,avance_fisico_referencia:avance,
      detalle_anterior_id:op.detalle_anterior_id||null,porcentaje_anterior:anterior,responsable_id:Number(op.responsable_id)}};
}

function seleccionarOperaciones(recordsets,corte){
  const programadas=construirProgramacion(recordsets[2],recordsets[4][0]||null,recordsets[5]||[]);
  if(corte.metodo_corte==='POR_FECHA')return{
    operaciones:programadas.filter(op=>op.fecha_inicio_reprog&&op.fecha_inicio_reprog<=corte.fecha_certificacion),operacion_corte:null};
  const operacionCorte=programadas.find(op=>Number(op.operacion_id)===corte.operacion_corte_id);
  if(!operacionCorte)throw fallo('La operacion de corte no pertenece al responsable seleccionado',409);
  return{operaciones:programadas.filter(op=>Number(op.secuencia)<=Number(operacionCorte.secuencia)),
    operacion_corte:{operacion_id:Number(operacionCorte.operacion_id),secuencia:Number(operacionCorte.secuencia),nombre:operacionCorte.nombre}};
}

function validarCronologia(recordsets,fecha){
  const ultima=fechaISO(recordsets[3][0]?.fecha_certificacion);
  if(ultima&&fecha<ultima)throw fallo(`La fecha no puede ser anterior al ultimo certificado del responsable (${ultima})`,409);
}

function compararBase(op,enviada){
  const actual=lineaPreview(op).base;
  return actual.economia_version===enviada?.economia_version&&Number(actual.avance_id||0)===Number(enviada?.avance_id||0)
    &&Number(actual.detalle_anterior_id||0)===Number(enviada?.detalle_anterior_id||0)
    &&Number(actual.avance_fisico_referencia)===Number(enviada?.avance_fisico_referencia)
    &&Number(actual.porcentaje_anterior)===Number(enviada?.porcentaje_anterior)
    &&Number(actual.responsable_id)===Number(enviada?.responsable_id);
}

function calcularDetalleEmision(op,entrada){
  const anterior=redondear(op.porcentaje_anterior,3),avance=redondear(op.avance_fisico_referencia,3);
  const sugerido=Math.max(avance,anterior),actual=redondear(entrada.porcentaje_actual,3),costo=redondear(op.costo_responsable,4);
  const calculo=calcularLinea({avance:sugerido,anterior,actual,precio:costo,motivo:entrada.motivo_modificacion});
  return{...op,...calculo,avance,sugerido,costo,precio:costo};
}

async function generarPreview(pool,proyectoId,body){
  const opciones=normalizarOpciones(body);
  const result=await contexto(pool.request(),proyectoId,opciones,false);
  validarContexto(result.recordsets[0][0],result.recordsets[1][0]);
  validarCronologia(result.recordsets,opciones.fecha_certificacion);
  const seleccion=seleccionarOperaciones(result.recordsets,opciones);
  const lineas=seleccion.operaciones.map(op=>({...lineaPreview(op),fecha_inicio_corte:op.fecha_inicio_reprog}));
  return{proyecto:result.recordsets[0][0],responsable:result.recordsets[1][0],...opciones,
    operacion_corte:seleccion.operacion_corte,lineas,total:redondear(lineas.reduce((s,l)=>s+l.importe,0),4)};
}

async function emitir(pool,proyectoId,body,usuarioId){
  const opciones=normalizarOpciones(body),observaciones=validarObservaciones(body.observaciones);
  const entradas=Array.isArray(body.lineas)?body.lineas:[];
  if(!entradas.length)throw fallo('Debe enviar las lineas del preview',400);
  const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try{
    const result=await contexto(new sql.Request(tx),proyectoId,opciones,true);
    validarContexto(result.recordsets[0][0],result.recordsets[1][0]);
    validarCronologia(result.recordsets,opciones.fecha_certificacion);
    const seleccion=seleccionarOperaciones(result.recordsets,opciones);
    const mapa=new Map(entradas.map(l=>[Number(l.operacion_id),l]));
    if(mapa.size!==entradas.length||mapa.size!==seleccion.operaciones.length)throw fallo('El conjunto de operaciones cambio; regenere el preview',409);
    const detalles=seleccion.operaciones.map(op=>{
      const entrada=mapa.get(Number(op.operacion_id));
      if(!entrada||!compararBase(op,entrada.base))throw fallo(`El preview quedo desactualizado en la operacion ${op.secuencia}`,409);
      try{return calcularDetalleEmision(op,entrada);}catch(error){error.message=`Operacion ${op.secuencia}: ${error.message}`;throw error;}
    });
    if(!detalles.some(d=>d.delta>0))throw fallo('No se puede emitir un certificado con delta total cero',422);
    const total=redondear(detalles.reduce((s,d)=>s+d.importe,0),4);
    const cabecera=await new sql.Request(tx).input('p',sql.BigInt,proyectoId).input('r',sql.BigInt,opciones.responsable_id)
      .input('metodo',sql.VarChar(20),opciones.metodo_corte).input('corte',sql.BigInt,opciones.operacion_corte_id)
      .input('fecha',sql.Date,opciones.fecha_certificacion).input('total',sql.Decimal(19,4),total)
      .input('obs',sql.NVarChar(1000),observaciones).input('u',sql.BigInt,usuarioId).query(`INSERT INTO CertificadoResponsable
        (proyecto_id,responsable_id,metodo_corte,operacion_corte_id,fecha_certificacion,total,estado,observaciones,creado_por)
        OUTPUT INSERTED.certificado_responsable_id VALUES(@p,@r,@metodo,@corte,@fecha,@total,'EMITIDO',@obs,@u)`);
    const certificadoId=cabecera.recordset[0].certificado_responsable_id;
    for(const d of detalles)await new sql.Request(tx).input('c',sql.BigInt,certificadoId).input('o',sql.BigInt,d.operacion_id)
      .input('s',sql.Int,d.secuencia).input('av',sql.Decimal(7,3),d.avance).input('ant',sql.Decimal(7,3),d.anterior)
      .input('act',sql.Decimal(7,3),d.actual).input('delta',sql.Decimal(7,3),d.delta).input('costo',sql.Decimal(19,4),d.costo)
      .input('importe',sql.Decimal(19,4),d.importe).input('etapa',sql.BigInt,d.etapa_id)
      .input('etapa_nombre',sql.NVarChar(200),d.etapa_nombre).input('etapa_orden',sql.SmallInt,d.etapa_orden)
      .input('peso',sql.Decimal(5,2),d.peso_operacion).input('manual',sql.Bit,d.manual).input('motivo',sql.NVarChar(500),d.motivo)
      .query(`INSERT INTO CertificadoResponsableDetalle(certificado_responsable_id,operacion_id,secuencia_aplicada,
        avance_fisico_referencia,porcentaje_anterior,porcentaje_actual,delta,costo_responsable_aplicado,importe,
        etapa_id_aplicada,etapa_nombre_aplicada,etapa_orden_aplicado,peso_operacion_aplicado,modificado_manualmente,motivo_modificacion)
        VALUES(@c,@o,@s,@av,@ant,@act,@delta,@costo,@importe,@etapa,@etapa_nombre,@etapa_orden,@peso,@manual,@motivo)`);
    await tx.commit();
    return{certificado_responsable_id:certificadoId,responsable_id:opciones.responsable_id,total,estado:'EMITIDO',metodo_corte:opciones.metodo_corte};
  }catch(error){try{await tx.rollback();}catch{}throw error;}
}

async function listar(pool,proyectoId){
  const r=await pool.request().input('p',sql.BigInt,proyectoId).query(`SELECT cr.certificado_responsable_id,cr.proyecto_id,
    cr.responsable_id,r.codigo responsable_codigo,r.nombre responsable_nombre,r.tipo responsable_tipo,cr.metodo_corte,
    cr.operacion_corte_id,corte.secuencia operacion_corte_secuencia,corte.nombre operacion_corte_nombre,
    cr.fecha_certificacion,cr.total,cr.estado,cr.observaciones,cr.fecha_creacion,u.nombre creado_por_nombre,
    ISNULL(pagos.total_pagado,0) total_pagado,cr.total-ISNULL(pagos.total_pagado,0) saldo_pago,
    ISNULL(pagos.cantidad_pagos,0) cantidad_pagos,
    CASE WHEN cr.total<=ISNULL(pagos.total_pagado,0) THEN 'PAGADO' WHEN ISNULL(pagos.total_pagado,0)>0 THEN 'PAGADO_PARCIAL' ELSE 'PENDIENTE' END estado_pago,
    CASE WHEN cr.estado='EMITIDO' AND cr.certificado_responsable_id=(SELECT TOP 1 vigente.certificado_responsable_id
      FROM CertificadoResponsable vigente WHERE vigente.proyecto_id=cr.proyecto_id AND vigente.responsable_id=cr.responsable_id AND vigente.estado='EMITIDO'
      ORDER BY vigente.fecha_certificacion DESC,vigente.certificado_responsable_id DESC) THEN 1 ELSE 0 END es_ultimo_emitido
    FROM CertificadoResponsable cr JOIN ResponsableOperacion r ON r.responsable_id=cr.responsable_id
    JOIN Usuario u ON u.usuario_id=cr.creado_por LEFT JOIN Operacion corte ON corte.operacion_id=cr.operacion_corte_id
    OUTER APPLY(SELECT SUM(m.importe) total_pagado,COUNT(*) cantidad_pagos FROM MovimientoFinancieroProyecto m
      WHERE m.certificado_responsable_id=cr.certificado_responsable_id AND m.estado='ACTIVO') pagos
    WHERE cr.proyecto_id=@p AND cr.estado<>'ELIMINADO' ORDER BY cr.fecha_certificacion DESC,cr.certificado_responsable_id DESC`);
  return r.recordset;
}

async function detalle(pool,proyectoId,certificadoId){
  const r=await pool.request().input('p',sql.BigInt,proyectoId).input('id',sql.BigInt,certificadoId).query(`
    SELECT cr.*,r.codigo responsable_codigo,r.nombre responsable_nombre,r.tipo responsable_tipo,u.nombre creado_por_nombre,p.nombre proyecto_nombre,
      ISNULL(pagos.total_pagado,0) total_pagado,cr.total-ISNULL(pagos.total_pagado,0) saldo_pago,ISNULL(pagos.cantidad_pagos,0) cantidad_pagos,
      CASE WHEN cr.total<=ISNULL(pagos.total_pagado,0) THEN 'PAGADO' WHEN ISNULL(pagos.total_pagado,0)>0 THEN 'PAGADO_PARCIAL' ELSE 'PENDIENTE' END estado_pago,
      CASE WHEN cr.certificado_responsable_id=(SELECT TOP 1 vigente.certificado_responsable_id FROM CertificadoResponsable vigente
        WHERE vigente.proyecto_id=cr.proyecto_id AND vigente.responsable_id=cr.responsable_id AND vigente.estado='EMITIDO'
        ORDER BY vigente.fecha_certificacion DESC,vigente.certificado_responsable_id DESC) THEN 1 ELSE 0 END es_ultimo_emitido,
      corte.secuencia operacion_corte_secuencia,corte.nombre operacion_corte_nombre
    FROM CertificadoResponsable cr JOIN ResponsableOperacion r ON r.responsable_id=cr.responsable_id
    JOIN Usuario u ON u.usuario_id=cr.creado_por JOIN Proyecto p ON p.proyecto_id=cr.proyecto_id
    LEFT JOIN Operacion corte ON corte.operacion_id=cr.operacion_corte_id
    OUTER APPLY(SELECT SUM(m.importe) total_pagado,COUNT(*) cantidad_pagos FROM MovimientoFinancieroProyecto m
      WHERE m.certificado_responsable_id=cr.certificado_responsable_id AND m.estado='ACTIVO') pagos
    WHERE cr.certificado_responsable_id=@id AND cr.proyecto_id=@p AND cr.estado<>'ELIMINADO';
    SELECT d.*,o.nombre operacion_nombre,r.nombre responsable_nombre,
      COALESCE(d.peso_operacion_aplicado,o.peso_pct) peso_operacion,
      COALESCE(d.etapa_id_aplicada,e.etapa_id) etapa_id,COALESCE(d.etapa_nombre_aplicada,e.nombre) etapa_nombre,
      COALESCE(d.etapa_orden_aplicado,e.orden) etapa_orden
    FROM CertificadoResponsableDetalle d JOIN Operacion o ON o.operacion_id=d.operacion_id
    JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id LEFT JOIN ResponsableOperacion r ON r.responsable_id=o.responsable_id
    WHERE d.certificado_responsable_id=@id ORDER BY d.secuencia_aplicada;
    SELECT m.movimiento_id,m.fecha,m.importe,m.medio_pago,m.referencia,m.descripcion,u.nombre creado_por_nombre
    FROM MovimientoFinancieroProyecto m JOIN Usuario u ON u.usuario_id=m.creado_por
    WHERE m.certificado_responsable_id=@id AND m.estado='ACTIVO' ORDER BY m.fecha,m.movimiento_id`);
  if(!r.recordsets[0].length)throw fallo('Certificado a responsable no encontrado',404);
  return{certificado:r.recordsets[0][0],etapas:calcularAvanceEtapas(r.recordsets[1]),detalles:r.recordsets[1],pagos:r.recordsets[2]};
}

async function eliminar(pool,proyectoId,certificadoId,motivoValue,usuarioId){
  if(!Number.isInteger(proyectoId)||!Number.isInteger(certificadoId))throw fallo('Proyecto o certificado invalido',400);
  const motivo=validarMotivoEliminacion(motivoValue),tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try{
    const r=await new sql.Request(tx).input('p',sql.BigInt,proyectoId).input('id',sql.BigInt,certificadoId).query(`
      SELECT proyecto_id,estado,activo,eliminado FROM Proyecto WITH(UPDLOCK,HOLDLOCK) WHERE proyecto_id=@p;
      SELECT certificado_responsable_id,responsable_id,estado FROM CertificadoResponsable WITH(UPDLOCK,HOLDLOCK)
        WHERE certificado_responsable_id=@id AND proyecto_id=@p;
      SELECT COUNT(*) pagos_activos FROM MovimientoFinancieroProyecto WITH(UPDLOCK,HOLDLOCK)
        WHERE certificado_responsable_id=@id AND estado='ACTIVO'`);
    const proyecto=r.recordsets[0][0],certificado=r.recordsets[1][0];
    if(!proyecto||!proyecto.activo||proyecto.eliminado||proyecto.estado!=='ACTIVO')throw fallo('El proyecto debe estar activo',409);
    if(!certificado)throw fallo('Certificado a responsable no encontrado',404);
    if(certificado.estado!=='EMITIDO')throw fallo('El certificado ya no esta emitido',409);
    const ultimo=await new sql.Request(tx).input('p',sql.BigInt,proyectoId).input('r',sql.BigInt,certificado.responsable_id).query(`SELECT TOP 1 certificado_responsable_id
      FROM CertificadoResponsable WITH(UPDLOCK,HOLDLOCK) WHERE proyecto_id=@p AND responsable_id=@r AND estado='EMITIDO'
      ORDER BY fecha_certificacion DESC,certificado_responsable_id DESC`);
    if(Number(ultimo.recordset[0]?.certificado_responsable_id)!==certificadoId)throw fallo('Solo puede eliminarse el ultimo certificado emitido de este responsable',409);
    if(Number(r.recordsets[2][0].pagos_activos)>0)throw fallo('No se puede eliminar un certificado con egresos asociados; anule primero sus pagos',409);
    await new sql.Request(tx).input('id',sql.BigInt,certificadoId).input('u',sql.BigInt,usuarioId).input('motivo',sql.NVarChar(500),motivo)
      .query(`UPDATE CertificadoResponsable SET estado='ELIMINADO',eliminado_por=@u,fecha_eliminacion=SYSDATETIME(),motivo_eliminacion=@motivo
        WHERE certificado_responsable_id=@id`);
    const anterior=await new sql.Request(tx).input('p',sql.BigInt,proyectoId).input('r',sql.BigInt,certificado.responsable_id).query(`SELECT TOP 1 certificado_responsable_id,fecha_certificacion
      FROM CertificadoResponsable WHERE proyecto_id=@p AND responsable_id=@r AND estado='EMITIDO'
      ORDER BY fecha_certificacion DESC,certificado_responsable_id DESC`);
    await tx.commit();return{message:`Certificado a responsable #${certificadoId} eliminado`,certificado_responsable_id:certificadoId,
      estado:'ELIMINADO',certificado_anterior_vigente:anterior.recordset[0]||null};
  }catch(error){try{await tx.rollback();}catch{}throw error;}
}

module.exports={normalizarOpciones,validarContexto,lineaPreview,seleccionarOperaciones,compararBase,calcularDetalleEmision,
  generarPreview,emitir,listar,detalle,eliminar};
