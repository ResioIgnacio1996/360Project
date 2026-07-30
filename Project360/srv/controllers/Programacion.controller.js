const { conectarDB, sql } = require('../DB/dbConection');

const fechaISO = (value) => value ? new Date(value).toISOString().slice(0, 10) : null;
const sumarDiasLaborales = (inicio, horas, calendario, excepciones) => {
  if (!inicio) return null;
  const fecha = new Date(`${fechaISO(inicio)}T12:00:00Z`);
  const tipos = calendario ? [calendario.tipo_domingo,calendario.tipo_lunes,calendario.tipo_martes,calendario.tipo_miercoles,calendario.tipo_jueves,calendario.tipo_viernes,calendario.tipo_sabado].map(Number) : [0,1,1,1,1,1,0];
  const exMap = new Map((excepciones || []).map(e => [fechaISO(e.fecha), Number(e.hs_disponibles)]));
  let restante = Number(horas || calendario?.hs_jornada_estandar || 9), guard = 3660;
  while (restante > 0 && guard-- > 0) {
    const excepcion = exMap.get(fechaISO(fecha));
    const tipo = tipos[fecha.getUTCDay()];
    const disponibles = excepcion ?? (tipo === 1 ? Number(calendario?.hs_jornada_estandar || 9) : tipo === 2 ? Number(calendario?.hs_jornada_parcial || 0) : 0);
    if (disponibles > 0) restante -= disponibles;
    if (restante > 0) fecha.setUTCDate(fecha.getUTCDate() + 1);
  }
  return fechaISO(fecha);
};

const construirProgramacion = (filas, calendario, excepciones) => {
  const mapa = new Map(filas.map(f => [Number(f.operacion_id), {
    ...f,
    operacion_id: Number(f.operacion_id),
    proyecto_id: Number(f.proyecto_id),
    dependencias: f.dependencias ? f.dependencias.split(',').map(Number) : []
  }]));
  const pendientes = new Set(mapa.keys());
  let guard = mapa.size + 1;

  while (pendientes.size && guard-- > 0) {
    let progreso = false;
    for (const id of [...pendientes]) {
      const op = mapa.get(id);
      const preds = op.dependencias.map(dep => mapa.get(dep)).filter(Boolean);
      if (preds.some(pred => pendientes.has(pred.operacion_id))) continue;

      if (op.fecha_fin_real) {
        op.fecha_inicio_reprog = fechaISO(op.fecha_inicio_real);
        op.fecha_fin_reprog = fechaISO(op.fecha_fin_real);
      } else if (op.fecha_inicio_real) {
        op.fecha_inicio_reprog = fechaISO(op.fecha_inicio_real);
        op.fecha_fin_reprog = sumarDiasLaborales(op.fecha_inicio_real, op.duracion_hs, calendario, excepciones);
      } else {
        const finPred = preds.map(p => p.fecha_fin_reprog || fechaISO(p.fecha_fin_estimada)).filter(Boolean).sort().at(-1);
        /*
         * Con predecesoras, el pronóstico nace de su finalización vigente. La línea
         * base no puede actuar como piso porque impediría reflejar adelantos reales.
         * Para operaciones raíz sí se conserva el inicio estimado original.
         */
        const candidatosInicio = preds.length
          ? [finPred, fechaISO(op.fecha_no_antes_del)]
          : [fechaISO(op.fecha_no_antes_del), fechaISO(op.fecha_inicio_estimada)];
        op.fecha_inicio_reprog = candidatosInicio.filter(Boolean).sort().at(-1) || null;
        op.fecha_fin_reprog = sumarDiasLaborales(op.fecha_inicio_reprog, op.duracion_hs, calendario, excepciones);
      }
      op.fecha_inicio_estimada = fechaISO(op.fecha_inicio_estimada);
      op.fecha_fin_estimada = fechaISO(op.fecha_fin_estimada);
      op.fecha_inicio_real = fechaISO(op.fecha_inicio_real);
      op.fecha_fin_real = fechaISO(op.fecha_fin_real);
      op.fecha_no_antes_del = fechaISO(op.fecha_no_antes_del);
      pendientes.delete(id);
      progreso = true;
    }
    if (!progreso) break;
  }

  for (const id of pendientes) {
    const op = mapa.get(id);
    op.estado_codigo = 'BLOQUEADA';
    op.fecha_inicio_reprog = fechaISO(op.fecha_inicio_estimada);
    op.fecha_fin_reprog = fechaISO(op.fecha_fin_estimada);
  }
  return [...mapa.values()].sort((a, b) => a.secuencia - b.secuencia);
};

const aplicarEstadosDerivados = (operaciones) => {
  const hoy = fechaISO(new Date());
  const etiquetas = {
    PENDIENTE: 'Pendiente',
    EN_CURSO: 'En curso',
    ATRASADA: 'Atrasada',
    COMPLETA: 'Completa',
    BLOQUEADA: 'Bloqueada',
    ARCHIVADA: 'Archivada'
  };
  return operaciones.map(op => {
    const avance = Number(op.pct_avance_actual || 0);
    const finVigente = fechaISO(op.fecha_fin_reprog || op.fecha_fin_estimada);
    let codigo;
    if (op.archivada) codigo = 'ARCHIVADA';
    else if (avance >= 100 || op.fecha_fin_real) codigo = 'COMPLETA';
    else if (op.estado_codigo === 'BLOQUEADA') codigo = 'BLOQUEADA';
    else if (finVigente && hoy > finVigente) codigo = 'ATRASADA';
    else if (avance > 0 || op.fecha_inicio_real) codigo = 'EN_CURSO';
    else codigo = 'PENDIENTE';
    return { ...op, estado_codigo: codigo, estado_label: etiquetas[codigo] };
  });
};

const getProgramacion = async (req, res) => {
  try {
    const pool = await conectarDB();
    const request = pool.request().input('proyecto_id', sql.BigInt, req.params.id);
    const result = await request.query(`
      SELECT p.proyecto_id,p.nombre,p.fecha_inicio,p.fecha_fin_estimada,p.estado,
             vp.codigo version_codigo
      FROM Proyecto p
      LEFT JOIN VersionPlan vp ON vp.proyecto_id=p.proyecto_id AND vp.es_activa=1
      WHERE p.proyecto_id=@proyecto_id;

      SELECT o.operacion_id,o.proyecto_id,o.secuencia,o.nombre,o.descripcion,o.criterio_cierre,
             o.duracion_hs,o.pct_avance_actual,o.cantidad_meta,o.cantidad_acumulada,
             o.fecha_inicio_estimada,o.fecha_fin_estimada,o.fecha_inicio_real,o.fecha_fin_real,
             o.fecha_no_antes_del,o.archivada,e.codigo etapa_codigo,e.nombre etapa_nombre,
             r.responsable_id,r.nombre responsable_nombre,eo.codigo estado_codigo,eo.label_es estado_label,
             ua.codigo unidad_avance,
             STRING_AGG(CONVERT(varchar(20), pred.operacion_id), ',') dependencias,
             STRING_AGG(CONVERT(varchar(20), pred.secuencia), ',') dependencias_secuencia
      FROM Operacion o
      JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id
      JOIN estado_operacion eo ON eo.estado_id=o.estado_id
      JOIN unidad_avance ua ON ua.unidad_avance_id=o.unidad_avance_id
      LEFT JOIN ResponsableOperacion r ON r.responsable_id=o.responsable_id
      LEFT JOIN OperacionDependencia od ON od.operacion_id=o.operacion_id
      LEFT JOIN Operacion pred ON pred.operacion_id=od.operacion_predecesora_id
      WHERE o.proyecto_id=@proyecto_id
        AND (o.version_id=(SELECT TOP 1 version_id FROM VersionPlan WHERE proyecto_id=@proyecto_id AND es_activa=1)
             OR o.archivada=1)
      GROUP BY o.operacion_id,o.proyecto_id,o.secuencia,o.nombre,o.descripcion,o.criterio_cierre,
               o.duracion_hs,o.pct_avance_actual,o.cantidad_meta,o.cantidad_acumulada,
               o.fecha_inicio_estimada,o.fecha_fin_estimada,o.fecha_inicio_real,o.fecha_fin_real,
               o.fecha_no_antes_del,o.archivada,e.codigo,e.nombre,r.responsable_id,r.nombre,eo.codigo,eo.label_es,ua.codigo
      ORDER BY o.secuencia;

      SELECT TOP 1 * FROM CalendarioProyecto WHERE proyecto_id=@proyecto_id;
      SELECT ex.* FROM ExcepcionCalendario ex
      JOIN CalendarioProyecto c ON c.calendario_id=ex.calendario_id
      WHERE c.proyecto_id=@proyecto_id;

      SELECT e.etapa_id,e.codigo,e.nombre,e.orden,e.peso_pct,
             CAST(ISNULL(SUM(o.pct_avance_actual * o.peso_pct) / 100.0,0) AS decimal(7,2)) pct_avance,
             CAST(ISNULL((SUM(o.pct_avance_actual * o.peso_pct) / 100.0) * e.peso_pct / 100.0,0) AS decimal(7,2)) aporte_proyecto
      FROM EtapaOperacion e
      JOIN VersionPlan vp ON vp.version_id=e.version_id AND vp.es_activa=1
      LEFT JOIN Operacion o ON o.etapa_id=e.etapa_id AND o.archivada=0
      WHERE e.proyecto_id=@proyecto_id
      GROUP BY e.etapa_id,e.codigo,e.nombre,e.orden,e.peso_pct
      ORDER BY e.orden;
    `);
    if (!result.recordsets[0].length) return res.status(404).json({ message: 'Proyecto no encontrado' });
    const calendario = result.recordsets[2][0] || null;
    res.json({
      proyecto: result.recordsets[0][0],
      operaciones: aplicarEstadosDerivados(
        construirProgramacion(result.recordsets[1], calendario, result.recordsets[3])
      ),
      calendario,
      excepciones_calendario: result.recordsets[3],
      etapas: result.recordsets[4]
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener la programación', error: error.message });
  }
};

const actualizarDuracion = async (req, res) => {
  const duracion = Number(req.body.duracion_hs);
  const motivo = String(req.body.motivo || '').trim();
  if (!(duracion > 0) || !motivo) return res.status(400).json({ message: 'Duración mayor a cero y motivo son obligatorios' });
  try {
    const pool = await conectarDB();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    const actual = await new sql.Request(tx).input('id', sql.BigInt, req.params.id)
      .query('SELECT duracion_hs FROM Operacion WHERE operacion_id=@id');
    if (!actual.recordset.length) { await tx.rollback(); return res.status(404).json({ message: 'Operación no encontrada' }); }
    await new sql.Request(tx).input('id', sql.BigInt, req.params.id).input('duracion', sql.Decimal(8, 2), duracion)
      .query('UPDATE Operacion SET duracion_hs=@duracion,fecha_actualizacion=SYSDATETIME() WHERE operacion_id=@id');
    await new sql.Request(tx).input('id', sql.BigInt, req.params.id).input('usuario', sql.BigInt, req.usuario.usuario_id)
      .input('anterior', sql.NVarChar(sql.MAX), String(actual.recordset[0].duracion_hs))
      .input('nuevo', sql.NVarChar(sql.MAX), String(duracion)).input('motivo', sql.NVarChar(sql.MAX), motivo)
      .query(`INSERT INTO HistorialOperacion(operacion_id,usuario_id,campo_modificado,valor_anterior,valor_nuevo,motivo)
              VALUES(@id,@usuario,'duracion_hs',@anterior,@nuevo,@motivo)`);
    await tx.commit();
    res.json({ message: 'Duración actualizada y cambio auditado' });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo actualizar la duración', error: error.message });
  }
};

const actualizarNmt = async (req, res) => {
  const fecha = req.body.fecha_no_antes_del || null;
  const motivo = String(req.body.motivo || '').trim();
  if (!motivo) return res.status(400).json({ message: 'El motivo es obligatorio' });
  try {
    const pool = await conectarDB();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    const actual = await new sql.Request(tx).input('id', sql.BigInt, req.params.id)
      .query('SELECT fecha_no_antes_del FROM Operacion WHERE operacion_id=@id');
    if (!actual.recordset.length) { await tx.rollback(); return res.status(404).json({ message: 'Operación no encontrada' }); }
    await new sql.Request(tx).input('id', sql.BigInt, req.params.id).input('fecha', sql.Date, fecha)
      .query('UPDATE Operacion SET fecha_no_antes_del=@fecha,fecha_actualizacion=SYSDATETIME() WHERE operacion_id=@id');
    await new sql.Request(tx).input('id', sql.BigInt, req.params.id).input('usuario', sql.BigInt, req.usuario.usuario_id)
      .input('anterior', sql.Date, actual.recordset[0].fecha_no_antes_del).input('nueva', sql.Date, fecha)
      .input('motivo', sql.NVarChar(sql.MAX), motivo)
      .query(`INSERT INTO HistorialNMT(operacion_id,usuario_id,fecha_nmt_anterior,fecha_nmt_nueva,motivo)
              VALUES(@id,@usuario,@anterior,@nueva,@motivo)`);
    await tx.commit();
    res.json({ message: fecha ? 'Restricción aplicada y auditada' : 'Restricción eliminada y auditada' });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo actualizar la restricción', error: error.message });
  }
};

const actualizarOperacion = async (req, res) => {
  const id = Number(req.params.id);
  const secuencia = Number(req.body.secuencia);
  const nombre = String(req.body.nombre || '').trim();
  const duracion = Number(req.body.duracion_hs);
  const instrucciones = String(req.body.descripcion || '').trim() || null;
  if (!Number.isInteger(id) || !Number.isInteger(secuencia) || !nombre || !(duracion > 0))
    return res.status(400).json({ message: 'Secuencia, nombre y duración válida son obligatorios' });
  try {
    const pool = await conectarDB();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    const actual = await new sql.Request(tx).input('id', sql.BigInt, id).query(`
      SELECT operacion_id,proyecto_id,version_id,secuencia,nombre,duracion_hs,descripcion,pct_avance_actual
      FROM Operacion WHERE operacion_id=@id AND ISNULL(archivada,0)=0
    `);
    if (!actual.recordset.length) {
      await tx.rollback();
      return res.status(404).json({ message: 'Operación no encontrada' });
    }
    const op = actual.recordset[0];
    if (Number(op.pct_avance_actual || 0) !== 0) {
      await tx.rollback();
      return res.status(409).json({ message: 'Solo se pueden editar operaciones con avance en 0%' });
    }
    const duplicada = await new sql.Request(tx).input('id', sql.BigInt, id)
      .input('p', sql.BigInt, op.proyecto_id).input('v', sql.BigInt, op.version_id)
      .input('s', sql.Int, secuencia)
      .query('SELECT operacion_id FROM Operacion WHERE proyecto_id=@p AND version_id=@v AND secuencia=@s AND operacion_id<>@id');
    if (duplicada.recordset.length) {
      await tx.rollback();
      return res.status(409).json({ message: `Ya existe la secuencia ${secuencia} en el plan activo` });
    }
    await new sql.Request(tx).input('id', sql.BigInt, id).input('s', sql.Int, secuencia)
      .input('n', sql.NVarChar(200), nombre).input('dh', sql.Decimal(8,2), duracion)
      .input('d', sql.NVarChar(sql.MAX), instrucciones)
      .query(`UPDATE Operacion SET secuencia=@s,nombre=@n,duracion_hs=@dh,descripcion=@d,
              fecha_actualizacion=SYSDATETIME() WHERE operacion_id=@id`);
    await new sql.Request(tx).input('id', sql.BigInt, id).input('u', sql.BigInt, req.usuario.usuario_id)
      .input('anterior', sql.NVarChar(sql.MAX), JSON.stringify({
        secuencia: op.secuencia, nombre: op.nombre, duracion_hs: op.duracion_hs, descripcion: op.descripcion
      })).input('nuevo', sql.NVarChar(sql.MAX), JSON.stringify({
        secuencia, nombre, duracion_hs: duracion, descripcion: instrucciones
      })).query(`INSERT INTO HistorialOperacion(operacion_id,usuario_id,campo_modificado,valor_anterior,valor_nuevo,motivo)
                 VALUES(@id,@u,'edicion_operacion',@anterior,@nuevo,'Edición manual con avance 0%')`);
    await tx.commit();
    res.json({ message: 'Operación actualizada; el cronograma fue recalculado' });
  } catch (error) {
    if (tx._aborted === false) try { await tx.rollback(); } catch {}
    res.status(500).json({ message: 'No se pudo actualizar la operación', error: error.message });
  }
};

const crearOperacion = async (req, res) => {
  const proyectoId = Number(req.params.id);
  const secuencia = Number(req.body.secuencia);
  const etapaId = Number(req.body.etapa_id);
  const duracion = Number(req.body.duracion_hs);
  const peso = Number(req.body.peso_pct || 0);
  const nombre = String(req.body.nombre || '').trim();
  const dependencias = [...new Set((req.body.dependencias || []).map(Number).filter(Number.isInteger))];
  if (!Number.isInteger(proyectoId) || !Number.isInteger(secuencia) || !Number.isInteger(etapaId) ||
      !nombre || !(duracion > 0) || !dependencias.length || peso < 0 || peso > 100)
    return res.status(400).json({ message: 'Etapa, secuencia, nombre, duración y al menos una predecesora son obligatorios' });
  try {
    const pool = await conectarDB();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    const rq = () => new sql.Request(tx);
    const contexto = await rq().input('p', sql.BigInt, proyectoId).input('e', sql.BigInt, etapaId).query(`
      SELECT TOP 1 vp.version_id,e.etapa_id
      FROM VersionPlan vp JOIN EtapaOperacion e ON e.version_id=vp.version_id
      WHERE vp.proyecto_id=@p AND vp.es_activa=1 AND e.etapa_id=@e;
      SELECT TOP 1 * FROM CalendarioProyecto WHERE proyecto_id=@p;
      SELECT ex.* FROM ExcepcionCalendario ex JOIN CalendarioProyecto c ON c.calendario_id=ex.calendario_id WHERE c.proyecto_id=@p;
      SELECT ISNULL(SUM(peso_pct),0) peso_actual FROM Operacion WHERE etapa_id=@e AND ISNULL(archivada,0)=0;
    `);
    if (!contexto.recordsets[0].length) {
      await tx.rollback();
      return res.status(400).json({ message: 'La etapa no pertenece a la versión activa' });
    }
    if (Number(contexto.recordsets[3][0].peso_actual) + peso > 100.01) {
      await tx.rollback();
      return res.status(422).json({ message: 'El peso de las operaciones de la etapa no puede superar el 100%' });
    }
    const versionId = contexto.recordsets[0][0].version_id;
    const duplicada = await rq().input('p', sql.BigInt, proyectoId).input('v', sql.BigInt, versionId)
      .input('s', sql.Int, secuencia)
      .query('SELECT operacion_id FROM Operacion WHERE proyecto_id=@p AND version_id=@v AND secuencia=@s');
    if (duplicada.recordset.length) {
      await tx.rollback();
      return res.status(409).json({ message: `Ya existe la secuencia ${secuencia} en el plan activo` });
    }
    let predecesoras = [];
    if (dependencias.length) {
      const depRequest = rq().input('p', sql.BigInt, proyectoId).input('v', sql.BigInt, versionId);
      const parametros = dependencias.map((valor, i) => {
        depRequest.input(`d${i}`, sql.Int, valor);
        return `@d${i}`;
      });
      const resultado = await depRequest.query(
        `SELECT operacion_id,secuencia,fecha_inicio_estimada,fecha_fin_estimada,fecha_inicio_real,fecha_fin_real
         FROM Operacion WHERE proyecto_id=@p AND version_id=@v AND secuencia IN (${parametros.join(',')})`
      );
      predecesoras = resultado.recordset;
      if (predecesoras.length !== dependencias.length) {
        await tx.rollback();
        return res.status(400).json({ message: 'Una o más operaciones predecesoras no existen en el plan activo' });
      }
    }
    const inicio = predecesoras
      .map(pred => fechaISO(pred.fecha_fin_real || pred.fecha_fin_estimada))
      .filter(Boolean).sort().at(-1);
    if (!inicio) {
      await tx.rollback();
      return res.status(422).json({ message: 'La predecesora no tiene una fecha de finalización válida' });
    }
    const catalogos = await rq().input('ua', sql.NVarChar(30), String(req.body.unidad_avance || 'PORCENTAJE'))
      .query(`SELECT TOP 1 unidad_avance_id FROM unidad_avance WHERE codigo=@ua;
              SELECT TOP 1 estado_id FROM estado_operacion WHERE codigo='PENDIENTE';
              SELECT TOP 1 tipo_restriccion_id FROM tipo_restriccion WHERE codigo='LO_ANTES_POSIBLE';`);
    if (!catalogos.recordsets[0].length || !catalogos.recordsets[1].length || !catalogos.recordsets[2].length) {
      await tx.rollback();
      return res.status(500).json({ message: 'Faltan catálogos requeridos para crear la operación' });
    }
    const responsableId = req.body.responsable_id ? Number(req.body.responsable_id) : null;
    const fin = sumarDiasLaborales(inicio, duracion, contexto.recordsets[1][0], contexto.recordsets[2]);
    const creada = await rq().input('e', sql.BigInt, etapaId).input('p', sql.BigInt, proyectoId)
      .input('v', sql.BigInt, versionId).input('r', sql.BigInt, responsableId)
      .input('es', sql.BigInt, catalogos.recordsets[1][0].estado_id)
      .input('uaid', sql.BigInt, catalogos.recordsets[0][0].unidad_avance_id)
      .input('tr', sql.BigInt, catalogos.recordsets[2][0].tipo_restriccion_id)
      .input('s', sql.Int, secuencia).input('n', sql.NVarChar(200), nombre)
      .input('d', sql.NVarChar(sql.MAX), String(req.body.descripcion || '').trim() || null)
      .input('cc', sql.NVarChar(sql.MAX), String(req.body.criterio_cierre || '').trim() || null)
      .input('dh', sql.Decimal(8,2), duracion).input('cm', sql.Decimal(10,2), req.body.cantidad_meta || null)
      .input('pe', sql.Decimal(5,2), peso).input('fi', sql.Date, inicio).input('ff', sql.Date, fin)
      .query(`INSERT INTO Operacion(etapa_id,proyecto_id,version_id,responsable_id,estado_id,unidad_avance_id,
                tipo_restriccion_id,secuencia,nombre,descripcion,criterio_cierre,duracion_hs,cantidad_meta,peso_pct,
                fecha_inicio_estimada,fecha_fin_estimada,pct_avance_actual,cantidad_acumulada,version_origen)
              OUTPUT INSERTED.operacion_id
              VALUES(@e,@p,@v,@r,@es,@uaid,@tr,@s,@n,@d,@cc,@dh,@cm,@pe,@fi,@ff,0,0,'MANUAL')`);
    const operacionId = creada.recordset[0].operacion_id;
    for (const pred of predecesoras)
      await rq().input('o', sql.BigInt, operacionId).input('pred', sql.BigInt, pred.operacion_id)
        .query('INSERT INTO OperacionDependencia(operacion_id,operacion_predecesora_id,desfase_hs) VALUES(@o,@pred,0)');
    await rq().input('o', sql.BigInt, operacionId).input('u', sql.BigInt, req.usuario.usuario_id)
      .input('nuevo', sql.NVarChar(sql.MAX), `Secuencia ${secuencia} · ${nombre}`)
      .query(`INSERT INTO HistorialOperacion(operacion_id,usuario_id,campo_modificado,valor_anterior,valor_nuevo,motivo)
              VALUES(@o,@u,'alta_manual',NULL,@nuevo,'Alta manual desde Programación')`);
    await tx.commit();
    res.status(201).json({ message: 'Operación creada e incorporada al cronograma', operacion_id: operacionId });
  } catch (error) {
    if (tx._aborted === false) try { await tx.rollback(); } catch {}
    res.status(500).json({ message: 'No se pudo crear la operación', error: error.message });
  }
};

module.exports = { getProgramacion, actualizarDuracion, actualizarNmt, actualizarOperacion, crearOperacion };
