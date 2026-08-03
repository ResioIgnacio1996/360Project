const { conectarDB, sql } = require('../DB/dbConection');

const headersRequeridos = ['etapa', 'secuencia_op', 'nro_linea', 'descripcion_libre', 'cantidad_teorica', 'unidad'];
const aliases = { UNID: 'UN', UNIDAD: 'UN', BOLSAS: 'BOLSA', LT: 'L', LITRO: 'L', LITROS: 'L' };

function parseCsv(buffer) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); if (row.some(value => value.trim())) rows.push(row); }
  if (!rows.length) return { headers: [], data: [] };
  const headers = rows[0].map(value => value.trim().toLowerCase());
  return {
    headers,
    data: rows.slice(1).map((values, index) => ({
      ...Object.fromEntries(headers.map((header, column) => [header, (values[column] || '').trim()])),
      fila: index + 2
    }))
  };
}

async function contextoProyecto(pool, proyectoId) {
  return pool.request().input('proyecto', sql.BigInt, proyectoId).query(`
    SELECT p.proyecto_id,p.nombre,v.version_id,v.codigo version_codigo
    FROM Proyecto p
    LEFT JOIN VersionPlan v ON v.proyecto_id=p.proyecto_id AND v.es_activa=1
    WHERE p.proyecto_id=@proyecto;
    SELECT o.operacion_id,o.secuencia,e.codigo etapa_codigo,o.nombre operacion_nombre
    FROM Operacion o
    JOIN VersionPlan v ON v.version_id=o.version_id AND v.es_activa=1
    JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id
    WHERE o.proyecto_id=@proyecto AND ISNULL(o.archivada,0)=0;
    SELECT uom_id,nombre FROM UoM;
  `);
}

function validar(parsed, operaciones, unidades) {
  const errores = [], advertencias = [];
  const error = (fila, columna, mensaje) => errores.push({ fila, columna, mensaje });
  for (const header of headersRequeridos)
    if (!parsed.headers.includes(header)) error(1, header, `Falta la columna obligatoria "${header}"`);
  const opMap = new Map(operaciones.map(op => [`${String(op.etapa_codigo).toUpperCase()}|${Number(op.secuencia)}`, op]));
  const uomSet = new Set(unidades.map(u => String(u.nombre).toUpperCase()));
  const claves = new Set();
  const datos = parsed.data.map(row => {
    const etapa = String(row.etapa || '').toUpperCase();
    const secuencia = Number(row.secuencia_op);
    const linea = Number(row.nro_linea);
    const cantidad = Number(row.cantidad_teorica);
    const unidad = aliases[String(row.unidad || '').toUpperCase()] || String(row.unidad || '').toUpperCase();
    const op = opMap.get(`${etapa}|${secuencia}`);
    if (!op) error(row.fila, 'secuencia_op', `No existe la operación ${etapa}/${row.secuencia_op} en el plan activo`);
    if (!Number.isInteger(linea) || linea <= 0) error(row.fila, 'nro_linea', 'Debe ser un entero mayor a cero');
    if (!String(row.descripcion_libre || '').trim()) error(row.fila, 'descripcion_libre', 'La descripción es obligatoria');
    if (!(cantidad > 0)) error(row.fila, 'cantidad_teorica', 'Debe ser mayor a cero');
    if (!uomSet.has(unidad)) error(row.fila, 'unidad', `La unidad ${row.unidad} no existe en UoM`);
    const clave = `${op?.operacion_id || 'X'}|${linea}`;
    if (claves.has(clave)) error(row.fila, 'nro_linea', `La línea ${linea} está duplicada para la operación`);
    claves.add(clave);
    return {
      etapa, secuencia_op: secuencia, operacion_id: op?.operacion_id || null,
      operacion_nombre: op?.operacion_nombre || null, nro_linea: linea,
      descripcion_libre: String(row.descripcion_libre || '').trim(),
      cantidad_teorica: cantidad, unidad, fila: row.fila
    };
  });
  if (!datos.length) advertencias.push({ fila: null, columna: null, mensaje: 'El archivo no contiene líneas BOM' });
  return { datos, errores, advertencias };
}

const listar = async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool.request().input('proyecto', sql.BigInt, req.params.id).query(`
      SELECT b.bom_id,b.numero_linea,b.descripcion_libre,b.cantidad_teorica,u.nombre unidad,
             o.operacion_id,o.secuencia,o.nombre operacion_nombre,e.codigo etapa_codigo
      FROM BomOperacion b
      JOIN Operacion o ON o.operacion_id=b.operacion_id
      JOIN VersionPlan v ON v.version_id=o.version_id AND v.es_activa=1
      JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id
      JOIN UoM u ON u.uom_id=b.uom_id
      WHERE b.proyecto_id=@proyecto AND ISNULL(o.archivada,0)=0
      ORDER BY o.secuencia,b.numero_linea`);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar el BOM', error: error.message });
  }
};

const previsualizar = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Seleccioná un archivo CSV' });
  try {
    const pool = await conectarDB();
    const contexto = await contextoProyecto(pool, req.params.id);
    if (!contexto.recordsets[0].length) return res.status(404).json({ message: 'Proyecto no encontrado' });
    if (!contexto.recordsets[0][0].version_id) return res.status(409).json({ message: 'El proyecto no tiene una programación activa' });
    const resultado = validar(parseCsv(req.file.buffer), contexto.recordsets[1], contexto.recordsets[2]);
    res.json({ proyecto: contexto.recordsets[0][0], ...resultado });
  } catch (error) {
    res.status(400).json({ message: 'No se pudo interpretar el CSV', error: error.message });
  }
};

const importar = async (req, res) => {
  const filas = Array.isArray(req.body.filas) ? req.body.filas : [];
  if (!filas.length) return res.status(400).json({ message: 'No hay líneas BOM para importar' });
  const pool = await conectarDB();
  const tx = new sql.Transaction(pool);
  try {
    const contexto = await contextoProyecto(pool, req.params.id);
    if (!contexto.recordsets[0].length) return res.status(404).json({ message: 'Proyecto no encontrado' });
    const parsed = { headers: headersRequeridos, data: filas.map((fila, index) => ({ ...fila, fila: index + 2 })) };
    const validacion = validar(parsed, contexto.recordsets[1], contexto.recordsets[2]);
    if (validacion.errores.length) return res.status(422).json({ message: 'Hay errores de validación', ...validacion });
    const unidades = new Map(contexto.recordsets[2].map(u => [String(u.nombre).toUpperCase(), u.uom_id]));
    await tx.begin();
    let insertadas = 0, actualizadas = 0;
    for (const fila of validacion.datos) {
      const uomId = unidades.get(fila.unidad);
      const material = await new sql.Request(tx)
        .input('descripcion', sql.NVarChar(200), fila.descripcion_libre)
        .input('uom_id', sql.BigInt, uomId)
        .query(`
          SELECT TOP 1 id_material
          FROM Materiales
          WHERE uom_id=@uom_id
            AND UPPER(LTRIM(RTRIM(nombre))) COLLATE Latin1_General_CI_AI
              = UPPER(LTRIM(RTRIM(@descripcion))) COLLATE Latin1_General_CI_AI
          ORDER BY id_material
        `);
      const materialId = material.recordset[0]?.id_material || null;
      const existe = await new sql.Request(tx).input('operacion', sql.BigInt, fila.operacion_id)
        .input('linea', sql.SmallInt, fila.nro_linea)
        .query('SELECT bom_id FROM BomOperacion WHERE operacion_id=@operacion AND numero_linea=@linea');
      const request = new sql.Request(tx).input('operacion', sql.BigInt, fila.operacion_id)
        .input('proyecto', sql.BigInt, req.params.id).input('uom', sql.BigInt, uomId)
        .input('linea', sql.SmallInt, fila.nro_linea).input('descripcion', sql.NVarChar(200), fila.descripcion_libre)
        .input('cantidad', sql.Decimal(12, 3), fila.cantidad_teorica)
        .input('material_id', sql.BigInt, materialId)
        .input('sin_codigo', sql.Bit, materialId ? 0 : 1);
      if (existe.recordset.length) {
        await request.query(`UPDATE BomOperacion SET uom_id=@uom,descripcion_libre=@descripcion,
          cantidad_teorica=@cantidad,material_id=@material_id,sin_codigo=@sin_codigo,
          fecha_actualizacion=SYSDATETIME()
          WHERE operacion_id=@operacion AND numero_linea=@linea`);
        actualizadas++;
      } else {
        await request.query(`INSERT INTO BomOperacion(operacion_id,proyecto_id,uom_id,numero_linea,
          material_id,descripcion_libre,cantidad_teorica,sin_codigo)
          VALUES(@operacion,@proyecto,@uom,@linea,@material_id,@descripcion,@cantidad,@sin_codigo)`);
        insertadas++;
      }
    }
    await tx.commit();
    res.status(201).json({ message: 'BOM importado correctamente', resumen: { insertadas, actualizadas, total: filas.length } });
  } catch (error) {
    if (tx._aborted === false) try { await tx.rollback(); } catch {}
    res.status(500).json({ message: 'No se pudo importar el BOM', error: error.message });
  }
};

module.exports = { listar, previsualizar, importar };
