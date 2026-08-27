const { conectarDB, sql } = require('../DB/dbConection');

const idValido = value => Number.isInteger(Number(value)) && Number(value) > 0;
const fechaISO = value => value ? new Date(value).toISOString().slice(0, 10) : null;
const fechaLegible = value => {
  const partes = String(fechaISO(value) || '').split('-');
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : '-';
};
const hoyISO = () => {
  const fecha = new Date();
  const parte = valor => String(valor).padStart(2, '0');
  return `${fecha.getFullYear()}-${parte(fecha.getMonth() + 1)}-${parte(fecha.getDate())}`;
};
const puedeCorregirFechas = usuario => ['ADMIN', 'SUPERVISOR', 'OPERARIO', 'DEMO']
  .includes(String(usuario?.rol_nombre || '').toUpperCase());
const fechaValida = fecha => /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || '')) && String(fecha) <= hoyISO();
const validarFechaEntreDependencias = async (tx, operacionId, fecha, tipo) => {
  const limites = await new sql.Request(tx).input('id', sql.BigInt, operacionId).query(`
    SELECT TOP 1 p.secuencia,p.nombre,p.fecha_fin_real
    FROM OperacionDependencia d
    JOIN Operacion p ON p.operacion_id=d.operacion_predecesora_id
    WHERE d.operacion_id=@id
    ORDER BY p.fecha_fin_real DESC,p.secuencia DESC;

    SELECT TOP 1 s.secuencia,s.nombre,s.fecha_inicio_real
    FROM OperacionDependencia d
    JOIN Operacion s ON s.operacion_id=d.operacion_id
    WHERE d.operacion_predecesora_id=@id AND s.fecha_inicio_real IS NOT NULL
    ORDER BY s.fecha_inicio_real,s.secuencia;

    SELECT COUNT(*) pendientes,STRING_AGG(CONVERT(varchar(20),p.secuencia),', ') secuencias
    FROM OperacionDependencia d
    JOIN Operacion p ON p.operacion_id=d.operacion_predecesora_id
    WHERE d.operacion_id=@id AND p.fecha_fin_real IS NULL;
  `);
  const anterior = limites.recordsets[0][0];
  const siguiente = limites.recordsets[1][0];
  const pendientes = Number(limites.recordsets[2][0]?.pendientes || 0);
  if (tipo === 'inicio' && pendientes > 0)
    return `No se puede guardar la fecha de inicio: ${pendientes === 1 ? 'la predecesora' : 'las predecesoras'} ${limites.recordsets[2][0]?.secuencias || ''} ${pendientes === 1 ? 'todavía no tiene' : 'todavía no tienen'} fecha de finalización real`;
  if (tipo === 'inicio' && anterior?.fecha_fin_real && fecha < fechaISO(anterior.fecha_fin_real))
    return `No se puede guardar el inicio del ${fechaLegible(fecha)}: la predecesora ${anterior.secuencia} finalizó el ${fechaLegible(anterior.fecha_fin_real)}`;
  if (siguiente?.fecha_inicio_real && fecha > fechaISO(siguiente.fecha_inicio_real))
    return `No se puede guardar la fecha del ${fechaLegible(fecha)}: la operación sucesora ${siguiente.secuencia} inició el ${fechaLegible(siguiente.fecha_inicio_real)}`;
  return null;
};
const sumarDiasLaborales = (inicio, horas, calendario, excepciones) => {
  if (!inicio) return null;
  const fecha = new Date(`${fechaISO(inicio)}T12:00:00Z`);
  const tipos = calendario
    ? [calendario.tipo_domingo, calendario.tipo_lunes, calendario.tipo_martes, calendario.tipo_miercoles,
       calendario.tipo_jueves, calendario.tipo_viernes, calendario.tipo_sabado].map(Number)
    : [0, 1, 1, 1, 1, 1, 0];
  const exMap = new Map((excepciones || []).map(e => [fechaISO(e.fecha), Number(e.hs_disponibles)]));
  let restante = Number(horas || calendario?.hs_jornada_estandar || 9);
  let guard = 3660;
  while (restante > 0 && guard-- > 0) {
    const tipo = tipos[fecha.getUTCDay()];
    const disponibles = exMap.get(fechaISO(fecha)) ??
      (tipo === 1 ? Number(calendario?.hs_jornada_estandar || 9) : tipo === 2 ? Number(calendario?.hs_jornada_parcial || 0) : 0);
    if (disponibles > 0) restante -= disponibles;
    if (restante > 0) fecha.setUTCDate(fecha.getUTCDate() + 1);
  }
  return fechaISO(fecha);
};

const obtener = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(400).json({ message: 'Proyecto inválido' });
  try {
    const pool = await conectarDB();
    const result = await pool.request().input('proyecto', sql.BigInt, req.params.id).query(`
      SELECT p.proyecto_id,p.nombre,p.fecha_inicio,p.fecha_fin_estimada,p.estado,
             vp.codigo version_codigo
      FROM Proyecto p
      LEFT JOIN VersionPlan vp ON vp.proyecto_id=p.proyecto_id AND vp.es_activa=1
      WHERE p.proyecto_id=@proyecto;

      SELECT o.operacion_id,o.proyecto_id,o.secuencia,o.nombre,o.descripcion,o.criterio_cierre,
             o.duracion_hs,o.cantidad_meta,o.cantidad_acumulada,o.pct_avance_actual,o.fecha_inicio_estimada,
             o.fecha_fin_estimada,o.fecha_inicio_real,o.fecha_fin_real,o.fecha_no_antes_del,
             e.codigo etapa_codigo,e.nombre etapa_nombre,eo.codigo estado_codigo,eo.label_es estado_label,
             ua.codigo unidad_avance,r.nombre responsable_nombre,
             STRING_AGG(CONVERT(varchar(20),pred.secuencia),',') dependencias_secuencia
      FROM Operacion o
      JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
      JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id
      JOIN estado_operacion eo ON eo.estado_id=o.estado_id
      JOIN unidad_avance ua ON ua.unidad_avance_id=o.unidad_avance_id
      LEFT JOIN ResponsableOperacion r ON r.responsable_id=o.responsable_id
      LEFT JOIN OperacionDependencia od ON od.operacion_id=o.operacion_id
      LEFT JOIN Operacion pred ON pred.operacion_id=od.operacion_predecesora_id
      WHERE o.proyecto_id=@proyecto AND ISNULL(o.archivada,0)=0
      GROUP BY o.operacion_id,o.proyecto_id,o.secuencia,o.nombre,o.descripcion,o.criterio_cierre,
               o.duracion_hs,o.cantidad_meta,o.cantidad_acumulada,o.pct_avance_actual,o.fecha_inicio_estimada,
               o.fecha_fin_estimada,o.fecha_inicio_real,o.fecha_fin_real,o.fecha_no_antes_del,
               e.codigo,e.nombre,eo.codigo,eo.label_es,ua.codigo,r.nombre
      ORDER BY o.secuencia;

      SELECT a.avance_id,a.operacion_id,a.pct_avance_anterior,a.pct_avance_nuevo,a.cantidad_hoy,
             a.fecha_registro,a.fecha_creacion,a.es_primer_avance,a.foto_url,a.nota,
             u.nombre registrado_por_nombre
      FROM AvanceOperacion a
      LEFT JOIN Usuario u ON u.usuario_id=a.registrado_por
      WHERE a.proyecto_id=@proyecto
      ORDER BY a.fecha_creacion DESC;

      SELECT b.bom_id,b.operacion_id,b.material_id,b.numero_linea,b.descripcion_libre,
             b.cantidad_teorica,b.preaviso_dias,b.sin_codigo,u.uom_id,u.nombre uom_nombre,
             b.descripcion_libre material_nombre,
             ISNULL((SELECT SUM(CASE WHEN c.anulado=0 THEN c.cantidad_consumida ELSE 0 END)
                     FROM ConsumoMaterialOperacion c WHERE c.bom_id=b.bom_id),0) cantidad_consumida,
             ISNULL((SELECT SUM(ct.cantidad_actual)
                     FROM Container ct
                     JOIN StockGeneral sg ON sg.stock_general_id=ct.stock_general_id
                     WHERE ct.id_proyecto=b.proyecto_id AND sg.id_material=b.material_id AND ct.activo=1),0) stock_disponible
      FROM BomOperacion b
      JOIN UoM u ON u.uom_id=b.uom_id
      WHERE b.proyecto_id=@proyecto
      ORDER BY b.operacion_id,b.numero_linea;

      SELECT c.consumo_id,c.operacion_id,c.bom_id,c.container_id,c.cantidad_consumida,c.fecha_consumo,c.fecha_creacion,c.nota,
             c.afecta_stock,c.anulado,c.fecha_anulacion,c.motivo_anulacion,
             u.nombre uom_nombre,b.descripcion_libre material_nombre,b.numero_linea,b.cantidad_teorica,
             SUM(CASE WHEN c.anulado=0 THEN c.cantidad_consumida ELSE 0 END)
               OVER (PARTITION BY c.bom_id ORDER BY c.fecha_creacion,c.consumo_id ROWS UNBOUNDED PRECEDING) consumo_acumulado
      FROM ConsumoMaterialOperacion c
      JOIN UoM u ON u.uom_id=c.uom_id
      JOIN BomOperacion b ON b.bom_id=c.bom_id
      WHERE c.proyecto_id=@proyecto
      ORDER BY c.fecha_creacion DESC;

      SELECT TOP 1 * FROM CalendarioProyecto WHERE proyecto_id=@proyecto;
      SELECT ex.* FROM ExcepcionCalendario ex
      JOIN CalendarioProyecto cp ON cp.calendario_id=ex.calendario_id
      WHERE cp.proyecto_id=@proyecto;
    `);
    if (!result.recordsets[0].length) return res.status(404).json({ message: 'Proyecto no encontrado' });
    res.json({
      proyecto: result.recordsets[0][0],
      operaciones: result.recordsets[1].map(o => {
        const calendario = result.recordsets[5][0] || null;
        const inicioReprogramado = fechaISO(o.fecha_inicio_real || o.fecha_inicio_estimada);
        return {
          ...o,
          fecha_inicio_estimada: fechaISO(o.fecha_inicio_estimada),
          fecha_fin_estimada: fechaISO(o.fecha_fin_estimada),
          fecha_inicio_real: fechaISO(o.fecha_inicio_real),
          fecha_fin_real: fechaISO(o.fecha_fin_real),
          fecha_fin_reprog: fechaISO(o.fecha_fin_real) ||
            sumarDiasLaborales(inicioReprogramado, o.duracion_hs, calendario, result.recordsets[6])
        };
      }),
      avances: result.recordsets[2],
      bom: result.recordsets[3],
      consumos: result.recordsets[4]
    });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar el avance de operaciones', error: error.message });
  }
};

const iniciar = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(400).json({ message: 'Operación inválida' });
  const fecha = req.body.fecha_inicio_real || hoyISO();
  if (!fechaValida(fecha)) return res.status(400).json({ message: 'La fecha de inicio no puede ser futura' });
  let tx;
  try {
    const pool = await conectarDB();
    tx = new sql.Transaction(pool);
    await tx.begin();
    const actual = await new sql.Request(tx).input('id', sql.BigInt, req.params.id)
      .query('SELECT fecha_inicio_real FROM Operacion WHERE operacion_id=@id AND ISNULL(archivada,0)=0');
    if (!actual.recordset.length) { await tx.rollback(); return res.status(404).json({ message: 'Operación no encontrada' }); }
    if (actual.recordset[0].fecha_inicio_real) { await tx.rollback(); return res.status(409).json({ message: 'La operación ya fue iniciada' }); }
    const errorDependencia = await validarFechaEntreDependencias(tx, req.params.id, String(fecha), 'inicio');
    if (errorDependencia) { await tx.rollback(); return res.status(400).json({ message: errorDependencia }); }
    await new sql.Request(tx).input('id', sql.BigInt, req.params.id).input('fecha', sql.Date, fecha)
      .query(`UPDATE o SET fecha_inicio_real=@fecha,fecha_actualizacion=SYSDATETIME(),
              estado_id=COALESCE((SELECT TOP 1 estado_id FROM estado_operacion WHERE codigo='EN_CURSO'),estado_id)
              FROM Operacion o WHERE operacion_id=@id`);
    await new sql.Request(tx).input('id', sql.BigInt, req.params.id)
      .input('usuario', sql.BigInt, req.usuario.usuario_id).input('nuevo', sql.NVarChar(100), fecha)
      .query(`INSERT INTO HistorialOperacion(operacion_id,usuario_id,campo_modificado,valor_anterior,valor_nuevo,motivo)
              VALUES(@id,@usuario,'fecha_inicio_real',NULL,@nuevo,'Inicio de operación')`);
    await tx.commit();
    res.json({ message: 'Operación iniciada' });
  } catch (error) {
    if (tx) try { await tx.rollback(); } catch {}
    res.status(500).json({ message: 'No se pudo iniciar la operación', error: error.message });
  }
};

const modificarFechaInicio = async (req, res) => {
  if (!idValido(req.params.id) || !puedeCorregirFechas(req.usuario))
    return res.status(403).json({ message: 'Tu rol no permite corregir fechas reales' });
  const fecha = String(req.body.fecha_inicio_real || '');
  const motivo = String(req.body.motivo || '').trim();
  if (!fechaValida(fecha) || !motivo)
    return res.status(400).json({ message: 'La fecha no puede ser futura y el motivo es obligatorio' });
  let tx;
  try {
    const pool = await conectarDB(); tx = new sql.Transaction(pool); await tx.begin();
    const actual = await new sql.Request(tx).input('id', sql.BigInt, req.params.id)
      .query('SELECT fecha_inicio_real,fecha_fin_real FROM Operacion WHERE operacion_id=@id AND ISNULL(archivada,0)=0');
    if (!actual.recordset.length || !actual.recordset[0].fecha_inicio_real) {
      await tx.rollback(); return res.status(409).json({ message: 'Primero tenés que iniciar la operación' });
    }
    if (actual.recordset[0].fecha_fin_real && fecha > fechaISO(actual.recordset[0].fecha_fin_real)) {
      await tx.rollback(); return res.status(400).json({ message: 'El inicio no puede ser posterior a la finalización' });
    }
    const errorDependencia = await validarFechaEntreDependencias(tx, req.params.id, fecha, 'inicio');
    if (errorDependencia) { await tx.rollback(); return res.status(400).json({ message: errorDependencia }); }
    const anterior = fechaISO(actual.recordset[0].fecha_inicio_real);
    await new sql.Request(tx).input('id', sql.BigInt, req.params.id).input('fecha', sql.Date, fecha)
      .query('UPDATE Operacion SET fecha_inicio_real=@fecha,fecha_actualizacion=SYSDATETIME() WHERE operacion_id=@id');
    await new sql.Request(tx).input('id', sql.BigInt, req.params.id).input('u', sql.BigInt, req.usuario.usuario_id)
      .input('a', sql.NVarChar(20), anterior).input('n', sql.NVarChar(20), fecha).input('m', sql.NVarChar(sql.MAX), motivo)
      .query(`INSERT INTO HistorialOperacion(operacion_id,usuario_id,campo_modificado,valor_anterior,valor_nuevo,motivo)
              VALUES(@id,@u,'fecha_inicio_real',@a,@n,@m)`);
    await tx.commit(); res.json({ message: 'Fecha de inicio real actualizada' });
  } catch (error) {
    if (tx?._aborted === false) try { await tx.rollback(); } catch {}
    res.status(500).json({ message: 'No se pudo modificar la fecha de inicio', error: error.message });
  }
};

const finalizar = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(400).json({ message: 'Operación inválida' });
  const fecha = String(req.body.fecha_fin_real || hoyISO());
  if (!fechaValida(fecha)) return res.status(400).json({ message: 'La fecha de finalización no puede ser futura' });
  let tx;
  try {
    const pool = await conectarDB(); tx = new sql.Transaction(pool); await tx.begin();
    const actual = await new sql.Request(tx).input('id', sql.BigInt, req.params.id)
      .query('SELECT operacion_id,proyecto_id,fecha_inicio_real,fecha_fin_real,pct_avance_actual FROM Operacion WHERE operacion_id=@id AND ISNULL(archivada,0)=0');
    if (!actual.recordset.length) { await tx.rollback(); return res.status(404).json({ message: 'Operación no encontrada' }); }
    const op = actual.recordset[0];
    if (!op.fecha_inicio_real) { await tx.rollback(); return res.status(409).json({ message: 'Primero tenés que iniciar la operación' }); }
    if (op.fecha_fin_real) { await tx.rollback(); return res.status(409).json({ message: 'La operación ya está finalizada' }); }
    if (fecha < fechaISO(op.fecha_inicio_real)) { await tx.rollback(); return res.status(400).json({ message: 'El fin no puede ser anterior al inicio' }); }
    const errorDependencia = await validarFechaEntreDependencias(tx, req.params.id, fecha, 'fin');
    if (errorDependencia) { await tx.rollback(); return res.status(400).json({ message: errorDependencia }); }
    await new sql.Request(tx).input('id', sql.BigInt, req.params.id).input('fecha', sql.Date, fecha)
      .query(`UPDATE Operacion SET fecha_fin_real=@fecha,pct_avance_actual=100,
              estado_id=COALESCE((SELECT TOP 1 estado_id FROM estado_operacion WHERE codigo='COMPLETA'),estado_id),
              fecha_actualizacion=SYSDATETIME() WHERE operacion_id=@id`);
    await new sql.Request(tx).input('op', sql.BigInt, op.operacion_id).input('p', sql.BigInt, op.proyecto_id)
      .input('u', sql.BigInt, req.usuario.usuario_id).input('ant', sql.Decimal(5,2), Number(op.pct_avance_actual || 0))
      .input('f', sql.Date, fecha).query(`INSERT INTO AvanceOperacion(operacion_id,proyecto_id,registrado_por,
        pct_avance_nuevo,pct_avance_anterior,fecha_registro,es_primer_avance,nota,es_correccion)
        VALUES(@op,@p,@u,100,@ant,@f,0,'Finalización de operación',0)`);
    await tx.commit(); res.json({ message: 'Operación finalizada' });
  } catch (error) {
    if (tx?._aborted === false) try { await tx.rollback(); } catch {}
    res.status(500).json({ message: 'No se pudo finalizar la operación', error: error.message });
  }
};

const modificarFechaFin = async (req, res) => {
  if (!idValido(req.params.id) || !puedeCorregirFechas(req.usuario))
    return res.status(403).json({ message: 'Tu rol no permite corregir fechas reales' });
  const fecha = String(req.body.fecha_fin_real || '');
  const motivo = String(req.body.motivo || '').trim();
  if (!fechaValida(fecha) || !motivo)
    return res.status(400).json({ message: 'La fecha no puede ser futura y el motivo es obligatorio' });
  let tx;
  try {
    const pool = await conectarDB(); tx = new sql.Transaction(pool); await tx.begin();
    const actual = await new sql.Request(tx).input('id', sql.BigInt, req.params.id)
      .query('SELECT fecha_inicio_real,fecha_fin_real FROM Operacion WHERE operacion_id=@id AND ISNULL(archivada,0)=0');
    if (!actual.recordset.length || !actual.recordset[0].fecha_fin_real) {
      await tx.rollback(); return res.status(409).json({ message: 'Primero tenés que finalizar la operación' });
    }
    if (fecha < fechaISO(actual.recordset[0].fecha_inicio_real)) {
      await tx.rollback(); return res.status(400).json({ message: 'El fin no puede ser anterior al inicio' });
    }
    const errorDependencia = await validarFechaEntreDependencias(tx, req.params.id, fecha, 'fin');
    if (errorDependencia) { await tx.rollback(); return res.status(400).json({ message: errorDependencia }); }
    const anterior = fechaISO(actual.recordset[0].fecha_fin_real);
    await new sql.Request(tx).input('id', sql.BigInt, req.params.id).input('fecha', sql.Date, fecha)
      .query('UPDATE Operacion SET fecha_fin_real=@fecha,fecha_actualizacion=SYSDATETIME() WHERE operacion_id=@id');
    await new sql.Request(tx).input('id', sql.BigInt, req.params.id).input('u', sql.BigInt, req.usuario.usuario_id)
      .input('a', sql.NVarChar(20), anterior).input('n', sql.NVarChar(20), fecha).input('m', sql.NVarChar(sql.MAX), motivo)
      .query(`INSERT INTO HistorialOperacion(operacion_id,usuario_id,campo_modificado,valor_anterior,valor_nuevo,motivo)
              VALUES(@id,@u,'fecha_fin_real',@a,@n,@m)`);
    await tx.commit(); res.json({ message: 'Fecha de finalización actualizada' });
  } catch (error) {
    if (tx?._aborted === false) try { await tx.rollback(); } catch {}
    res.status(500).json({ message: 'No se pudo modificar la fecha final', error: error.message });
  }
};

const registrarAvance = async (req, res) => {
  if (!idValido(req.params.id)) return res.status(400).json({ message: 'Operación inválida' });
  const porcentaje = Number(req.body.porcentaje);
  const cantidad = req.body.cantidad_hoy === null || req.body.cantidad_hoy === '' ? null : Number(req.body.cantidad_hoy);
  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100)
    return res.status(400).json({ message: 'El porcentaje debe estar entre 0 y 100' });
  if (cantidad !== null && (!Number.isFinite(cantidad) || cantidad < 0))
    return res.status(400).json({ message: 'La cantidad no puede ser negativa' });
  let tx;
  try {
    const pool = await conectarDB();
    tx = new sql.Transaction(pool);
    await tx.begin();
    const actual = await new sql.Request(tx).input('id', sql.BigInt, req.params.id)
      .query('SELECT operacion_id,proyecto_id,pct_avance_actual,cantidad_acumulada,fecha_inicio_real,fecha_fin_real FROM Operacion WHERE operacion_id=@id AND ISNULL(archivada,0)=0');
    if (!actual.recordset.length) { await tx.rollback(); return res.status(404).json({ message: 'Operación no encontrada' }); }
    const op = actual.recordset[0];
    if (!op.fecha_inicio_real) { await tx.rollback(); return res.status(409).json({ message: 'Primero tenés que iniciar la operación' }); }
    if (op.fecha_fin_real) { await tx.rollback(); return res.status(409).json({ message: 'La operación ya está finalizada; solo podés corregir sus fechas' }); }
    if (porcentaje < Number(op.pct_avance_actual || 0)) { await tx.rollback(); return res.status(400).json({ message: 'El avance no puede ser menor al registrado' }); }
    if (porcentaje === 100) { await tx.rollback(); return res.status(409).json({ message: 'Para llegar al 100% utilizá Finalizar operación' }); }
    const fecha = req.body.fecha_registro || hoyISO();
    if (!fechaValida(fecha)) { await tx.rollback(); return res.status(400).json({ message: 'La fecha del avance no puede ser futura' }); }
    if (String(fecha) < fechaISO(op.fecha_inicio_real)) { await tx.rollback(); return res.status(400).json({ message: 'La fecha del avance no puede ser anterior al inicio real' }); }
    await new sql.Request(tx).input('op', sql.BigInt, op.operacion_id).input('proyecto', sql.BigInt, op.proyecto_id)
      .input('usuario', sql.BigInt, req.usuario.usuario_id).input('nuevo', sql.Decimal(5, 2), porcentaje)
      .input('anterior', sql.Decimal(5, 2), Number(op.pct_avance_actual || 0))
      .input('cantidad', sql.Decimal(18, 4), cantidad).input('fecha', sql.Date, fecha)
      .input('nota', sql.NVarChar(sql.MAX), String(req.body.nota || '').trim() || null)
      .query(`INSERT INTO AvanceOperacion(operacion_id,proyecto_id,registrado_por,pct_avance_nuevo,pct_avance_anterior,
                cantidad_hoy,fecha_registro,es_primer_avance,fecha_inicio_real_declarada,nota,es_correccion)
              VALUES(@op,@proyecto,@usuario,@nuevo,@anterior,@cantidad,@fecha,0,NULL,@nota,0)`);
    await new sql.Request(tx).input('id', sql.BigInt, op.operacion_id).input('pct', sql.Decimal(5, 2), porcentaje)
      .input('cantidad', sql.Decimal(18, 4), cantidad).input('fecha', sql.Date, fecha)
      .query(`UPDATE o SET pct_avance_actual=@pct,cantidad_acumulada=ISNULL(cantidad_acumulada,0)+ISNULL(@cantidad,0),
              estado_id=COALESCE((SELECT TOP 1 estado_id FROM estado_operacion WHERE codigo='EN_CURSO'),estado_id),
              fecha_actualizacion=SYSDATETIME() FROM Operacion o WHERE operacion_id=@id`);
    await tx.commit();
    res.status(201).json({ message: 'Avance registrado' });
  } catch (error) {
    if (tx) try { await tx.rollback(); } catch {}
    res.status(500).json({ message: 'No se pudo registrar el avance', error: error.message });
  }
};

const registrarConsumos = async (req, res) => {
  const consumos = Array.isArray(req.body.consumos) ? req.body.consumos.filter(c => Number(c.cantidad) > 0) : [];
  if (!idValido(req.params.id) || !consumos.length) return res.status(400).json({ message: 'Informá al menos un consumo mayor a cero' });
  try {
    const pool = await conectarDB();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    for (const item of consumos) {
      const bom = await new sql.Request(tx).input('bom', sql.BigInt, item.bom_id).input('op', sql.BigInt, req.params.id)
        .query('SELECT bom_id,proyecto_id,uom_id FROM BomOperacion WHERE bom_id=@bom AND operacion_id=@op');
      if (!bom.recordset.length) { await tx.rollback(); return res.status(400).json({ message: 'Hay un material que no pertenece a la operación' }); }
      await new sql.Request(tx).input('bom', sql.BigInt, item.bom_id).input('op', sql.BigInt, req.params.id)
        .input('proyecto', sql.BigInt, bom.recordset[0].proyecto_id).input('usuario', sql.BigInt, req.usuario.usuario_id)
        .input('uom', sql.BigInt, bom.recordset[0].uom_id).input('cantidad', sql.Decimal(18, 4), Number(item.cantidad))
        .input('fecha', sql.Date, req.body.fecha_consumo || hoyISO())
        .input('nota', sql.NVarChar(sql.MAX), String(item.nota || '').trim() || null)
        .query(`INSERT INTO ConsumoMaterialOperacion(bom_id,operacion_id,proyecto_id,registrado_por,uom_id,cantidad_consumida,fecha_consumo,nota)
                VALUES(@bom,@op,@proyecto,@usuario,@uom,@cantidad,@fecha,@nota)`);
    }
    await tx.commit();
    res.status(201).json({ message: 'Consumos registrados' });
  } catch (error) {
    res.status(500).json({ message: 'No se pudieron registrar los consumos', error: error.message });
  }
};

const registrarConsumosConStock = async (req, res) => {
  const consumos = Array.isArray(req.body.consumos)
    ? req.body.consumos.filter(item => Number(item.cantidad) > 0)
    : [];
  const fecha = String(req.body.fecha_consumo || hoyISO());

  if (!idValido(req.params.id) || !consumos.length)
    return res.status(400).json({ message: 'Informá al menos un consumo mayor a cero' });
  if (!fechaValida(fecha))
    return res.status(400).json({ message: 'La fecha de consumo no puede ser futura' });

  const bomIds = consumos.map(item => Number(item.bom_id));
  if (bomIds.some(id => !idValido(id)) || new Set(bomIds).size !== bomIds.length)
    return res.status(400).json({ message: 'Las líneas BOM deben ser válidas y no pueden repetirse' });

  let tx;
  try {
    const pool = await conectarDB();
    tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const operacion = await new sql.Request(tx)
      .input('operacion_id', sql.BigInt, req.params.id)
      .query(`
        SELECT operacion_id, proyecto_id, fecha_inicio_real
        FROM Operacion WITH (UPDLOCK, HOLDLOCK)
        WHERE operacion_id=@operacion_id
          AND ISNULL(archivada,0)=0
      `);

    if (!operacion.recordset.length) {
      await tx.rollback();
      return res.status(404).json({ message: 'Operación no encontrada' });
    }
    if (!operacion.recordset[0].fecha_inicio_real) {
      await tx.rollback();
      return res.status(409).json({ message: 'Primero tenés que iniciar la operación' });
    }

    const registrados = [];

    for (const item of consumos) {
      const cantidad = Number(item.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        await tx.rollback();
        return res.status(400).json({ message: 'Las cantidades consumidas deben ser mayores a cero' });
      }
      if (Math.abs(cantidad * 100 - Math.round(cantidad * 100)) > 0.000001) {
        await tx.rollback();
        return res.status(400).json({ message: 'Las cantidades consumidas admiten hasta 2 decimales' });
      }

      const bom = await new sql.Request(tx)
        .input('bom_id', sql.BigInt, item.bom_id)
        .input('operacion_id', sql.BigInt, req.params.id)
        .query(`
          SELECT
            b.bom_id,
            b.proyecto_id,
            b.uom_id,
            b.descripcion_libre,
            b.material_id,
            COALESCE(m.nombre,b.descripcion_libre) AS material_nombre
          FROM BomOperacion b WITH (UPDLOCK, HOLDLOCK)
          LEFT JOIN Materiales m ON m.id_material=b.material_id
          WHERE b.bom_id=@bom_id
            AND b.operacion_id=@operacion_id
        `);

      if (!bom.recordset.length) {
        await tx.rollback();
        return res.status(400).json({ message: 'Hay un material que no pertenece a la operación' });
      }

      const linea = bom.recordset[0];
      if (!linea.material_id) {
        await tx.rollback();
        return res.status(409).json({
          message: `El material BOM "${linea.descripcion_libre}" no está vinculado al catálogo de Materiales`
        });
      }

      const containers = await new sql.Request(tx)
        .input('proyecto_id', sql.BigInt, linea.proyecto_id)
        .input('material_id', sql.BigInt, linea.material_id)
        .query(`
          SELECT c.container_id, c.cantidad_actual, cs.fecha_valorizacion
          FROM Container c WITH (UPDLOCK, HOLDLOCK)
          JOIN StockGeneral sg ON sg.stock_general_id=c.stock_general_id
          LEFT JOIN CostoStock cs ON cs.conteiner_id=c.container_id AND cs.activo=1
          WHERE c.id_proyecto=@proyecto_id
            AND sg.id_material=@material_id
            AND c.activo=1
            AND c.cantidad_actual>0
          ORDER BY
            CASE WHEN cs.fecha_valorizacion IS NULL THEN 1 ELSE 0 END,
            cs.fecha_valorizacion,
            c.container_id
        `);

      if (!containers.recordset.length) {
        await tx.rollback();
        return res.status(409).json({
          message: `El proyecto no tiene stock asignado de ${linea.material_nombre}`
        });
      }

      const stockFisico = containers.recordset.reduce(
        (total, container) => total + Number(container.cantidad_actual || 0),
        0
      );
      const disponible = stockFisico;

      if (cantidad > disponible + 0.000001) {
        await tx.rollback();
        return res.status(409).json({
          message: `Stock insuficiente de ${linea.material_nombre}. Disponible: ${Math.max(0, disponible)}`
        });
      }

      let restante = cantidad;
      for (const containerActual of containers.recordset) {
        if (restante <= 0.000001) break;
        const cantidadContainer = Math.min(restante, Number(containerActual.cantidad_actual));
        if (cantidadContainer <= 0) continue;

        await new sql.Request(tx)
          .input('container_id', sql.BigInt, containerActual.container_id)
          .input('cantidad', sql.Decimal(18, 2), cantidadContainer)
          .query(`
            UPDATE Container
            SET cantidad_actual=cantidad_actual-@cantidad
            WHERE container_id=@container_id
          `);

        const consumo = await new sql.Request(tx)
          .input('bom_id', sql.BigInt, linea.bom_id)
          .input('operacion_id', sql.BigInt, req.params.id)
          .input('proyecto_id', sql.BigInt, linea.proyecto_id)
          .input('usuario_id', sql.BigInt, req.usuario.usuario_id)
          .input('uom_id', sql.BigInt, linea.uom_id)
          .input('container_id', sql.BigInt, containerActual.container_id)
          .input('cantidad', sql.Decimal(18, 2), cantidadContainer)
          .input('fecha', sql.Date, fecha)
          .input('nota', sql.NVarChar(sql.MAX), String(item.nota || req.body.nota || '').trim() || null)
          .query(`
            INSERT INTO ConsumoMaterialOperacion(
              bom_id, operacion_id, proyecto_id, registrado_por, uom_id,
              container_id, cantidad_consumida, fecha_consumo, nota, afecta_stock, anulado
            )
            OUTPUT INSERTED.consumo_id
            VALUES(
              @bom_id, @operacion_id, @proyecto_id, @usuario_id, @uom_id,
              @container_id, @cantidad, @fecha, @nota, 1, 0
            )
          `);

        registrados.push({
          consumo_id: consumo.recordset[0].consumo_id,
          bom_id: linea.bom_id,
          material: linea.material_nombre,
          cantidad: cantidadContainer,
          container_id: containerActual.container_id
        });
        restante = Number((restante - cantidadContainer).toFixed(2));
      }
    }

    await tx.commit();
    res.status(201).json({ message: 'Consumos registrados y stock actualizado', consumos: registrados });
  } catch (error) {
    if (tx) try { await tx.rollback(); } catch {}
    console.error('Error al registrar consumos:', error);
    const fechaInvalida = error?.number === 547 && String(error.message).includes('CK_ConsumoMaterialOperacion_fecha');
    res.status(fechaInvalida ? 400 : 500).json({
      message: fechaInvalida ? 'La fecha de consumo no puede ser futura' : 'No se pudieron registrar los consumos',
      error: error.message
    });
  }
};

const anularConsumo = async (req, res) => {
  if (!idValido(req.params.id))
    return res.status(400).json({ message: 'Consumo inválido' });

  const motivo = String(req.body.motivo || '').trim();
  if (!motivo)
    return res.status(400).json({ message: 'El motivo de la anulación es obligatorio' });

  let tx;
  try {
    const pool = await conectarDB();
    tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const consumo = await new sql.Request(tx)
      .input('consumo_id', sql.BigInt, req.params.id)
      .query(`
        SELECT consumo_id, container_id, cantidad_consumida, afecta_stock, anulado
        FROM ConsumoMaterialOperacion WITH (UPDLOCK, HOLDLOCK)
        WHERE consumo_id=@consumo_id
      `);

    if (!consumo.recordset.length) {
      await tx.rollback();
      return res.status(404).json({ message: 'Consumo no encontrado' });
    }

    const actual = consumo.recordset[0];
    if (actual.anulado) {
      await tx.rollback();
      return res.status(409).json({ message: 'El consumo ya fue anulado' });
    }

    if (actual.afecta_stock) {
      if (!actual.container_id) {
        await tx.rollback();
        return res.status(409).json({ message: 'El consumo no tiene un Container asociado para devolver el material' });
      }

      const container = await new sql.Request(tx)
        .input('container_id', sql.BigInt, actual.container_id)
        .query(`
          SELECT container_id
          FROM Container WITH (UPDLOCK, HOLDLOCK)
          WHERE container_id=@container_id
        `);

      if (!container.recordset.length) {
        await tx.rollback();
        return res.status(409).json({ message: 'No existe el Container original del consumo' });
      }

      await new sql.Request(tx)
        .input('container_id', sql.BigInt, actual.container_id)
        .input('cantidad', sql.Decimal(18, 2), actual.cantidad_consumida)
        .query(`
          UPDATE Container
          SET cantidad_actual=cantidad_actual+@cantidad, activo=1
          WHERE container_id=@container_id
        `);
    }

    await new sql.Request(tx)
      .input('consumo_id', sql.BigInt, actual.consumo_id)
      .input('usuario_id', sql.BigInt, req.usuario.usuario_id)
      .input('motivo', sql.NVarChar(500), motivo)
      .query(`
        UPDATE ConsumoMaterialOperacion
        SET
          anulado=1,
          fecha_anulacion=SYSDATETIME(),
          anulado_por=@usuario_id,
          motivo_anulacion=@motivo
        WHERE consumo_id=@consumo_id
      `);

    await tx.commit();
    res.json({ message: 'Consumo anulado y material devuelto al stock del proyecto' });
  } catch (error) {
    if (tx) try { await tx.rollback(); } catch {}
    res.status(500).json({ message: 'No se pudo anular el consumo', error: error.message });
  }
};

module.exports = {
  obtener,
  iniciar,
  modificarFechaInicio,
  finalizar,
  modificarFechaFin,
  registrarAvance,
  registrarConsumos: registrarConsumosConStock,
  anularConsumo
};
