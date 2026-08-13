require('dotenv').config({ path: '.env', quiet: true });
const { conectarDB } = require('../DB/dbConection');

async function verificar() {
  const pool = await conectarDB();
  try {
    const r = await pool.request().query(`
      SELECT
        COUNT_BIG(*) AS materiales,
        SUM(CASE WHEN uom_id IS NULL THEN 1 ELSE 0 END) AS materiales_sin_uom
      FROM Materiales;

      SELECT
        COUNT_BIG(*) AS lineas_bom,
        SUM(CASE WHEN material_id IS NULL THEN 1 ELSE 0 END) AS lineas_sin_material,
        COUNT_BIG(DISTINCT CASE WHEN material_id IS NOT NULL THEN material_id END) AS materiales_bom
      FROM BomOperacion;

      SELECT TOP 10 b.proyecto_id,b.material_id,m.nombre,u.nombre AS uom_nombre,COUNT_BIG(*) AS operaciones
      FROM BomOperacion b
      JOIN Operacion o ON o.operacion_id=b.operacion_id AND ISNULL(o.archivada,0)=0
      JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
      JOIN Materiales m ON m.id_material=b.material_id
      JOIN UoM u ON u.uom_id=m.uom_id
      GROUP BY b.proyecto_id,b.material_id,m.nombre,u.nombre
      ORDER BY b.proyecto_id,m.nombre;

      SELECT estado_liberacion,COUNT_BIG(*) AS remitos
      FROM vw_EstadoLiberacionRemito
      GROUP BY estado_liberacion
      ORDER BY estado_liberacion;

      SELECT COUNT_BIG(*) AS detalles_pendientes
      FROM vw_SaldoLiberacionRemitoDetalle
      WHERE cantidad_pendiente>0;

      SELECT COUNT_BIG(*) AS liberaciones,
             COUNT_BIG(DISTINCT CONCAT(proyecto_id,':',material_id)) AS materiales_por_proyecto
      FROM LiberacionRemitoDetalle
      WHERE activo=1;

      DBCC CHECKCONSTRAINTS ('dbo.LiberacionRemitoDetalle') WITH ALL_CONSTRAINTS;
    `);
    console.log(JSON.stringify({
      maestro: r.recordsets[0][0],
      bom: r.recordsets[1][0],
      muestraMaterialesBom: r.recordsets[2],
      remitos: r.recordsets[3],
      pendientes: r.recordsets[4][0],
      historialLiberaciones: r.recordsets[5][0],
      violaciones: r.recordsets[6] || []
    }, null, 2));
  } finally { await pool.close(); }
}

verificar().catch(error => { console.error(error); process.exitCode = 1; });
