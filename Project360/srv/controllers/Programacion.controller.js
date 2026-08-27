const { conectarDB, sql } = require('../DB/dbConection');
const {
  fechaISO, sumarDiasLaborales, sumarDesfaseLaboral, construirProgramacion
} = require('../services/ProgramacionFechas.service');

const aplicarEstadosDerivados = (operaciones) => {
  const hoy = fechaISO(new Date());
  const etiquetas = {
    EN_TERMINO: 'En término',
    EN_RIESGO: 'En riesgo',
    ATRASADA: 'Atrasada',
    CUMPLIDA: 'Cumplida',
    CUMPLIDA_A_TIEMPO: 'Cumplida a tiempo',
    CUMPLIDA_CON_DEMORA: 'Cumplida con demora',
    BLOQUEADA: 'Bloqueada',
    ARCHIVADA: 'Archivada'
  };
  return operaciones.map(op => {
    const avance = Number(op.pct_avance_actual || 0);
    const finEstimada = fechaISO(op.fecha_fin_estimada);
    const finReal = fechaISO(op.fecha_fin_real);
    const diasParaVencer = finEstimada
      ? Math.round((Date.parse(finEstimada) - Date.parse(hoy)) / 86400000)
      : null;
    let codigo;
    if (op.archivada) codigo = 'ARCHIVADA';
    else if (op.estado_codigo === 'BLOQUEADA') codigo = 'BLOQUEADA';
    else if (avance >= 100 && finReal && finEstimada && finReal <= finEstimada)
      codigo = 'CUMPLIDA_A_TIEMPO';
    else if (avance >= 100 && finReal && finEstimada && finReal > finEstimada)
      codigo = 'CUMPLIDA_CON_DEMORA';
    else if (avance >= 100) codigo = 'CUMPLIDA';
    else if (finEstimada && finEstimada < hoy) codigo = 'ATRASADA';
    else if (diasParaVencer !== null && diasParaVencer >= 0 && diasParaVencer <= 3)
      codigo = 'EN_RIESGO';
    else codigo = 'EN_TERMINO';
    return { ...op, estado_codigo: codigo, estado_label: etiquetas[codigo] };
  });
};

const getProgramacion = async (req, res) => {
  try {
    const pool = await conectarDB();
    const request = pool.request().input('proyecto_id', sql.BigInt, req.params.id);
    const result = await request.query(`
      SELECT p.proyecto_id,p.nombre,p.fecha_inicio,p.fecha_fin_estimada,p.estado,
             vp.version_id,vp.codigo version_codigo
      FROM Proyecto p
      LEFT JOIN VersionPlan vp ON vp.proyecto_id=p.proyecto_id AND vp.es_activa=1
      WHERE p.proyecto_id=@proyecto_id;

      SELECT o.operacion_id,o.proyecto_id,o.secuencia,o.nombre,o.descripcion,o.criterio_cierre,
             o.duracion_hs,o.desfase_inicio_hs,o.peso_pct,o.pct_avance_actual,o.cantidad_meta,o.cantidad_acumulada,
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
               o.duracion_hs,o.desfase_inicio_hs,o.peso_pct,o.pct_avance_actual,o.cantidad_meta,o.cantidad_acumulada,
               o.fecha_inicio_estimada,o.fecha_fin_estimada,o.fecha_inicio_real,o.fecha_fin_real,
               o.fecha_no_antes_del,o.archivada,e.codigo,e.nombre,r.responsable_id,r.nombre,eo.codigo,eo.label_es,ua.codigo
      ORDER BY o.secuencia;

      SELECT TOP 1 * FROM CalendarioProyecto WHERE proyecto_id=@proyecto_id;
      SELECT ex.* FROM ExcepcionCalendario ex
      JOIN CalendarioProyecto c ON c.calendario_id=ex.calendario_id
      WHERE c.proyecto_id=@proyecto_id;

      SELECT e.etapa_id,e.proyecto_id,e.version_id,e.estado_id,e.codigo,e.nombre,e.orden,e.peso_pct,
             ee.codigo estado_codigo,ee.label_es estado_label,ee.color_hex estado_color,
             e.fecha_creacion,e.fecha_actualizacion,
             CAST(ISNULL(SUM(o.pct_avance_actual * o.peso_pct) / 100.0,0) AS decimal(7,2)) pct_avance,
             CAST(ISNULL((SUM(o.pct_avance_actual * o.peso_pct) / 100.0) * e.peso_pct / 100.0,0) AS decimal(7,2)) aporte_proyecto
      FROM EtapaOperacion e
      JOIN VersionPlan vp ON vp.version_id=e.version_id AND vp.es_activa=1
      JOIN estado_etapa ee ON ee.estado_id=e.estado_id
      LEFT JOIN Operacion o ON o.etapa_id=e.etapa_id AND o.archivada=0
      WHERE e.proyecto_id=@proyecto_id
      GROUP BY e.etapa_id,e.proyecto_id,e.version_id,e.estado_id,e.codigo,e.nombre,e.orden,e.peso_pct,
               ee.codigo,ee.label_es,ee.color_hex,e.fecha_creacion,e.fecha_actualizacion
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
  let tx;
  try {
    const pool = await conectarDB();
    tx = new sql.Transaction(pool);
    await tx.begin();
    const actual = await new sql.Request(tx).input('id', sql.BigInt, req.params.id)
      .query('SELECT fecha_no_antes_del,fecha_inicio_real FROM Operacion WHERE operacion_id=@id');
    if (fecha && actual.recordset[0]?.fecha_inicio_real) {
      await tx.rollback();
      return res.status(409).json({ message: 'NMT solo puede aplicarse a una operación que todavía no inició' });
    }
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
    if (tx?._aborted === false) try { await tx.rollback(); } catch {}
    res.status(500).json({ message: 'No se pudo actualizar la restricción', error: error.message });
  }
};

const actualizarOperacion = async (req, res) => {
  const id = Number(req.params.id);
  const secuencia = Number(req.body.secuencia);
  const nombre = String(req.body.nombre || '').trim();
  const duracion = Number(req.body.duracion_hs);
  const peso = Number(req.body.peso_pct);
  const desfaseInicio = Number(req.body.desfase_inicio_hs || 0);
  const instrucciones = String(req.body.descripcion || '').trim() || null;
  const dependencias = [...new Set((req.body.dependencias || []).map(Number).filter(Number.isInteger))];
  if (!Number.isInteger(id) || !Number.isInteger(secuencia) || !nombre || !(duracion > 0) ||
      !Number.isFinite(peso) || peso < 0 || peso > 100 || !Number.isInteger(desfaseInicio) || desfaseInicio < 0)
    return res.status(400).json({ message: 'Secuencia, nombre, duración, peso y desfase de inicio válidos son obligatorios' });
  let tx;
  try {
    const pool = await conectarDB();
    tx = new sql.Transaction(pool);
    await tx.begin();
    const actual = await new sql.Request(tx).input('id', sql.BigInt, id).query(`
      SELECT operacion_id,proyecto_id,version_id,etapa_id,secuencia,nombre,duracion_hs,desfase_inicio_hs,descripcion,peso_pct,pct_avance_actual
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
    const pesoEtapa = await new sql.Request(tx).input('etapa', sql.BigInt, op.etapa_id)
      .input('id', sql.BigInt, id).query(`
        SELECT ISNULL(SUM(peso_pct),0) peso_otros
        FROM Operacion
        WHERE etapa_id=@etapa AND operacion_id<>@id AND ISNULL(archivada,0)=0
      `);
    const pesoOtros = Number(pesoEtapa.recordset[0].peso_otros || 0);
    if (pesoOtros + peso > 100.01) {
      await tx.rollback();
      return res.status(422).json({
        message: `El peso excede el 100% de la etapa. Las otras operaciones suman ${pesoOtros.toFixed(2)}%; disponible ${(100 - pesoOtros).toFixed(2)}%`
      });
    }
    const duplicada = await new sql.Request(tx).input('id', sql.BigInt, id)
      .input('p', sql.BigInt, op.proyecto_id).input('v', sql.BigInt, op.version_id)
      .input('s', sql.Int, secuencia)
      .query('SELECT operacion_id FROM Operacion WHERE proyecto_id=@p AND version_id=@v AND secuencia=@s AND operacion_id<>@id');
    if (duplicada.recordset.length) {
      await tx.rollback();
      return res.status(409).json({ message: `Ya existe la secuencia ${secuencia} en el plan activo` });
    }
    if (dependencias.includes(Number(op.secuencia))) {
      await tx.rollback();
      return res.status(400).json({ message: 'Una operación no puede depender de sí misma' });
    }
    let predecesoras = [];
    if (dependencias.length) {
      const depRequest = new sql.Request(tx).input('p', sql.BigInt, op.proyecto_id)
        .input('v', sql.BigInt, op.version_id);
      const parametros = dependencias.map((valor, i) => {
        depRequest.input(`dep${i}`, sql.Int, valor);
        return `@dep${i}`;
      });
      const resultado = await depRequest.query(`SELECT operacion_id,secuencia FROM Operacion
        WHERE proyecto_id=@p AND version_id=@v AND ISNULL(archivada,0)=0
          AND secuencia IN (${parametros.join(',')})`);
      predecesoras = resultado.recordset;
      if (predecesoras.length !== dependencias.length) {
        await tx.rollback();
        return res.status(400).json({ message: 'Una o más predecesoras no pertenecen al plan activo' });
      }
    }
    const aristas = await new sql.Request(tx).input('v', sql.BigInt, op.version_id)
      .input('id', sql.BigInt, id).query(`
        SELECT od.operacion_id,od.operacion_predecesora_id
        FROM OperacionDependencia od JOIN Operacion o ON o.operacion_id=od.operacion_id
        WHERE o.version_id=@v AND o.operacion_id<>@id
      `);
    const grafo = new Map();
    for (const arista of aristas.recordset)
      grafo.set(Number(arista.operacion_id), [
        ...(grafo.get(Number(arista.operacion_id)) || []),
        Number(arista.operacion_predecesora_id)
      ]);
    grafo.set(id, predecesoras.map(item => Number(item.operacion_id)));
    const visitando = new Set(), visitados = new Set();
    const tieneCiclo = nodo => {
      if (visitando.has(nodo)) return true;
      if (visitados.has(nodo)) return false;
      visitando.add(nodo);
      for (const pred of grafo.get(nodo) || []) if (tieneCiclo(pred)) return true;
      visitando.delete(nodo);
      visitados.add(nodo);
      return false;
    };
    if ([...grafo.keys()].some(tieneCiclo)) {
      await tx.rollback();
      return res.status(422).json({ message: 'Las predecesoras generan un ciclo en la programación' });
    }
    await new sql.Request(tx).input('id', sql.BigInt, id).input('s', sql.Int, secuencia)
      .input('n', sql.NVarChar(500), nombre).input('dh', sql.Decimal(8,2), duracion)
      .input('pe', sql.Decimal(5,2), peso)
      .input('di', sql.Int, desfaseInicio)
      .input('d', sql.NVarChar(sql.MAX), instrucciones)
      .query(`UPDATE Operacion SET secuencia=@s,nombre=@n,duracion_hs=@dh,desfase_inicio_hs=@di,peso_pct=@pe,descripcion=@d,
              fecha_actualizacion=SYSDATETIME() WHERE operacion_id=@id`);
    await new sql.Request(tx).input('id', sql.BigInt, id)
      .query('DELETE FROM OperacionDependencia WHERE operacion_id=@id');
    for (const pred of predecesoras)
      await new sql.Request(tx).input('id', sql.BigInt, id).input('pred', sql.BigInt, pred.operacion_id)
        .query('INSERT INTO OperacionDependencia(operacion_id,operacion_predecesora_id,desfase_hs) VALUES(@id,@pred,0)');
    await new sql.Request(tx).input('id', sql.BigInt, id).input('u', sql.BigInt, req.usuario.usuario_id)
      .input('anterior', sql.NVarChar(sql.MAX), JSON.stringify({
        secuencia: op.secuencia, nombre: op.nombre, duracion_hs: op.duracion_hs,
        desfase_inicio_hs: op.desfase_inicio_hs, peso_pct: op.peso_pct, descripcion: op.descripcion
      })).input('nuevo', sql.NVarChar(sql.MAX), JSON.stringify({
        secuencia, nombre, duracion_hs: duracion, desfase_inicio_hs: desfaseInicio,
        peso_pct: peso, descripcion: instrucciones
      })).query(`INSERT INTO HistorialOperacion(operacion_id,usuario_id,campo_modificado,valor_anterior,valor_nuevo,motivo)
                 VALUES(@id,@u,'edicion_operacion',@anterior,@nuevo,'Edición manual con avance 0%')`);
    await tx.commit();
    res.json({ message: 'Operación actualizada; el cronograma fue recalculado' });
  } catch (error) {
    if (tx?._aborted === false) try { await tx.rollback(); } catch {}
    res.status(500).json({ message: 'No se pudo actualizar la operación', error: error.message });
  }
};

const crearOperacion = async (req, res) => {
  const proyectoId = Number(req.params.id);
  const secuencia = Number(req.body.secuencia);
  const etapaId = Number(req.body.etapa_id);
  const duracion = Number(req.body.duracion_hs);
  const peso = Number(req.body.peso_pct || 0);
  const desfaseInicio = Number(req.body.desfase_inicio_hs || 0);
  const nombre = String(req.body.nombre || '').trim();
  const dependencias = [...new Set((req.body.dependencias || []).map(Number).filter(Number.isInteger))];
  if (!Number.isInteger(proyectoId) || !Number.isInteger(secuencia) || !Number.isInteger(etapaId) ||
      !nombre || !(duracion > 0) || !dependencias.length || peso < 0 || peso > 100 ||
      !Number.isInteger(desfaseInicio) || desfaseInicio < 0)
    return res.status(400).json({ message: 'Etapa, secuencia, nombre, duración, desfase válido y al menos una predecesora son obligatorios' });
  let tx;
  try {
    const pool = await conectarDB();
    tx = new sql.Transaction(pool);
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
    const finPredecesora = predecesoras
      .map(pred => fechaISO(pred.fecha_fin_real || pred.fecha_fin_estimada))
      .filter(Boolean).sort().at(-1);
    if (!finPredecesora) {
      await tx.rollback();
      return res.status(422).json({ message: 'La predecesora no tiene una fecha de finalización válida' });
    }
    const inicio = sumarDesfaseLaboral(finPredecesora, desfaseInicio, contexto.recordsets[1][0], contexto.recordsets[2]);
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
      .input('s', sql.Int, secuencia).input('n', sql.NVarChar(500), nombre)
      .input('d', sql.NVarChar(sql.MAX), String(req.body.descripcion || '').trim() || null)
      .input('cc', sql.NVarChar(sql.MAX), String(req.body.criterio_cierre || '').trim() || null)
      .input('dh', sql.Decimal(8,2), duracion).input('cm', sql.Decimal(10,2), req.body.cantidad_meta || null)
      .input('di', sql.Int, desfaseInicio)
      .input('pe', sql.Decimal(5,2), peso).input('fi', sql.Date, inicio).input('ff', sql.Date, fin)
      .query(`INSERT INTO Operacion(etapa_id,proyecto_id,version_id,responsable_id,estado_id,unidad_avance_id,
                 tipo_restriccion_id,secuencia,nombre,descripcion,criterio_cierre,duracion_hs,desfase_inicio_hs,cantidad_meta,peso_pct,
                fecha_inicio_estimada,fecha_fin_estimada,pct_avance_actual,cantidad_acumulada,version_origen)
              OUTPUT INSERTED.operacion_id
               VALUES(@e,@p,@v,@r,@es,@uaid,@tr,@s,@n,@d,@cc,@dh,@di,@cm,@pe,@fi,@ff,0,0,'MANUAL')`);
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
    if (tx?._aborted === false) try { await tx.rollback(); } catch {}
    res.status(500).json({ message: 'No se pudo crear la operación', error: error.message });
  }
};

const guardarExcepcionCalendario = async (req, res) => {
  const proyectoId = Number(req.params.id);
  const fecha = String(req.body.fecha || '').trim();
  const tipo = String(req.body.tipo || '').toUpperCase();
  const motivo = String(req.body.motivo || '').trim();
  const horas = tipo === 'FERIADO' ? 0 : Number(req.body.hs_disponibles);
  if (!Number.isInteger(proyectoId) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !motivo ||
      !['FERIADO','JORNADA_REDUCIDA','JORNADA_EXTENDIDA'].includes(tipo) ||
      !Number.isFinite(horas) || horas < 0)
    return res.status(400).json({ message: 'Fecha, tipo, horas y motivo válidos son obligatorios' });
  try {
    const pool = await conectarDB();
    await pool.request().input('p', sql.BigInt, proyectoId).input('f', sql.Date, fecha)
      .input('t', sql.NVarChar(30), tipo).input('h', sql.Decimal(4,2), horas)
      .input('m', sql.NVarChar(200), motivo).input('r', sql.Bit, req.body.recuperable ? 1 : 0)
      .query(`
        DECLARE @calendario_id bigint=(SELECT TOP 1 calendario_id FROM CalendarioProyecto WHERE proyecto_id=@p);
        IF @calendario_id IS NULL THROW 50001,'El proyecto no tiene calendario configurado',1;
        MERGE ExcepcionCalendario AS dst
        USING (SELECT @calendario_id calendario_id,@f fecha) src
          ON dst.calendario_id=src.calendario_id AND dst.fecha=src.fecha
        WHEN MATCHED THEN UPDATE SET tipo=@t,hs_disponibles=@h,motivo=@m,recuperable=@r
        WHEN NOT MATCHED THEN INSERT(calendario_id,fecha,tipo,hs_disponibles,motivo,recuperable)
          VALUES(@calendario_id,@f,@t,@h,@m,@r);
      `);
    res.status(201).json({ message: 'Excepción guardada; la programación fue recalculada' });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo guardar la excepción', error: error.message });
  }
};

const eliminarExcepcionCalendario = async (req, res) => {
  const proyectoId = Number(req.params.id);
  const excepcionId = Number(req.params.excepcionId);
  if (!Number.isInteger(proyectoId) || !Number.isInteger(excepcionId))
    return res.status(400).json({ message: 'Proyecto o excepción inválidos' });
  try {
    const pool = await conectarDB();
    const resultado = await pool.request().input('p', sql.BigInt, proyectoId)
      .input('e', sql.BigInt, excepcionId).query(`
        DELETE ex
        FROM ExcepcionCalendario ex
        JOIN CalendarioProyecto cp ON cp.calendario_id=ex.calendario_id
        WHERE ex.excepcion_id=@e AND cp.proyecto_id=@p;
        SELECT @@ROWCOUNT eliminadas;
      `);
    if (!Number(resultado.recordset[0]?.eliminadas))
      return res.status(404).json({ message: 'La excepción no pertenece al calendario del proyecto' });
    res.json({ message: 'Excepción eliminada; la programación fue recalculada' });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo eliminar la excepción', error: error.message });
  }
};

const guardarEtapa = async (req, res, editar) => {
  const proyectoId = Number(req.params.id || req.body.proyecto_id);
  const etapaId = Number(req.params.etapaId || 0);
  const codigo = String(req.body.codigo || '').trim().toUpperCase();
  const nombre = String(req.body.nombre || '').trim();
  const orden = Number(req.body.orden);
  const peso = Number(req.body.peso_pct);
  if (!Number.isInteger(proyectoId) || (editar && !Number.isInteger(etapaId)) || !nombre ||
      (!editar && !codigo) || !Number.isInteger(orden) || orden <= 0 ||
      !Number.isFinite(peso) || peso < 0 || peso > 100)
    return res.status(400).json({ message: 'Código, nombre, orden y peso entre 0% y 100% son obligatorios' });
  let tx;
  try {
    const pool = await conectarDB();
    tx = new sql.Transaction(pool);
    await tx.begin();
    const rq = () => new sql.Request(tx);
    const contexto = await rq().input('p', sql.BigInt, proyectoId).input('e', sql.BigInt, etapaId).query(`
      SELECT TOP 1 version_id FROM VersionPlan WHERE proyecto_id=@p AND es_activa=1;
      SELECT etapa_id,codigo,nombre,orden,peso_pct FROM EtapaOperacion
      WHERE etapa_id=@e AND proyecto_id=@p
        AND version_id=(SELECT TOP 1 version_id FROM VersionPlan WHERE proyecto_id=@p AND es_activa=1);
      SELECT ISNULL(SUM(peso_pct),0) peso_otras FROM EtapaOperacion
      WHERE proyecto_id=@p AND version_id=(SELECT TOP 1 version_id FROM VersionPlan WHERE proyecto_id=@p AND es_activa=1)
        AND (@e=0 OR etapa_id<>@e);
    `);
    if (!contexto.recordsets[0].length) { await tx.rollback(); return res.status(409).json({ message: 'El proyecto no tiene una versión activa' }); }
    if (editar && !contexto.recordsets[1].length) { await tx.rollback(); return res.status(404).json({ message: 'Etapa no encontrada' }); }
    const versionId = Number(contexto.recordsets[0][0].version_id);
    const pesoOtras = Number(contexto.recordsets[2][0].peso_otras || 0);
    if (pesoOtras + peso > 100.01) {
      await tx.rollback();
      return res.status(422).json({ message: `El peso total de las etapas no puede superar el 100%. Disponible: ${(100 - pesoOtras).toFixed(2)}%` });
    }
    const duplicada = await rq().input('p', sql.BigInt, proyectoId).input('v', sql.BigInt, versionId)
      .input('e', sql.BigInt, etapaId).input('c', sql.NVarChar(20), codigo).input('o', sql.SmallInt, orden)
      .query(`SELECT etapa_id,codigo,orden FROM EtapaOperacion
              WHERE proyecto_id=@p AND version_id=@v AND etapa_id<>@e
                AND (orden=@o OR (${editar ? '1=0' : 'codigo=@c'}))`);
    if (duplicada.recordset.length) {
      await tx.rollback();
      const conflicto = duplicada.recordset[0];
      return res.status(409).json({ message: Number(conflicto.orden) === orden ? `Ya existe una etapa con orden ${orden}` : `Ya existe la etapa ${codigo}` });
    }
    let resultado;
    if (editar) {
      await rq().input('e', sql.BigInt, etapaId).input('n', sql.NVarChar(200), nombre)
        .input('o', sql.SmallInt, orden).input('pe', sql.Decimal(5,2), peso)
        .query(`UPDATE EtapaOperacion SET nombre=@n,orden=@o,peso_pct=@pe,fecha_actualizacion=SYSDATETIME()
                WHERE etapa_id=@e`);
      resultado = await rq().input('e', sql.BigInt, etapaId)
        .query('SELECT * FROM EtapaOperacion WHERE etapa_id=@e');
    } else {
      const estado = await rq().query("SELECT TOP 1 estado_id FROM estado_etapa WHERE codigo='PENDIENTE'");
      if (!estado.recordset.length) { await tx.rollback(); return res.status(500).json({ message: 'Falta el estado PENDIENTE de etapas' }); }
      resultado = await rq().input('p', sql.BigInt, proyectoId).input('v', sql.BigInt, versionId)
        .input('es', sql.BigInt, estado.recordset[0].estado_id).input('c', sql.NVarChar(20), codigo)
        .input('n', sql.NVarChar(200), nombre).input('o', sql.SmallInt, orden).input('pe', sql.Decimal(5,2), peso)
        .query(`INSERT INTO EtapaOperacion(proyecto_id,version_id,estado_id,codigo,nombre,orden,peso_pct)
                VALUES(@p,@v,@es,@c,@n,@o,@pe);
                DECLARE @nueva_id bigint=SCOPE_IDENTITY();
                SELECT * FROM EtapaOperacion WHERE etapa_id=@nueva_id;`);
    }
    await tx.commit();
    res.status(editar ? 200 : 201).json({ message: `Etapa ${editar ? 'actualizada' : 'agregada'} correctamente`, etapa: resultado.recordset[0] });
  } catch (error) {
    if (tx?._aborted === false) try { await tx.rollback(); } catch {}
    res.status(500).json({ message: `No se pudo ${editar ? 'actualizar' : 'agregar'} la etapa`, error: error.message });
  }
};
const crearEtapa = (req, res) => guardarEtapa(req, res, false);
const actualizarEtapa = (req, res) => guardarEtapa(req, res, true);

module.exports = {
  getProgramacion, actualizarDuracion, actualizarNmt, actualizarOperacion,
  crearOperacion, guardarExcepcionCalendario, eliminarExcepcionCalendario,
  crearEtapa, actualizarEtapa
};
