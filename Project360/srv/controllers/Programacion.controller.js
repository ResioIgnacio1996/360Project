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
        op.fecha_inicio_reprog = [finPred, fechaISO(op.fecha_no_antes_del), fechaISO(op.fecha_inicio_estimada)]
          .filter(Boolean).sort().at(-1) || null;
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
             r.nombre responsable_nombre,eo.codigo estado_codigo,eo.label_es estado_label,
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
               o.fecha_no_antes_del,o.archivada,e.codigo,e.nombre,r.nombre,eo.codigo,eo.label_es,ua.codigo
      ORDER BY o.secuencia;

      SELECT TOP 1 * FROM CalendarioProyecto WHERE proyecto_id=@proyecto_id;
      SELECT ex.* FROM ExcepcionCalendario ex
      JOIN CalendarioProyecto c ON c.calendario_id=ex.calendario_id
      WHERE c.proyecto_id=@proyecto_id;
    `);
    if (!result.recordsets[0].length) return res.status(404).json({ message: 'Proyecto no encontrado' });
    const calendario = result.recordsets[2][0] || null;
    res.json({
      proyecto: result.recordsets[0][0],
      operaciones: construirProgramacion(result.recordsets[1], calendario, result.recordsets[3]),
      calendario,
      excepciones_calendario: result.recordsets[3]
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

module.exports = { getProgramacion, actualizarDuracion, actualizarNmt };
