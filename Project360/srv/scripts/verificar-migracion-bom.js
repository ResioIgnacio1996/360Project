require('dotenv').config({ path: '.env', quiet: true });

const { conectarDB } = require('../DB/dbConection');

const verificar = async () => {
  const pool = await conectarDB();
  try {
    const resultado = await pool.request().query(`
      SELECT
        OBJECT_ID('dbo.fn_NormalizarClave') AS funcion,
        OBJECT_ID('dbo.LiberacionRemitoDetalle') AS tabla,
        OBJECT_ID('dbo.TR_LiberacionRemitoDetalle_Validar') AS trigger_obj,
        OBJECT_ID('dbo.vw_SaldoLiberacionRemitoDetalle') AS vista_saldo,
        OBJECT_ID('dbo.vw_EstadoLiberacionRemito') AS vista_estado,
        COL_LENGTH('dbo.Materiales','nombre_normalizado') AS material_normalizado,
        COL_LENGTH('dbo.UoM','nombre_normalizado') AS uom_normalizado,
        COL_LENGTH('dbo.Detalle_Remito','Descripcion') AS descripcion_remito;

      SELECT TABLE_NAME,COLUMN_NAME,IS_NULLABLE,DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE (TABLE_NAME='Detalle_RegistroDeCompra' AND COLUMN_NAME='id_material')
         OR TABLE_NAME='LiberacionRemitoDetalle'
      ORDER BY TABLE_NAME,ORDINAL_POSITION;

      SELECT OBJECT_NAME(object_id) AS tabla,name,is_unique,is_disabled
      FROM sys.indexes
      WHERE name IN (
        'UQ_Materiales_NombreNormalizado',
        'UQ_UoM_NombreNormalizado',
        'IX_LiberacionRemitoDetalle_Detalle',
        'IX_LiberacionRemitoDetalle_ProyectoMaterial'
      )
      ORDER BY name;

      SELECT
        dbo.fn_NormalizarClave(N' kg ') AS kg_1,
        dbo.fn_NormalizarClave(N'Kg') AS kg_2,
        dbo.fn_NormalizarClave(N'  HORMIG' + NCHAR(211) + N'N   H21 ') AS material_1,
        dbo.fn_NormalizarClave(N'hormigon h21') AS material_2,
        CASE WHEN dbo.fn_NormalizarClave(N' kg ') COLLATE Latin1_General_100_CI_AI = dbo.fn_NormalizarClave(N'KG') THEN 1 ELSE 0 END AS uom_equivalente,
        CASE WHEN dbo.fn_NormalizarClave(N'HORMIG' + NCHAR(211) + N'N H21') COLLATE Latin1_General_100_CI_AI = dbo.fn_NormalizarClave(N'hormigon h21') THEN 1 ELSE 0 END AS material_equivalente;

      SELECT COUNT_BIG(*) AS liberaciones FROM dbo.LiberacionRemitoDetalle;
      SELECT COUNT_BIG(*) AS filas_saldo FROM dbo.vw_SaldoLiberacionRemitoDetalle;
      SELECT COUNT_BIG(*) AS remitos_estado FROM dbo.vw_EstadoLiberacionRemito;
      SELECT estado_liberacion,COUNT_BIG(*) AS cantidad
      FROM dbo.vw_EstadoLiberacionRemito
      GROUP BY estado_liberacion
      ORDER BY estado_liberacion;
      DBCC CHECKCONSTRAINTS ('dbo.LiberacionRemitoDetalle') WITH ALL_CONSTRAINTS;
    `);

    console.log(JSON.stringify({
      objetos: resultado.recordsets[0][0],
      columnas: resultado.recordsets[1],
      indices: resultado.recordsets[2],
      normalizacion: resultado.recordsets[3][0],
      conteos: {
        liberaciones: resultado.recordsets[4][0].liberaciones,
        filas_saldo: resultado.recordsets[5][0].filas_saldo,
        remitos_estado: resultado.recordsets[6][0].remitos_estado
      },
      estados: resultado.recordsets[7],
      violaciones: resultado.recordsets[8] || []
    }, null, 2));
  } finally {
    await pool.close();
  }
};

verificar().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
