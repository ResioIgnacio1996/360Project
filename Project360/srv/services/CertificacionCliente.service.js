const { sql } = require('../DB/dbConection');
const { redondear, calcularLinea } = require('./reglasCostos');
const { construirProgramacion, fechaISO } = require('./ProgramacionFechas.service');

const METODOS_CORTE = new Set(['POR_FECHA', 'POR_OPERACION']);
const fechaValida = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

function calcularAvanceEtapas(detalles) {
  const etapas = new Map();
  for (const detalle of detalles || []) {
    const etapaId = Number(detalle.etapa_id);
    if (!etapas.has(etapaId)) {
      etapas.set(etapaId, {
        etapa_id: etapaId,
        etapa_nombre: detalle.etapa_nombre,
        etapa_orden: Number(detalle.etapa_orden || 0),
        porcentaje_certificado: 0
      });
    }
    const etapa = etapas.get(etapaId);
    etapa.porcentaje_certificado += Number(detalle.porcentaje_actual || 0) * Number(detalle.peso_operacion || 0) / 100;
  }
  return [...etapas.values()]
    .map(etapa => ({ ...etapa, porcentaje_certificado: redondear(etapa.porcentaje_certificado, 3) }))
    .sort((a, b) => a.etapa_orden - b.etapa_orden || a.etapa_id - b.etapa_id);
}

function normalizarCorte(value) {
  const body = typeof value === 'string' ? { fecha_certificacion: value } : (value || {});
  const metodo_corte = String(body.metodo_corte || 'POR_FECHA').trim().toUpperCase();
  const fecha_certificacion = String(body.fecha_certificacion || '').trim();
  if (!METODOS_CORTE.has(metodo_corte)) {
    const error = new Error('La metodologia debe ser POR_FECHA o POR_OPERACION');
    error.status = 400;
    throw error;
  }
  if (!fechaValida(fecha_certificacion)) {
    const error = new Error('Fecha de certificacion invalida');
    error.status = 400;
    throw error;
  }
  const valorOperacion = body.operacion_corte_id;
  const operacion_corte_id = valorOperacion === null || valorOperacion === undefined || valorOperacion === ''
    ? null : Number(valorOperacion);
  if (metodo_corte === 'POR_OPERACION' && !Number.isInteger(operacion_corte_id)) {
    const error = new Error('Debe seleccionar una operacion de corte');
    error.status = 400;
    throw error;
  }
  return {
    metodo_corte,
    fecha_certificacion,
    operacion_corte_id: metodo_corte === 'POR_OPERACION' ? operacion_corte_id : null
  };
}

async function contexto(request, proyectoId, fecha, bloquear = false) {
  const hint = bloquear ? 'WITH (UPDLOCK,HOLDLOCK)' : '';
  return request.input('proyecto', sql.BigInt, proyectoId).input('fecha', sql.Date, fecha).query(`
    SELECT p.proyecto_id,p.nombre,p.cliente_id,p.estado,p.activo,p.eliminado,c.razon_social cliente_nombre
    FROM Proyecto p ${hint} LEFT JOIN Cliente c ON c.id_cliente=p.cliente_id WHERE p.proyecto_id=@proyecto;

    SELECT o.operacion_id,o.proyecto_id,o.secuencia,o.nombre,o.duracion_hs,o.desfase_inicio_hs,
           o.fecha_inicio_estimada,o.fecha_fin_estimada,o.fecha_inicio_real,o.fecha_fin_real,o.fecha_no_antes_del,
           e.etapa_id,e.nombre etapa_nombre,e.orden etapa_orden,o.peso_pct peso_operacion,
           r.nombre responsable_nombre,o.precio_cliente,o.costo_responsable,
           CONVERT(varchar(34),o.economia_row_version,1) economia_version,deps.dependencias,
           av.avance_id,av.fecha_registro avance_fecha,av.fecha_creacion avance_creacion,
           ISNULL(av.pct_avance_nuevo,0) avance_fisico_referencia,
           ant.detalle_id detalle_anterior_id,ISNULL(ant.porcentaje_actual,0) porcentaje_anterior
    FROM Operacion o ${hint}
    JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
    JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id
    LEFT JOIN ResponsableOperacion r ON r.responsable_id=o.responsable_id
    OUTER APPLY(SELECT STRING_AGG(CONVERT(varchar(20),od.operacion_predecesora_id),',') dependencias
      FROM OperacionDependencia od WHERE od.operacion_id=o.operacion_id) deps
    OUTER APPLY(SELECT TOP 1 a.avance_id,a.fecha_registro,a.fecha_creacion,a.pct_avance_nuevo
      FROM AvanceOperacion a WHERE a.operacion_id=o.operacion_id AND a.fecha_registro<=@fecha
      ORDER BY a.fecha_registro DESC,a.fecha_creacion DESC,a.avance_id DESC) av
    OUTER APPLY(SELECT TOP 1 d.detalle_id,d.porcentaje_actual
      FROM CertificadoClienteDetalle d JOIN CertificadoCliente cc ON cc.certificado_cliente_id=d.certificado_cliente_id
      WHERE d.operacion_id=o.operacion_id AND cc.estado='EMITIDO'
      ORDER BY cc.fecha_certificacion DESC,cc.certificado_cliente_id DESC,d.detalle_id DESC) ant
    WHERE o.proyecto_id=@proyecto AND ISNULL(o.archivada,0)=0 ORDER BY o.secuencia;

    SELECT TOP 1 fecha_certificacion FROM CertificadoCliente ${hint}
      WHERE proyecto_id=@proyecto AND estado='EMITIDO'
      ORDER BY fecha_certificacion DESC,certificado_cliente_id DESC;

    SELECT TOP 1 * FROM CalendarioProyecto WHERE proyecto_id=@proyecto;

    SELECT ex.* FROM ExcepcionCalendario ex
    JOIN CalendarioProyecto c ON c.calendario_id=ex.calendario_id
    WHERE c.proyecto_id=@proyecto;
  `);
}

function validarProyecto(row){
  if(!row) { const e=new Error('Proyecto no encontrado'); e.status=404; throw e; }
  if(!row.activo || row.eliminado || String(row.estado).toUpperCase()!=='ACTIVO') { const e=new Error('El proyecto debe estar activo'); e.status=409; throw e; }
  if(!row.cliente_id) { const e=new Error('El proyecto no tiene un cliente asociado'); e.status=409; throw e; }
}

function validarObservaciones(value){
  const observaciones=String(value||'').trim();
  if(observaciones.length>1000){const e=new Error('Las observaciones no pueden superar 1000 caracteres');e.status=422;throw e;}
  return observaciones||null;
}

function validarMotivoEliminacion(value) {
  const motivo = String(value || '').trim();
  if (!motivo) {
    const error = new Error('El motivo de eliminacion es obligatorio');
    error.status = 422;
    throw error;
  }
  if (motivo.length > 500) {
    const error = new Error('El motivo de eliminacion no puede superar 500 caracteres');
    error.status = 422;
    throw error;
  }
  return motivo;
}

function validarCertificadoEliminable(certificado, ultimo, certificadoId) {
  if (!certificado) {
    const error = new Error('Certificado no encontrado');
    error.status = 404;
    throw error;
  }
  if (certificado.estado !== 'EMITIDO') {
    const error = new Error('El certificado ya no esta emitido y no puede eliminarse');
    error.status = 409;
    throw error;
  }
  if (Number(ultimo?.certificado_cliente_id) !== certificadoId) {
    const error = new Error(`Solo puede eliminarse el ultimo certificado emitido. El ultimo es el #${ultimo?.certificado_cliente_id}`);
    error.status = 409;
    throw error;
  }
  return certificado;
}

function lineaPreview(op){
  const avance=redondear(op.avance_fisico_referencia,3), anterior=redondear(op.porcentaje_anterior,3);
  const sugerido=Math.max(avance,anterior), precio=redondear(op.precio_cliente,4), delta=redondear(sugerido-anterior,3);
  return {...op,avance_fisico_referencia:avance,porcentaje_anterior:anterior,porcentaje_sugerido:sugerido,porcentaje_actual:sugerido,
    delta,precio_cliente:precio,importe:redondear(precio*delta/100,4),base:{economia_version:op.economia_version,avance_id:op.avance_id||null,
      avance_fisico_referencia:avance,detalle_anterior_id:op.detalle_anterior_id||null,porcentaje_anterior:anterior}};
}

function seleccionarOperaciones(recordsets, corte) {
  const programadas = construirProgramacion(
    recordsets[1],
    recordsets[3][0] || null,
    recordsets[4] || []
  );
  if (corte.metodo_corte === 'POR_FECHA') {
    return {
      operaciones: programadas.filter(op =>
        op.fecha_inicio_reprog && op.fecha_inicio_reprog <= corte.fecha_certificacion),
      operacion_corte: null
    };
  }
  const operacionCorte = programadas.find(op => Number(op.operacion_id) === corte.operacion_corte_id);
  if (!operacionCorte) {
    const error = new Error('La operacion de corte no pertenece al plan activo del proyecto');
    error.status = 409;
    throw error;
  }
  return {
    operaciones: programadas.filter(op => Number(op.secuencia) <= Number(operacionCorte.secuencia)),
    operacion_corte: {
      operacion_id: Number(operacionCorte.operacion_id),
      secuencia: Number(operacionCorte.secuencia),
      nombre: operacionCorte.nombre
    }
  };
}

function validarCronologia(result, fecha) {
  const ultima = fechaISO(result.recordsets[2][0]?.fecha_certificacion);
  if (ultima && fecha < ultima) {
    const error = new Error(`La fecha no puede ser anterior al ultimo certificado (${ultima})`);
    error.status = 409;
    throw error;
  }
}

async function generarPreview(pool, proyectoId, opciones) {
  const corte = normalizarCorte(opciones);
  const result = await contexto(pool.request(), proyectoId, corte.fecha_certificacion, false);
  validarProyecto(result.recordsets[0][0]);
  validarCronologia(result, corte.fecha_certificacion);
  const seleccion = seleccionarOperaciones(result.recordsets, corte);
  const lineas = seleccion.operaciones.map(op => ({
    ...lineaPreview(op),
    fecha_inicio_corte: op.fecha_inicio_reprog
  }));
  return {
    proyecto: result.recordsets[0][0],
    ...corte,
    operacion_corte: seleccion.operacion_corte,
    lineas,
    total: redondear(lineas.reduce((s, linea) => s + linea.importe, 0), 4)
  };
}

function compararBase(op,enviada){
  const actual=lineaPreview(op).base;
  return actual.economia_version===enviada?.economia_version && Number(actual.avance_id||0)===Number(enviada?.avance_id||0)
    && Number(actual.detalle_anterior_id||0)===Number(enviada?.detalle_anterior_id||0)
    && Number(actual.avance_fisico_referencia)===Number(enviada?.avance_fisico_referencia)
    && Number(actual.porcentaje_anterior)===Number(enviada?.porcentaje_anterior);
}

function calcularDetalleEmision(op,entrada){
  const anterior=redondear(op.porcentaje_anterior,3), avance=redondear(op.avance_fisico_referencia,3);
  const sugerido=Math.max(avance,anterior), actual=redondear(entrada.porcentaje_actual,3);
  const calculo=calcularLinea({avance:sugerido,anterior,actual,precio:op.precio_cliente,motivo:entrada.motivo_modificacion});
  return {...op,...calculo,avance,sugerido};
}

async function emitir(pool, proyectoId, body, usuarioId) {
  const corte = normalizarCorte(body);
  const observaciones = validarObservaciones(body.observaciones);
  const entradas = Array.isArray(body.lineas) ? body.lineas : [];
  if (!entradas.length) {
    const error = new Error('Debe enviar las lineas del preview');
    error.status = 400;
    throw error;
  }
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await contexto(new sql.Request(tx), proyectoId, corte.fecha_certificacion, true);
    validarProyecto(result.recordsets[0][0]);
    validarCronologia(result, corte.fecha_certificacion);
    const seleccion = seleccionarOperaciones(result.recordsets, corte);
    const mapa = new Map(entradas.map(linea => [Number(linea.operacion_id), linea]));
    if (mapa.size !== entradas.length || mapa.size !== seleccion.operaciones.length) {
      const error = new Error('El conjunto de operaciones cambio; regenere el preview');
      error.status = 409;
      throw error;
    }
    const detalles = seleccion.operaciones.map(op => {
      const entrada = mapa.get(Number(op.operacion_id));
      if (!entrada || !compararBase(op, entrada.base)) {
        const error = new Error(`El preview quedo desactualizado en la operacion ${op.secuencia}`);
        error.status = 409;
        throw error;
      }
      try {
        return calcularDetalleEmision(op, entrada);
      } catch (error) {
        error.message = `Operacion ${op.secuencia}: ${error.message}`;
        throw error;
      }
    });
    if (!detalles.some(detalle => detalle.delta > 0)) {
      const error = new Error('No se puede emitir un certificado con delta total cero');
      error.status = 422;
      throw error;
    }
    const total = redondear(detalles.reduce((s, detalle) => s + detalle.importe, 0), 4);
    const cabecera = await new sql.Request(tx)
      .input('p', sql.BigInt, proyectoId)
      .input('metodo', sql.VarChar(20), corte.metodo_corte)
      .input('operacion_corte', sql.BigInt, corte.operacion_corte_id)
      .input('fecha', sql.Date, corte.fecha_certificacion)
      .input('total', sql.Decimal(19, 4), total)
      .input('obs', sql.NVarChar(1000), observaciones)
      .input('u', sql.BigInt, usuarioId)
      .query(`INSERT INTO CertificadoCliente
        (proyecto_id,metodo_corte,operacion_corte_id,fecha_certificacion,total,estado,observaciones,creado_por)
        OUTPUT INSERTED.certificado_cliente_id
        VALUES(@p,@metodo,@operacion_corte,@fecha,@total,'EMITIDO',@obs,@u)`);
    const certificadoId = cabecera.recordset[0].certificado_cliente_id;
    for (const detalle of detalles) {
      await new sql.Request(tx)
        .input('c', sql.BigInt, certificadoId)
        .input('o', sql.BigInt, detalle.operacion_id)
        .input('s', sql.Int, detalle.secuencia)
        .input('av', sql.Decimal(7, 3), detalle.avance)
        .input('ant', sql.Decimal(7, 3), detalle.anterior)
        .input('act', sql.Decimal(7, 3), detalle.actual)
        .input('delta', sql.Decimal(7, 3), detalle.delta)
        .input('precio', sql.Decimal(19, 4), detalle.precio)
        .input('importe', sql.Decimal(19, 4), detalle.importe)
        .input('etapa', sql.BigInt, detalle.etapa_id)
        .input('etapa_nombre', sql.NVarChar(200), detalle.etapa_nombre)
        .input('etapa_orden', sql.SmallInt, detalle.etapa_orden)
        .input('peso_operacion', sql.Decimal(5, 2), detalle.peso_operacion)
        .input('manual', sql.Bit, detalle.manual)
        .input('motivo', sql.NVarChar(500), detalle.motivo)
        .query(`INSERT INTO CertificadoClienteDetalle
          (certificado_cliente_id,operacion_id,secuencia_aplicada,avance_fisico_referencia,
           porcentaje_anterior,porcentaje_actual,delta,precio_cliente_aplicado,importe,
           etapa_id_aplicada,etapa_nombre_aplicada,etapa_orden_aplicado,peso_operacion_aplicado,
           modificado_manualmente,motivo_modificacion)
          VALUES(@c,@o,@s,@av,@ant,@act,@delta,@precio,@importe,
            @etapa,@etapa_nombre,@etapa_orden,@peso_operacion,@manual,@motivo)`);
    }
    await tx.commit();
    return {
      certificado_cliente_id: certificadoId,
      total,
      estado: 'EMITIDO',
      metodo_corte: corte.metodo_corte,
      operacion_corte_id: corte.operacion_corte_id
    };
  } catch (error) {
    try { await tx.rollback(); } catch {}
    throw error;
  }
}

async function eliminar(pool, proyectoId, certificadoId, motivoValue, usuarioId) {
  if (!Number.isInteger(proyectoId) || !Number.isInteger(certificadoId)) {
    const error = new Error('Proyecto o certificado invalido');
    error.status = 400;
    throw error;
  }
  const motivo = validarMotivoEliminacion(motivoValue);
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await new sql.Request(tx)
      .input('proyecto', sql.BigInt, proyectoId)
      .input('certificado', sql.BigInt, certificadoId)
      .query(`
        SELECT p.proyecto_id,p.nombre,p.cliente_id,p.estado,p.activo,p.eliminado
        FROM Proyecto p WITH(UPDLOCK,HOLDLOCK) WHERE p.proyecto_id=@proyecto;

        SELECT certificado_cliente_id,proyecto_id,fecha_certificacion,estado
        FROM CertificadoCliente WITH(UPDLOCK,HOLDLOCK)
        WHERE certificado_cliente_id=@certificado AND proyecto_id=@proyecto;

        SELECT TOP 1 certificado_cliente_id,fecha_certificacion
        FROM CertificadoCliente WITH(UPDLOCK,HOLDLOCK)
        WHERE proyecto_id=@proyecto AND estado='EMITIDO'
        ORDER BY fecha_certificacion DESC,certificado_cliente_id DESC;

        SELECT COUNT(*) pagos_activos FROM MovimientoFinancieroProyecto WITH(UPDLOCK,HOLDLOCK)
        WHERE certificado_cliente_id=@certificado AND estado='ACTIVO';
      `);
    validarProyecto(result.recordsets[0][0]);
    const certificado = result.recordsets[1][0];
    const ultimo = result.recordsets[2][0];
    validarCertificadoEliminable(certificado, ultimo, certificadoId);
    if (Number(result.recordsets[3][0].pagos_activos) > 0) {
      const error = new Error('No se puede eliminar un certificado con ingresos asociados; anule primero sus pagos');
      error.status = 409;
      throw error;
    }
    await new sql.Request(tx)
      .input('certificado', sql.BigInt, certificadoId)
      .input('usuario', sql.BigInt, usuarioId)
      .input('motivo', sql.NVarChar(500), motivo)
      .query(`UPDATE CertificadoCliente SET estado='ELIMINADO',eliminado_por=@usuario,
        fecha_eliminacion=SYSDATETIME(),motivo_eliminacion=@motivo
        WHERE certificado_cliente_id=@certificado`);
    const anterior = await new sql.Request(tx)
      .input('proyecto', sql.BigInt, proyectoId)
      .query(`SELECT TOP 1 certificado_cliente_id,fecha_certificacion
        FROM CertificadoCliente WHERE proyecto_id=@proyecto AND estado='EMITIDO'
        ORDER BY fecha_certificacion DESC,certificado_cliente_id DESC`);
    await tx.commit();
    return {
      message: `Certificado #${certificadoId} eliminado. El proximo delta parte del ultimo certificado vigente`,
      certificado_cliente_id: certificadoId,
      estado: 'ELIMINADO',
      certificado_anterior_vigente: anterior.recordset[0] || null
    };
  } catch (error) {
    try { await tx.rollback(); } catch {}
    throw error;
  }
}

module.exports = {
  generarPreview, emitir, eliminar, fechaValida, lineaPreview, calcularDetalleEmision, compararBase,
  validarProyecto, validarObservaciones, validarMotivoEliminacion, validarCertificadoEliminable,
  normalizarCorte, seleccionarOperaciones, calcularAvanceEtapas
};
