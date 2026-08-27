const { sql } = require('../DB/dbConection');

const CABECERAS_COSTOS = ['secuencia', 'precio_cliente', 'costo_responsable'];
const CABECERAS_CRONOGRAMA_LEGACY = [...CABECERAS_COSTOS, 'cronograma_certificacion', 'nro_certificado_planificado'];
const CABECERAS_CRONOGRAMA_CLIENTE = [...CABECERAS_COSTOS, 'cronograma_certificacion_cliente', 'nro_certificado_cliente_planificado'];
const CABECERAS_CRONOGRAMA_COMPLETO_LEGACY = [...CABECERAS_CRONOGRAMA_LEGACY, 'cronograma_certificacion_responsable', 'nro_certificado_responsable_planificado'];
const CABECERAS_CRONOGRAMA_COMPLETO = [...CABECERAS_CRONOGRAMA_CLIENTE, 'cronograma_certificacion_responsable', 'nro_certificado_responsable_planificado'];
const MOTIVO_IMPORTACION = 'Importación CSV';

function errorValidacion(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function separarLinea(linea, delimitador) {
  const celdas = [];
  let celda = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];
    if (caracter === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        celda += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (caracter === delimitador && !entreComillas) {
      celdas.push(celda.trim());
      celda = '';
    } else {
      celda += caracter;
    }
  }
  if (entreComillas) throw errorValidacion('El CSV contiene una fila con comillas sin cerrar');
  celdas.push(celda.trim());
  return celdas;
}

function contarSeparadores(linea, separador) {
  let cantidad = 0;
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    if (linea[i] === '"') {
      if (entreComillas && linea[i + 1] === '"') i += 1;
      else entreComillas = !entreComillas;
    } else if (linea[i] === separador && !entreComillas) cantidad += 1;
  }
  return cantidad;
}

function numeroEconomico(value) {
  const normalizado = String(value || '').trim().replace(',', '.');
  if (!/^\d{1,15}(?:\.\d{1,4})?$/.test(normalizado)) return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

function fechaCronograma(value) {
  const texto = String(value || '').trim();
  let iso = texto;
  const fechaLatina = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (fechaLatina) iso = `${fechaLatina[3]}-${fechaLatina[2]}-${fechaLatina[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const fecha = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0,10) === iso ? iso : null;
}

function fechaISO(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function parsearCsv(contenido) {
  const texto = String(contenido || '').replace(/^\uFEFF/, '');
  if (!texto.trim()) throw errorValidacion('El archivo CSV esta vacio');
  if (Buffer.byteLength(texto, 'utf8') > 5 * 1024 * 1024)
    throw errorValidacion('El archivo CSV supera el limite de 5 MB', 413);
  const lineas = texto.split(/\r?\n/).filter(linea => linea.trim());
  if (lineas.length < 2) throw errorValidacion('El CSV debe contener cabecera y al menos una fila de datos');
  const delimitador = contarSeparadores(lineas[0], ';') > contarSeparadores(lineas[0], ',') ? ';' : ',';
  const cabeceras = separarLinea(lineas[0], delimitador).map(celda => celda.trim().toLowerCase());
  const coincide = esperadas => cabeceras.length === esperadas.length && cabeceras.every((cabecera, i) => cabecera === esperadas[i]);
  const incluyeCronogramaCliente = coincide(CABECERAS_CRONOGRAMA_LEGACY) || coincide(CABECERAS_CRONOGRAMA_CLIENTE) || coincide(CABECERAS_CRONOGRAMA_COMPLETO_LEGACY) || coincide(CABECERAS_CRONOGRAMA_COMPLETO);
  const incluyeCronogramaResponsable = coincide(CABECERAS_CRONOGRAMA_COMPLETO_LEGACY) || coincide(CABECERAS_CRONOGRAMA_COMPLETO);
  if (!incluyeCronogramaCliente && !coincide(CABECERAS_COSTOS)) {
    throw errorValidacion(`Las cabeceras deben ser: ${CABECERAS_COSTOS.join(',')}, ${CABECERAS_CRONOGRAMA_CLIENTE.join(',')} o ${CABECERAS_CRONOGRAMA_COMPLETO.join(',')}`);
  }
  return lineas.slice(1).map((linea, indice) => {
    const celdas = separarLinea(linea, delimitador);
    const errores = [];
    const columnasEsperadas = incluyeCronogramaResponsable ? CABECERAS_CRONOGRAMA_COMPLETO.length : incluyeCronogramaCliente ? CABECERAS_CRONOGRAMA_CLIENTE.length : CABECERAS_COSTOS.length;
    if (celdas.length !== columnasEsperadas) errores.push(`La fila debe tener exactamente ${columnasEsperadas} columnas`);
    const secuenciaTexto = celdas[0] || '';
    const secuencia = /^\d+$/.test(secuenciaTexto) ? Number(secuenciaTexto) : null;
    const precio = numeroEconomico(celdas[1]);
    const costo = numeroEconomico(celdas[2]);
    if (!Number.isInteger(secuencia) || secuencia <= 0) errores.push('Secuencia invalida');
    if (precio === null) errores.push('Precio cliente invalido; use un valor positivo o cero con hasta 4 decimales');
    if (costo === null) errores.push('Costo responsable invalido; use un valor positivo o cero con hasta 4 decimales');
    const fila = {
      fila: indice + 2,
      secuencia,
      precio_cliente: precio,
      costo_responsable: costo,
      errores
    };
    if (incluyeCronogramaCliente) {
      const fechaTexto = String(celdas[3] || '').trim();
      const numeroTexto = String(celdas[4] || '').trim();
      const ambosVacios = !fechaTexto && !numeroTexto;
      const fecha = fechaCronograma(fechaTexto);
      const numero = /^\d+$/.test(numeroTexto) && Number(numeroTexto) > 0 ? Number(numeroTexto) : null;
      if (!ambosVacios && !fecha) errores.push('Cronograma certificacion cliente invalido; use AAAA-MM-DD o DD/MM/AAAA');
      if (!ambosVacios && !numero) errores.push('Nro certificado cliente planificado invalido; use un entero mayor a cero');
      Object.assign(fila,{incluye_cronograma:true,cronograma_certificacion:ambosVacios?null:fecha,nro_certificado_planificado:ambosVacios?null:numero});
    }
    if (incluyeCronogramaResponsable) {
      const fechaTexto = String(celdas[5] || '').trim();
      const numeroTexto = String(celdas[6] || '').trim();
      const ambosVacios = !fechaTexto && !numeroTexto;
      const fecha = fechaCronograma(fechaTexto);
      const numero = /^\d+$/.test(numeroTexto) && Number(numeroTexto) > 0 ? Number(numeroTexto) : null;
      if (!ambosVacios && !fecha) errores.push('Cronograma certificacion responsable invalido; use AAAA-MM-DD o DD/MM/AAAA');
      if (!ambosVacios && !numero) errores.push('Nro certificado responsable planificado invalido; use un entero mayor a cero');
      Object.assign(fila,{incluye_cronograma_responsable:true,cronograma_certificacion_responsable:ambosVacios?null:fecha,nro_certificado_responsable_planificado:ambosVacios?null:numero});
    }
    return fila;
  });
}

async function consultarContexto(request, proyectoId, bloquear = false) {
  const hint = bloquear ? 'WITH (UPDLOCK,HOLDLOCK)' : '';
  return request.input('proyecto', sql.BigInt, proyectoId).query(`
    SELECT proyecto_id,nombre,estado,activo,eliminado
    FROM Proyecto ${hint} WHERE proyecto_id=@proyecto;
    SELECT o.operacion_id,o.secuencia,o.nombre,e.nombre etapa_nombre,
           o.precio_cliente,o.costo_responsable,o.responsable_id,
           o.cronograma_certificacion_fecha,o.numero_certificado_planificado,
           o.cronograma_certificacion_responsable_fecha,o.numero_certificado_responsable_planificado
    FROM Operacion o ${hint}
    JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
    JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id
    WHERE o.proyecto_id=@proyecto AND ISNULL(o.archivada,0)=0
    ORDER BY o.secuencia;
  `);
}

function validarProyecto(proyecto) {
  if (!proyecto) throw errorValidacion('Proyecto no encontrado', 404);
  if (!proyecto.activo || proyecto.eliminado || String(proyecto.estado).toUpperCase() !== 'ACTIVO')
    throw errorValidacion('El proyecto debe estar activo para importar costos', 409);
}

function validarSaltoSospechoso(anterior, nuevo, etiqueta, errores) {
  const valorAnterior = Number(anterior);
  const valorNuevo = Number(nuevo);
  if (valorAnterior > 0 && Number.isFinite(valorNuevo) && valorNuevo > valorAnterior * 100) {
    errores.push(`El ${etiqueta} nuevo supera 100 veces el valor anterior; revise separadores o una posible concatenacion`);
  }
}

function armarPreview(filas, operaciones) {
  const operacionesPorSecuencia = new Map(operaciones.map(op => [Number(op.secuencia), op]));
  const repeticiones = new Map();
  for (const fila of filas) {
    if (fila.secuencia !== null)
      repeticiones.set(fila.secuencia, (repeticiones.get(fila.secuencia) || 0) + 1);
  }
  const planFinal = new Map(operaciones.map(op => [Number(op.secuencia), {
    numero: op.numero_certificado_planificado === null ? null : Number(op.numero_certificado_planificado),
    fecha: fechaISO(op.cronograma_certificacion_fecha)
  }]));
  for (const fila of filas) {
    if (fila.incluye_cronograma && operacionesPorSecuencia.has(fila.secuencia)) {
      planFinal.set(fila.secuencia,{numero:fila.nro_certificado_planificado,fecha:fila.cronograma_certificacion});
    }
  }
  const fechasPorNumero = new Map();
  for (const plan of planFinal.values()) {
    if (plan.numero !== null) {
      if (!fechasPorNumero.has(plan.numero)) fechasPorNumero.set(plan.numero,new Set());
      fechasPorNumero.get(plan.numero).add(plan.fecha);
    }
  }
  const numerosInconsistentes = new Set([...fechasPorNumero].filter(([,fechas])=>fechas.size>1).map(([numero])=>numero));
  const planResponsableFinal = new Map(operaciones.map(op => [Number(op.secuencia), {
    responsableId: op.responsable_id === null ? null : Number(op.responsable_id),
    numero: op.numero_certificado_responsable_planificado === null ? null : Number(op.numero_certificado_responsable_planificado),
    fecha: fechaISO(op.cronograma_certificacion_responsable_fecha)
  }]));
  for (const fila of filas) {
    const operacion = operacionesPorSecuencia.get(fila.secuencia);
    if (fila.incluye_cronograma_responsable && operacion) {
      planResponsableFinal.set(fila.secuencia,{
        responsableId: operacion.responsable_id === null ? null : Number(operacion.responsable_id),
        numero:fila.nro_certificado_responsable_planificado,
        fecha:fila.cronograma_certificacion_responsable
      });
    }
  }
  const fechasPorResponsableNumero = new Map();
  for (const plan of planResponsableFinal.values()) {
    if (plan.responsableId !== null && plan.numero !== null) {
      const clave = `${plan.responsableId}:${plan.numero}`;
      if (!fechasPorResponsableNumero.has(clave)) fechasPorResponsableNumero.set(clave,new Set());
      fechasPorResponsableNumero.get(clave).add(plan.fecha);
    }
  }
  const planesResponsableInconsistentes = new Set([...fechasPorResponsableNumero].filter(([,fechas])=>fechas.size>1).map(([clave])=>clave));
  const detalle = filas.map(fila => {
    const operacion = operacionesPorSecuencia.get(fila.secuencia);
    const errores = [...fila.errores];
    if (fila.secuencia !== null && (repeticiones.get(fila.secuencia) || 0) > 1)
      errores.push('La secuencia esta repetida en el archivo');
    if (fila.secuencia !== null && !operacion)
      errores.push('La secuencia no existe en el plan activo del proyecto');
    if (operacion && fila.precio_cliente !== null)
      validarSaltoSospechoso(operacion.precio_cliente, fila.precio_cliente, 'precio cliente', errores);
    if (operacion && fila.costo_responsable !== null)
      validarSaltoSospechoso(operacion.costo_responsable, fila.costo_responsable, 'costo responsable', errores);
    if (fila.incluye_cronograma && fila.nro_certificado_planificado !== null && numerosInconsistentes.has(fila.nro_certificado_planificado))
      errores.push('El mismo nro de certificado planificado no puede tener fechas diferentes dentro del proyecto');
    if (operacion && fila.incluye_cronograma_responsable && fila.nro_certificado_responsable_planificado !== null && !operacion.responsable_id)
      errores.push('La operacion debe tener un responsable para planificar su certificacion');
    const clavePlanResponsable = operacion && fila.nro_certificado_responsable_planificado !== null
      ? `${Number(operacion.responsable_id)}:${fila.nro_certificado_responsable_planificado}` : null;
    if (fila.incluye_cronograma_responsable && clavePlanResponsable && planesResponsableInconsistentes.has(clavePlanResponsable))
      errores.push('El mismo nro de certificado planificado del responsable no puede tener fechas diferentes');
    const cambiaPrecio = Boolean(operacion) && Number(operacion.precio_cliente) !== fila.precio_cliente;
    const cambiaCosto = Boolean(operacion) && Number(operacion.costo_responsable) !== fila.costo_responsable;
    const fechaAnterior = operacion ? fechaISO(operacion.cronograma_certificacion_fecha) : null;
    const numeroAnterior = operacion?.numero_certificado_planificado === null || operacion?.numero_certificado_planificado === undefined ? null : Number(operacion.numero_certificado_planificado);
    const cambiaCronograma = Boolean(operacion) && fila.incluye_cronograma === true &&
      (fechaAnterior !== fila.cronograma_certificacion || numeroAnterior !== fila.nro_certificado_planificado);
    const fechaResponsableAnterior = operacion ? fechaISO(operacion.cronograma_certificacion_responsable_fecha) : null;
    const numeroResponsableAnterior = operacion?.numero_certificado_responsable_planificado === null || operacion?.numero_certificado_responsable_planificado === undefined ? null : Number(operacion.numero_certificado_responsable_planificado);
    const cambiaCronogramaResponsable = Boolean(operacion) && fila.incluye_cronograma_responsable === true &&
      (fechaResponsableAnterior !== fila.cronograma_certificacion_responsable || numeroResponsableAnterior !== fila.nro_certificado_responsable_planificado);
    return {
      ...fila,
      operacion_id: operacion ? Number(operacion.operacion_id) : null,
      operacion_nombre: operacion?.nombre || null,
      etapa_nombre: operacion?.etapa_nombre || null,
      precio_cliente_anterior: operacion ? Number(operacion.precio_cliente) : null,
      costo_responsable_anterior: operacion ? Number(operacion.costo_responsable) : null,
      cronograma_certificacion_anterior: fechaAnterior,
      nro_certificado_planificado_anterior: numeroAnterior,
      cronograma_certificacion_responsable_anterior: fechaResponsableAnterior,
      nro_certificado_responsable_planificado_anterior: numeroResponsableAnterior,
      cambia_precio: cambiaPrecio,
      cambia_costo: cambiaCosto,
      cambia_cronograma: cambiaCronograma,
      cambia_cronograma_responsable: cambiaCronogramaResponsable,
      cambia: cambiaPrecio || cambiaCosto || cambiaCronograma || cambiaCronogramaResponsable,
      valido: errores.length === 0,
      errores
    };
  });
  return {
    filas: detalle,
    total_filas: detalle.length,
    filas_validas: detalle.filter(fila => fila.valido).length,
    filas_con_error: detalle.filter(fila => !fila.valido).length,
    filas_con_cambios: detalle.filter(fila => fila.valido && fila.cambia).length
  };
}

async function previsualizar(pool, proyectoId, contenido) {
  const filas = parsearCsv(contenido);
  const contexto = await consultarContexto(pool.request(), proyectoId, false);
  validarProyecto(contexto.recordsets[0][0]);
  return {
    proyecto: contexto.recordsets[0][0],
    ...armarPreview(filas, contexto.recordsets[1])
  };
}

async function importar(pool, proyectoId, contenido, usuarioId) {
  const filas = parsearCsv(contenido);
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const contexto = await consultarContexto(new sql.Request(tx), proyectoId, true);
    validarProyecto(contexto.recordsets[0][0]);
    const preview = armarPreview(filas, contexto.recordsets[1]);
    if (preview.filas_con_error) {
      const error = errorValidacion('El CSV contiene errores; corrijalos y vuelva a generar la vista previa', 422);
      error.detalle = preview;
      throw error;
    }
    let camposActualizados = 0;
    let cronogramasActualizados = 0;
    let cronogramasResponsableActualizados = 0;
    for (const fila of preview.filas.filter(item => item.cambia)) {
      const fechaPlan = fila.incluye_cronograma ? fila.cronograma_certificacion : fila.cronograma_certificacion_anterior;
      const numeroPlan = fila.incluye_cronograma ? fila.nro_certificado_planificado : fila.nro_certificado_planificado_anterior;
      const fechaPlanResponsable = fila.incluye_cronograma_responsable ? fila.cronograma_certificacion_responsable : fila.cronograma_certificacion_responsable_anterior;
      const numeroPlanResponsable = fila.incluye_cronograma_responsable ? fila.nro_certificado_responsable_planificado : fila.nro_certificado_responsable_planificado_anterior;
      await new sql.Request(tx)
        .input('id', sql.BigInt, fila.operacion_id)
        .input('precio', sql.Decimal(19, 4), fila.precio_cliente)
        .input('costo', sql.Decimal(19, 4), fila.costo_responsable)
        .input('fecha_plan', sql.Date, fechaPlan)
        .input('numero_plan', sql.Int, numeroPlan)
        .input('fecha_plan_responsable', sql.Date, fechaPlanResponsable)
        .input('numero_plan_responsable', sql.Int, numeroPlanResponsable)
        .input('usuario', sql.BigInt, usuarioId)
        .query(`UPDATE Operacion SET precio_cliente=@precio,costo_responsable=@costo,
          cronograma_certificacion_fecha=@fecha_plan,numero_certificado_planificado=@numero_plan,
          cronograma_certificacion_responsable_fecha=@fecha_plan_responsable,
          numero_certificado_responsable_planificado=@numero_plan_responsable,
          economia_actualizada_por=@usuario,economia_actualizada_en=SYSDATETIME()
          WHERE operacion_id=@id`);
      const cambios = [];
      if (fila.cambia_precio)
        cambios.push(['precio_cliente', fila.precio_cliente_anterior, fila.precio_cliente]);
      if (fila.cambia_costo)
        cambios.push(['costo_responsable', fila.costo_responsable_anterior, fila.costo_responsable]);
      for (const [campo, anterior, nuevo] of cambios) {
        await new sql.Request(tx)
          .input('id', sql.BigInt, fila.operacion_id)
          .input('campo', sql.NVarChar(50), campo)
          .input('anterior', sql.Decimal(19, 4), anterior)
          .input('nuevo', sql.Decimal(19, 4), nuevo)
          .input('motivo', sql.NVarChar(500), MOTIVO_IMPORTACION)
          .input('usuario', sql.BigInt, usuarioId)
          .query(`INSERT INTO HistorialEconomiaOperacion
            (operacion_id,campo_modificado,valor_anterior,valor_nuevo,motivo,usuario_id)
            VALUES(@id,@campo,@anterior,@nuevo,@motivo,@usuario)`);
        camposActualizados += 1;
      }
      if (fila.cambia_cronograma) {
        await new sql.Request(tx)
          .input('id', sql.BigInt, fila.operacion_id)
          .input('fecha_anterior', sql.Date, fila.cronograma_certificacion_anterior)
          .input('numero_anterior', sql.Int, fila.nro_certificado_planificado_anterior)
          .input('fecha_nueva', sql.Date, fila.cronograma_certificacion)
          .input('numero_nuevo', sql.Int, fila.nro_certificado_planificado)
          .input('motivo', sql.NVarChar(500), MOTIVO_IMPORTACION)
          .input('usuario', sql.BigInt, usuarioId)
          .query(`INSERT INTO HistorialCronogramaCertificacionOperacion
            (operacion_id,fecha_anterior,numero_anterior,fecha_nueva,numero_nuevo,motivo,usuario_id)
            VALUES(@id,@fecha_anterior,@numero_anterior,@fecha_nueva,@numero_nuevo,@motivo,@usuario)`);
        cronogramasActualizados += 1;
      }
      if (fila.cambia_cronograma_responsable) {
        await new sql.Request(tx)
          .input('id', sql.BigInt, fila.operacion_id)
          .input('fecha_anterior', sql.Date, fila.cronograma_certificacion_responsable_anterior)
          .input('numero_anterior', sql.Int, fila.nro_certificado_responsable_planificado_anterior)
          .input('fecha_nueva', sql.Date, fila.cronograma_certificacion_responsable)
          .input('numero_nuevo', sql.Int, fila.nro_certificado_responsable_planificado)
          .input('motivo', sql.NVarChar(500), MOTIVO_IMPORTACION)
          .input('usuario', sql.BigInt, usuarioId)
          .query(`INSERT INTO HistorialCronogramaCertificacionResponsableOperacion
            (operacion_id,fecha_anterior,numero_anterior,fecha_nueva,numero_nuevo,motivo,usuario_id)
            VALUES(@id,@fecha_anterior,@numero_anterior,@fecha_nueva,@numero_nuevo,@motivo,@usuario)`);
        cronogramasResponsableActualizados += 1;
      }
    }
    await tx.commit();
    return {
      message: preview.filas_con_cambios
        ? 'Costos y cronograma importados y auditados correctamente'
        : 'El archivo es valido pero no contiene cambios',
      filas_procesadas: preview.total_filas,
      operaciones_actualizadas: preview.filas_con_cambios,
      campos_actualizados: camposActualizados,
      cronogramas_actualizados: cronogramasActualizados,
      cronogramas_responsable_actualizados: cronogramasResponsableActualizados
    };
  } catch (error) {
    try { await tx.rollback(); } catch {}
    throw error;
  }
}

module.exports = { parsearCsv, armarPreview, previsualizar, importar, validarSaltoSospechoso, MOTIVO_IMPORTACION };
