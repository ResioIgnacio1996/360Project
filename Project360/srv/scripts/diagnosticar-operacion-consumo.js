require('dotenv').config({ path: '.env', quiet: true });
const { conectarDB, sql } = require('../DB/dbConection');

async function ejecutar() {
  const operacionId = Number(process.argv[2]);
  if (!Number.isInteger(operacionId) || operacionId <= 0) throw new Error('Informar operacion_id');
  const pool = await conectarDB();
  try {
    const r = await pool.request().input('operacion', sql.BigInt, operacionId).query(`
      SELECT operacion_id,proyecto_id,nombre,fecha_inicio_real,fecha_fin_real,pct_avance_actual
      FROM Operacion WHERE operacion_id=@operacion;

      SELECT b.bom_id,b.material_id,b.descripcion_libre,b.uom_id,u.nombre AS uom,
             b.cantidad_teorica,m.nombre AS material
      FROM BomOperacion b
      LEFT JOIN Materiales m ON m.id_material=b.material_id
      LEFT JOIN UoM u ON u.uom_id=b.uom_id
      WHERE b.operacion_id=@operacion ORDER BY b.numero_linea;

      SELECT b.bom_id,b.material_id,m.nombre AS material,c.container_id,c.cantidad_actual,
             c.activo,cs.conteiner_id,cs.fecha_valorizacion
      FROM BomOperacion b
      LEFT JOIN Materiales m ON m.id_material=b.material_id
      LEFT JOIN StockGeneral sg ON sg.id_material=b.material_id
      LEFT JOIN Container c ON c.stock_general_id=sg.stock_general_id AND c.id_proyecto=b.proyecto_id
      LEFT JOIN CostoStock cs ON cs.conteiner_id=c.container_id AND cs.activo=1
      WHERE b.operacion_id=@operacion ORDER BY b.bom_id,c.container_id;

      SELECT COLUMN_NAME,DATA_TYPE,IS_NULLABLE,COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='ConsumoMaterialOperacion'
      ORDER BY ORDINAL_POSITION;

      DBCC CHECKCONSTRAINTS ('dbo.ConsumoMaterialOperacion') WITH ALL_CONSTRAINTS;

      SELECT c.name,c.is_identity,c.is_computed
      FROM sys.columns c
      WHERE c.object_id=OBJECT_ID('dbo.ConsumoMaterialOperacion');

      SELECT fk.name AS foreign_key,OBJECT_NAME(fkc.referenced_object_id) AS tabla_referenciada,
             COL_NAME(fkc.parent_object_id,fkc.parent_column_id) AS columna,
             COL_NAME(fkc.referenced_object_id,fkc.referenced_column_id) AS columna_referenciada,
             fk.is_disabled,fk.is_not_trusted
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id=fk.object_id
      WHERE fk.parent_object_id=OBJECT_ID('dbo.ConsumoMaterialOperacion');

      SELECT name,is_disabled FROM sys.triggers
      WHERE parent_id=OBJECT_ID('dbo.ConsumoMaterialOperacion');

      SELECT name,definition FROM sys.check_constraints
      WHERE parent_object_id=OBJECT_ID('dbo.ConsumoMaterialOperacion');
    `);
    console.log(JSON.stringify({
      operacion: r.recordsets[0], bom: r.recordsets[1], stock: r.recordsets[2],
      columnasConsumo: r.recordsets[3], violaciones: r.recordsets[4] || [],
      metadata: r.recordsets[5], foreignKeys: r.recordsets[6], triggers: r.recordsets[7],
      checks: r.recordsets[r.recordsets.length - 1] || []
    }, null, 2));
  } finally { await pool.close(); }
}

ejecutar().catch(error => { console.error(error.message); process.exitCode = 1; });
