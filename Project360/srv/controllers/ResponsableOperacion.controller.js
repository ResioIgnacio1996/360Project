const { conectarDB, sql } = require('../DB/dbConection');

const TIPOS_VALIDOS = ['CUADRILLA_PROPIA', 'SUBCONTRATISTA', 'RESPONSABLE'];

const normalizar = (body) => ({
  codigo: String(body.codigo || '').trim().toUpperCase(),
  nombre: String(body.nombre || '').trim(),
  tipo: String(body.tipo || '').trim().toUpperCase(),
  activo: body.activo !== false
});

const validar = (responsable) => {
  if (!responsable.codigo || responsable.codigo.length > 20) return 'El código es obligatorio y admite hasta 20 caracteres';
  if (!responsable.nombre || responsable.nombre.length > 200) return 'El nombre es obligatorio y admite hasta 200 caracteres';
  if (!TIPOS_VALIDOS.includes(responsable.tipo)) return 'El tipo de responsable no es válido';
  return null;
};

const getResponsables = async (_req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool.request().query(`
      SELECT r.responsable_id,r.codigo,r.nombre,r.tipo,r.activo,r.fecha_creacion,
             COUNT(o.operacion_id) operaciones_asignadas,
             COUNT(DISTINCT o.proyecto_id) proyectos_asignados,
             CAST(ISNULL(AVG(CAST(o.pct_avance_actual AS decimal(10,2))),0) AS decimal(7,2)) avance_promedio,
             SUM(CASE WHEN o.operacion_id IS NOT NULL AND ISNULL(o.pct_avance_actual,0)<100
                           AND o.fecha_fin_estimada<CAST(GETDATE() AS date) THEN 1 ELSE 0 END) operaciones_atrasadas,
             SUM(CASE WHEN o.operacion_id IS NOT NULL AND ISNULL(o.pct_avance_actual,0)<100
                           AND DATEDIFF(day,CAST(GETDATE() AS date),o.fecha_fin_estimada) BETWEEN 0 AND 3 THEN 1 ELSE 0 END) operaciones_en_riesgo
      FROM ResponsableOperacion r
      LEFT JOIN Operacion o ON o.responsable_id=r.responsable_id
        AND ISNULL(o.archivada,0)=0
        AND EXISTS (
          SELECT 1
          FROM Proyecto p
          WHERE p.proyecto_id=o.proyecto_id
            AND p.estado='ACTIVO'
            AND ISNULL(p.eliminado,0)=0
        )
      GROUP BY r.responsable_id,r.codigo,r.nombre,r.tipo,r.activo,r.fecha_creacion
      ORDER BY r.activo DESC,r.nombre
    `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar el maestro de responsables', error: error.message });
  }
};

const getResponsableById = async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool.request().input('id', sql.BigInt, req.params.id).query(`
      SELECT responsable_id,codigo,nombre,tipo,activo,fecha_creacion
      FROM ResponsableOperacion WHERE responsable_id=@id;

      SELECT o.operacion_id,o.secuencia,o.nombre,o.descripcion,o.pct_avance_actual,
             o.fecha_inicio_estimada,o.fecha_fin_estimada,o.fecha_inicio_real,o.fecha_fin_real,
             p.proyecto_id,p.nombre proyecto_nombre,e.nombre etapa_nombre,
             eo.codigo estado_codigo,eo.label_es estado_nombre,
             CASE
               WHEN ISNULL(o.pct_avance_actual,0)>=100 AND o.fecha_fin_real IS NOT NULL
                    AND o.fecha_fin_real<=o.fecha_fin_estimada THEN 'CUMPLIDA_A_TIEMPO'
               WHEN ISNULL(o.pct_avance_actual,0)>=100 AND o.fecha_fin_real IS NOT NULL
                    AND o.fecha_fin_real>o.fecha_fin_estimada THEN 'CUMPLIDA_CON_DEMORA'
               WHEN ISNULL(o.pct_avance_actual,0)>=100 THEN 'CUMPLIDA'
               WHEN o.fecha_fin_estimada<CAST(GETDATE() AS date) THEN 'ATRASADA'
               WHEN DATEDIFF(day,CAST(GETDATE() AS date),o.fecha_fin_estimada) BETWEEN 0 AND 3 THEN 'EN_RIESGO'
               ELSE 'EN_TERMINO'
             END cumplimiento
      FROM Operacion o
      JOIN Proyecto p ON p.proyecto_id=o.proyecto_id
      JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id
      JOIN estado_operacion eo ON eo.estado_id=o.estado_id
      WHERE o.responsable_id=@id
        AND ISNULL(o.archivada,0)=0
        AND p.estado='ACTIVO'
        AND ISNULL(p.eliminado,0)=0
      ORDER BY p.nombre,o.secuencia;
    `);

    if (!result.recordsets[0].length) return res.status(404).json({ message: 'Responsable o cuadrilla no encontrado' });
    const operaciones = result.recordsets[1];
    const atrasadas = operaciones.filter(item => item.cumplimiento === 'ATRASADA' || item.cumplimiento === 'CUMPLIDA_CON_DEMORA').length;
    const enRiesgo = operaciones.filter(item => item.cumplimiento === 'EN_RIESGO').length;
    const completadas = operaciones.filter(item => Number(item.pct_avance_actual) >= 100).length;
    const avancePromedio = operaciones.length
      ? operaciones.reduce((total, item) => total + Number(item.pct_avance_actual || 0), 0) / operaciones.length
      : 0;

    res.json({
      responsable: result.recordsets[0][0],
      resumen: {
        operaciones: operaciones.length,
        completadas,
        atrasadas,
        en_riesgo: enRiesgo,
        avance_promedio: Number(avancePromedio.toFixed(2))
      },
      operaciones,
      no_conformidades: [],
      nc_disponible: false
    });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar el detalle del responsable', error: error.message });
  }
};

const createResponsable = async (req, res) => {
  const responsable = normalizar(req.body);
  const errorValidacion = validar(responsable);
  if (errorValidacion) return res.status(400).json({ message: errorValidacion });
  try {
    const pool = await conectarDB();
    const duplicado = await pool.request().input('codigo', sql.NVarChar(20), responsable.codigo)
      .query('SELECT responsable_id FROM ResponsableOperacion WHERE UPPER(codigo)=@codigo');
    if (duplicado.recordset.length) return res.status(409).json({ message: 'Ya existe un responsable o cuadrilla con ese código' });
    const result = await pool.request()
      .input('codigo', sql.NVarChar(20), responsable.codigo)
      .input('nombre', sql.NVarChar(200), responsable.nombre)
      .input('tipo', sql.NVarChar(30), responsable.tipo)
      .input('activo', sql.Bit, responsable.activo)
      .query(`INSERT INTO ResponsableOperacion(codigo,nombre,tipo,activo,fecha_creacion)
              OUTPUT INSERTED.* VALUES(@codigo,@nombre,@tipo,@activo,SYSDATETIME())`);
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: 'No se pudo crear el responsable o cuadrilla', error: error.message });
  }
};

const updateResponsable = async (req, res) => {
  const responsable = normalizar(req.body);
  const errorValidacion = validar(responsable);
  if (errorValidacion) return res.status(400).json({ message: errorValidacion });
  try {
    const pool = await conectarDB();
    const duplicado = await pool.request()
      .input('id', sql.BigInt, req.params.id).input('codigo', sql.NVarChar(20), responsable.codigo)
      .query('SELECT responsable_id FROM ResponsableOperacion WHERE UPPER(codigo)=@codigo AND responsable_id<>@id');
    if (duplicado.recordset.length) return res.status(409).json({ message: 'Ya existe otro responsable o cuadrilla con ese código' });
    const result = await pool.request()
      .input('id', sql.BigInt, req.params.id)
      .input('codigo', sql.NVarChar(20), responsable.codigo)
      .input('nombre', sql.NVarChar(200), responsable.nombre)
      .input('tipo', sql.NVarChar(30), responsable.tipo)
      .input('activo', sql.Bit, responsable.activo)
      .query(`UPDATE ResponsableOperacion SET codigo=@codigo,nombre=@nombre,tipo=@tipo,activo=@activo
              OUTPUT INSERTED.* WHERE responsable_id=@id`);
    if (!result.recordset.length) return res.status(404).json({ message: 'Responsable o cuadrilla no encontrado' });
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: 'No se pudo modificar el responsable o cuadrilla', error: error.message });
  }
};

const cambiarEstadoResponsable = async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool.request().input('id', sql.BigInt, req.params.id).input('activo', sql.Bit, Boolean(req.body.activo))
      .query('UPDATE ResponsableOperacion SET activo=@activo OUTPUT INSERTED.* WHERE responsable_id=@id');
    if (!result.recordset.length) return res.status(404).json({ message: 'Responsable o cuadrilla no encontrado' });
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cambiar el estado', error: error.message });
  }
};

module.exports = { getResponsables, getResponsableById, createResponsable, updateResponsable, cambiarEstadoResponsable };
