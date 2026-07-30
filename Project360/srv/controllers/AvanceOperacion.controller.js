const { conectarDB, sql } = require('../DB/dbConection');

const idValido = value => Number.isInteger(Number(value)) && Number(value) > 0;
const fechaISO = value => value ? new Date(value).toISOString().slice(0, 10) : null;
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
             m.Nombre material_nombre,
             ISNULL((SELECT SUM(c.cantidad_consumida) FROM ConsumoMaterialOperacion c WHERE c.bom_id=b.bom_id),0) cantidad_consumida
      FROM BomOperacion b
      JOIN UoM u ON u.uom_id=b.uom_id
      LEFT JOIN Materiales m ON m.id_material=b.material_id
      WHERE b.proyecto_id=@proyecto
      ORDER BY b.operacion_id,b.numero_linea;

      SELECT c.consumo_id,c.operacion_id,c.bom_id,c.cantidad_consumida,c.fecha_consumo,c.nota,
             u.nombre uom_nombre
      FROM ConsumoMaterialOperacion c
      JOIN UoM u ON u.uom_id=c.uom_id
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
  const fecha = req.body.fecha_inicio_real || new Date().toISOString().slice(0, 10);
  try {
    const pool = await conectarDB();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    const actual = await new sql.Request(tx).input('id', sql.BigInt, req.params.id)
      .query('SELECT fecha_inicio_real FROM Operacion WHERE operacion_id=@id AND ISNULL(archivada,0)=0');
    if (!actual.recordset.length) { await tx.rollback(); return res.status(404).json({ message: 'Operación no encontrada' }); }
    if (actual.recordset[0].fecha_inicio_real) { await tx.rollback(); return res.status(409).json({ message: 'La operación ya fue iniciada' }); }
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
    res.status(500).json({ message: 'No se pudo iniciar la operación', error: error.message });
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
  try {
    const pool = await conectarDB();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    const actual = await new sql.Request(tx).input('id', sql.BigInt, req.params.id)
      .query('SELECT operacion_id,proyecto_id,pct_avance_actual,cantidad_acumulada,fecha_inicio_real FROM Operacion WHERE operacion_id=@id AND ISNULL(archivada,0)=0');
    if (!actual.recordset.length) { await tx.rollback(); return res.status(404).json({ message: 'Operación no encontrada' }); }
    const op = actual.recordset[0];
    if (porcentaje < Number(op.pct_avance_actual || 0)) { await tx.rollback(); return res.status(400).json({ message: 'El avance no puede ser menor al registrado' }); }
    const fecha = req.body.fecha_registro || new Date().toISOString().slice(0, 10);
    await new sql.Request(tx).input('op', sql.BigInt, op.operacion_id).input('proyecto', sql.BigInt, op.proyecto_id)
      .input('usuario', sql.BigInt, req.usuario.usuario_id).input('nuevo', sql.Decimal(5, 2), porcentaje)
      .input('anterior', sql.Decimal(5, 2), Number(op.pct_avance_actual || 0))
      .input('cantidad', sql.Decimal(18, 4), cantidad).input('fecha', sql.Date, fecha)
      .input('primero', sql.Bit, op.fecha_inicio_real ? 0 : 1).input('nota', sql.NVarChar(sql.MAX), String(req.body.nota || '').trim() || null)
      .query(`INSERT INTO AvanceOperacion(operacion_id,proyecto_id,registrado_por,pct_avance_nuevo,pct_avance_anterior,
                cantidad_hoy,fecha_registro,es_primer_avance,fecha_inicio_real_declarada,nota,es_correccion)
              VALUES(@op,@proyecto,@usuario,@nuevo,@anterior,@cantidad,@fecha,@primero,CASE WHEN @primero=1 THEN @fecha END,@nota,0)`);
    await new sql.Request(tx).input('id', sql.BigInt, op.operacion_id).input('pct', sql.Decimal(5, 2), porcentaje)
      .input('cantidad', sql.Decimal(18, 4), cantidad).input('fecha', sql.Date, fecha)
      .query(`UPDATE o SET pct_avance_actual=@pct,cantidad_acumulada=ISNULL(cantidad_acumulada,0)+ISNULL(@cantidad,0),
              fecha_inicio_real=COALESCE(fecha_inicio_real,@fecha),fecha_fin_real=CASE WHEN @pct=100 THEN @fecha ELSE fecha_fin_real END,
              estado_id=COALESCE((SELECT TOP 1 estado_id FROM estado_operacion WHERE codigo=CASE WHEN @pct=100 THEN 'COMPLETA' ELSE 'EN_CURSO' END),estado_id),
              fecha_actualizacion=SYSDATETIME() FROM Operacion o WHERE operacion_id=@id`);
    await tx.commit();
    res.status(201).json({ message: 'Avance registrado' });
  } catch (error) {
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
        .input('fecha', sql.Date, req.body.fecha_consumo || new Date().toISOString().slice(0, 10))
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

module.exports = { obtener, iniciar, registrarAvance, registrarConsumos };
