const { conectarDB, sql } = require('../DB/dbConection');

const headersRequeridos = ['etapa', 'secuencia_op', 'nro_linea', 'descripcion_libre', 'cantidad_teorica', 'unidad'];
const aliases = { UNID: 'UN', UNIDAD: 'UN', BOLSAS: 'BOLSA', LT: 'L', LITRO: 'L', LITROS: 'L' };
const normalizarClave = value => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();

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

async function obtenerOCrearMaterialBom(transaction, descripcion, uomId) {
  const existente = await new sql.Request(transaction)
    .input('descripcion', sql.NVarChar(200), descripcion)
    .query(`
      SELECT TOP 1 id_material,uom_id,nombre
      FROM Materiales WITH (UPDLOCK,HOLDLOCK)
      WHERE nombre_normalizado=dbo.fn_NormalizarClave(@descripcion)
    `);
  if (existente.recordset.length) {
    const material = existente.recordset[0];
    if (Number(material.uom_id) !== Number(uomId)) {
      throw new Error(`El material "${material.nombre}" ya existe con otra unidad de medida`);
    }
    return { id: material.id_material, creado: false };
  }
  const insertado = await new sql.Request(transaction)
    .input('nombre', sql.NVarChar(200), descripcion.trim().replace(/\s+/g, ' '))
    .input('descripcion', sql.NVarChar(500), descripcion.trim().replace(/\s+/g, ' '))
    .input('uom_id', sql.BigInt, uomId)
    .query(`
      INSERT INTO Materiales(nombre,descripcion,uom_id)
      OUTPUT INSERTED.id_material
      VALUES(@nombre,@descripcion,@uom_id)
    `);
  return { id: insertado.recordset[0].id_material, creado: true };
}

const crearHttpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const numeroEnteroPositivo = value => Number.isInteger(Number(value)) && Number(value) > 0;

async function prepararLineaManual(transaction, proyectoId, body, bomId = null) {
  const operacionId = Number(body.operacion_id);
  const numeroLinea = Number(body.numero_linea ?? body.nro_linea);
  const cantidad = Number(body.cantidad_teorica);
  const uomId = Number(body.uom_id);
  const descripcion = String(body.descripcion_libre || '').trim().replace(/\s+/g, ' ');
  const materialIdSolicitado = Number(body.material_id || 0);

  if (!numeroEnteroPositivo(operacionId)) throw crearHttpError('La operacion es obligatoria', 400);
  if (!numeroEnteroPositivo(numeroLinea)) throw crearHttpError('El numero de linea debe ser un entero mayor a cero', 400);
  if (!descripcion) throw crearHttpError('La descripcion del material es obligatoria', 400);
  if (!(cantidad > 0)) throw crearHttpError('La cantidad teorica debe ser mayor a cero', 400);
  if (!numeroEnteroPositivo(uomId)) throw crearHttpError('La unidad de medida es obligatoria', 400);

  const contexto = await new sql.Request(transaction)
    .input('proyecto', sql.BigInt, proyectoId)
    .input('operacion', sql.BigInt, operacionId)
    .input('uom', sql.BigInt, uomId)
    .query(`
      SELECT o.operacion_id
      FROM Operacion o
      JOIN VersionPlan v ON v.version_id=o.version_id AND v.es_activa=1
      WHERE o.operacion_id=@operacion AND o.proyecto_id=@proyecto AND ISNULL(o.archivada,0)=0;
      SELECT uom_id,nombre FROM UoM WHERE uom_id=@uom;
    `);
  if (!contexto.recordsets[0].length) throw crearHttpError('La operacion no pertenece al plan activo del proyecto', 400);
  if (!contexto.recordsets[1].length) throw crearHttpError('La unidad de medida no existe', 400);

  const duplicada = await new sql.Request(transaction)
    .input('proyecto', sql.BigInt, proyectoId)
    .input('operacion', sql.BigInt, operacionId)
    .input('linea', sql.SmallInt, numeroLinea)
    .input('bom', sql.BigInt, bomId)
    .query(`
      SELECT bom_id FROM BomOperacion WITH (UPDLOCK,HOLDLOCK)
      WHERE proyecto_id=@proyecto AND operacion_id=@operacion AND numero_linea=@linea
        AND (@bom IS NULL OR bom_id<>@bom)
    `);
  if (duplicada.recordset.length) throw crearHttpError(`La linea ${numeroLinea} ya existe para la operacion seleccionada`, 409);

  let material;
  if (numeroEnteroPositivo(materialIdSolicitado)) {
    const existente = await new sql.Request(transaction).input('material', sql.BigInt, materialIdSolicitado)
      .query('SELECT id_material,nombre,uom_id FROM Materiales WHERE id_material=@material');
    if (!existente.recordset.length) throw crearHttpError('El material seleccionado no existe', 400);
    if (Number(existente.recordset[0].uom_id) !== uomId)
      throw crearHttpError('La unidad de medida no coincide con el material seleccionado', 409);
    material = { id: existente.recordset[0].id_material, creado: false };
  } else {
    material = await obtenerOCrearMaterialBom(transaction, descripcion, uomId);
  }
  return { operacionId, numeroLinea, cantidad, uomId, descripcion, materialId: Number(material.id) };
}

const listar = async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool.request().input('proyecto', sql.BigInt, req.params.id).query(`
      SELECT b.bom_id,b.material_id,b.numero_linea,COALESCE(m.nombre,b.descripcion_libre) descripcion_libre,b.cantidad_teorica,u.uom_id,u.nombre unidad,
             (SELECT COUNT(*) FROM ConsumoMaterialOperacion c WHERE c.bom_id=b.bom_id) consumos_registrados,
             o.operacion_id,o.secuencia,o.nombre operacion_nombre,e.codigo etapa_codigo
      FROM BomOperacion b
      JOIN Operacion o ON o.operacion_id=b.operacion_id
      JOIN VersionPlan v ON v.version_id=o.version_id AND v.es_activa=1
      JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id
      JOIN UoM u ON u.uom_id=b.uom_id
      LEFT JOIN Materiales m ON m.id_material=b.material_id
      WHERE b.proyecto_id=@proyecto AND ISNULL(o.archivada,0)=0
      ORDER BY o.secuencia,b.numero_linea`);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar el BOM', error: error.message });
  }
};

const contextoEdicion = async (req, res) => {
  try {
    const pool = await conectarDB();
    const contexto = await contextoProyecto(pool, req.params.id);
    if (!contexto.recordsets[0].length) return res.status(404).json({ message: 'Proyecto no encontrado' });
    res.json({
      proyecto: contexto.recordsets[0][0],
      operaciones: contexto.recordsets[1],
      unidades: contexto.recordsets[2],
      materiales: (await pool.request().query(`
        SELECT id_material,nombre,descripcion,uom_id
        FROM Materiales
        ORDER BY nombre
      `)).recordset
    });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar el contexto del BOM', error: error.message });
  }
};

const crearLinea = async (req, res) => {
  let tx;
  try {
    const pool = await conectarDB();
    tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const linea = await prepararLineaManual(tx, req.params.id, req.body);
    const insertada = await new sql.Request(tx)
      .input('operacion', sql.BigInt, linea.operacionId)
      .input('proyecto', sql.BigInt, req.params.id)
      .input('uom', sql.BigInt, linea.uomId)
      .input('linea', sql.SmallInt, linea.numeroLinea)
      .input('material', sql.BigInt, linea.materialId)
      .input('descripcion', sql.NVarChar(200), linea.descripcion)
      .input('cantidad', sql.Decimal(12, 3), linea.cantidad)
      .query(`
        INSERT INTO BomOperacion(operacion_id,proyecto_id,uom_id,numero_linea,material_id,descripcion_libre,cantidad_teorica,sin_codigo)
        OUTPUT INSERTED.bom_id
        VALUES(@operacion,@proyecto,@uom,@linea,@material,@descripcion,@cantidad,0)
      `);
    await tx.commit();
    res.status(201).json({ message: 'Material agregado al BOM', bom_id: insertada.recordset[0].bom_id });
  } catch (error) {
    if (tx) try { await tx.rollback(); } catch {}
    res.status(error.statusCode || 500).json({ message: error.message || 'No se pudo agregar el material al BOM' });
  }
};

const actualizarLinea = async (req, res) => {
  const bomId = Number(req.params.bomId);
  if (!numeroEnteroPositivo(bomId)) return res.status(400).json({ message: 'Linea BOM invalida' });
  let tx;
  try {
    const pool = await conectarDB();
    tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const actual = await new sql.Request(tx)
      .input('bom', sql.BigInt, bomId)
      .input('proyecto', sql.BigInt, req.params.id)
      .query(`
        SELECT b.bom_id,b.operacion_id,b.material_id,b.uom_id,
               (SELECT COUNT(*) FROM ConsumoMaterialOperacion c WHERE c.bom_id=b.bom_id) consumos
        FROM BomOperacion b WITH (UPDLOCK,HOLDLOCK)
        WHERE b.bom_id=@bom AND b.proyecto_id=@proyecto
      `);
    if (!actual.recordset.length) throw crearHttpError('Linea BOM no encontrada', 404);

    const linea = await prepararLineaManual(tx, req.params.id, req.body, bomId);
    const anterior = actual.recordset[0];
    if (Number(anterior.consumos) > 0 && (
      Number(anterior.operacion_id) !== linea.operacionId ||
      Number(anterior.material_id) !== linea.materialId ||
      Number(anterior.uom_id) !== linea.uomId
    )) throw crearHttpError('La linea tiene consumos registrados; solo se puede modificar su cantidad teorica o numero de linea dentro de la misma operacion', 409);

    await new sql.Request(tx)
      .input('bom', sql.BigInt, bomId)
      .input('operacion', sql.BigInt, linea.operacionId)
      .input('uom', sql.BigInt, linea.uomId)
      .input('linea', sql.SmallInt, linea.numeroLinea)
      .input('material', sql.BigInt, linea.materialId)
      .input('descripcion', sql.NVarChar(200), linea.descripcion)
      .input('cantidad', sql.Decimal(12, 3), linea.cantidad)
      .query(`
        UPDATE BomOperacion SET operacion_id=@operacion,uom_id=@uom,numero_linea=@linea,
          material_id=@material,descripcion_libre=@descripcion,cantidad_teorica=@cantidad,
          sin_codigo=0,fecha_actualizacion=SYSDATETIME()
        WHERE bom_id=@bom
      `);
    await tx.commit();
    res.json({ message: 'Linea BOM actualizada correctamente' });
  } catch (error) {
    if (tx) try { await tx.rollback(); } catch {}
    res.status(error.statusCode || 500).json({ message: error.message || 'No se pudo actualizar la linea BOM' });
  }
};

const eliminarLinea = async (req, res) => {
  const bomId = Number(req.params.bomId);
  if (!numeroEnteroPositivo(bomId)) return res.status(400).json({ message: 'Linea BOM invalida' });
  let tx;
  try {
    const pool = await conectarDB();
    tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const linea = await new sql.Request(tx)
      .input('bom', sql.BigInt, bomId)
      .input('proyecto', sql.BigInt, req.params.id)
      .query(`
        SELECT b.bom_id,(SELECT COUNT(*) FROM ConsumoMaterialOperacion c WHERE c.bom_id=b.bom_id) consumos
        FROM BomOperacion b WITH (UPDLOCK,HOLDLOCK)
        WHERE b.bom_id=@bom AND b.proyecto_id=@proyecto
      `);
    if (!linea.recordset.length) throw crearHttpError('Linea BOM no encontrada', 404);
    if (Number(linea.recordset[0].consumos) > 0) throw crearHttpError('No se puede eliminar una linea BOM con consumos registrados', 409);
    await new sql.Request(tx).input('bom', sql.BigInt, bomId).query('DELETE FROM BomOperacion WHERE bom_id=@bom');
    await tx.commit();
    res.json({ message: 'Linea BOM eliminada correctamente' });
  } catch (error) {
    if (tx) try { await tx.rollback(); } catch {}
    res.status(error.statusCode || 500).json({ message: error.message || 'No se pudo eliminar la linea BOM' });
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
    const catalogo = await pool.request().query('SELECT id_material,nombre,uom_id FROM Materiales');
    const porNombre = new Map(catalogo.recordset.map(m => [normalizarClave(m.nombre), m]));
    resultado.datos = resultado.datos.map(fila => {
      const existente = porNombre.get(normalizarClave(fila.descripcion_libre));
      const uom = contexto.recordsets[2].find(u => normalizarClave(u.nombre) === normalizarClave(fila.unidad));
      return {
        ...fila,
        material_id: existente?.id_material || null,
        material_nuevo: !existente,
        conflicto_uom: !!existente && Number(existente.uom_id) !== Number(uom?.uom_id)
      };
    });
    for (const fila of resultado.datos.filter(f => f.conflicto_uom)) {
      resultado.errores.push({ fila: fila.fila, columna: 'unidad', mensaje: `El material ${fila.descripcion_libre} ya existe con otra unidad de medida` });
    }
    for (const fila of resultado.datos.filter(f => f.material_nuevo)) {
      resultado.advertencias.push({ fila: fila.fila, columna: 'descripcion_libre', mensaje: `Se crearÃ¡ el material ${fila.descripcion_libre} en el maestro global` });
    }
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
      const material = await obtenerOCrearMaterialBom(tx, fila.descripcion_libre, uomId);
      const materialId = material.id;
      const existe = await new sql.Request(tx).input('operacion', sql.BigInt, fila.operacion_id)
        .input('linea', sql.SmallInt, fila.nro_linea)
        .query('SELECT bom_id FROM BomOperacion WHERE operacion_id=@operacion AND numero_linea=@linea');
      const request = new sql.Request(tx).input('operacion', sql.BigInt, fila.operacion_id)
        .input('proyecto', sql.BigInt, req.params.id).input('uom', sql.BigInt, uomId)
        .input('linea', sql.SmallInt, fila.nro_linea).input('descripcion', sql.NVarChar(200), fila.descripcion_libre)
        .input('cantidad', sql.Decimal(12, 3), fila.cantidad_teorica)
        .input('material_id', sql.BigInt, materialId)
        .input('sin_codigo', sql.Bit, 0);
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

module.exports = { listar, contextoEdicion, crearLinea, actualizarLinea, eliminarLinea, previsualizar, importar };
