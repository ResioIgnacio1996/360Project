require('dotenv').config({ quiet: true });
const { conectarDB, cerrarDB } = require('../DB/dbConection');

const tablas = [
  'Operacion', 'OperacionDependencia', 'AvanceOperacion', 'BomOperacion',
  'ConsumoMaterialOperacion', 'Container', 'StockGeneral', 'CostoStock',
  'registroDecompra', 'Detalle_RegistroDeCompra', 'Remito', 'Detalle_Remito',
  'LiberacionRemitoDetalle', 'CertificadoCliente', 'CertificadoResponsable',
  'CertificadoResponsableDetalle', 'MovimientoFinancieroProyecto'
];

(async () => {
  const pool = await conectarDB();
  try {
    const request = pool.request();
    tablas.forEach((tabla, indice) => request.input(`t${indice}`, tabla));
    const parametros = tablas.map((_, indice) => `@t${indice}`).join(',');
    const resultado = await request.query(`
      SELECT t.name tabla,SUM(p.rows) filas
      FROM sys.tables t
      JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
      WHERE t.name IN (${parametros})
      GROUP BY t.name ORDER BY t.name;

      SELECT t.name tabla,i.name indice,i.is_unique,i.has_filter,i.filter_definition,
        STRING_AGG(CASE WHEN ic.is_included_column=0
          THEN CONCAT(c.name,CASE WHEN ic.is_descending_key=1 THEN ' DESC' ELSE ' ASC' END) END,',')
          WITHIN GROUP (ORDER BY ic.index_column_id) claves,
        STRING_AGG(CASE WHEN ic.is_included_column=1 THEN c.name END,',')
          WITHIN GROUP (ORDER BY ic.index_column_id) incluidas
      FROM sys.tables t
      JOIN sys.indexes i ON i.object_id=t.object_id AND i.index_id>0 AND i.is_hypothetical=0
      JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
      JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
      WHERE t.name IN (${parametros})
      GROUP BY t.name,i.name,i.is_unique,i.has_filter,i.filter_definition
      ORDER BY t.name,i.name;

      SELECT o.name objeto,o.type_desc,sm.is_schema_bound,sm.definition
      FROM sys.objects o JOIN sys.sql_modules sm ON sm.object_id=o.object_id
      WHERE o.name IN ('fn_NormalizarClave','vw_EstadoLiberacionRemito','vw_SaldoLiberacionRemitoDetalle');

      SELECT OBJECT_NAME(s.object_id) tabla,i.name indice,s.user_seeks,s.user_scans,s.user_lookups,s.user_updates,
        s.last_user_seek,s.last_user_scan
      FROM sys.dm_db_index_usage_stats s
      JOIN sys.indexes i ON i.object_id=s.object_id AND i.index_id=s.index_id
      WHERE s.database_id=DB_ID() AND OBJECT_NAME(s.object_id) IN (${parametros})
      ORDER BY OBJECT_NAME(s.object_id),i.name;

      SELECT TOP (30) OBJECT_NAME(mid.object_id) tabla,migs.user_seeks,migs.user_scans,
        migs.avg_total_user_cost,migs.avg_user_impact,mid.equality_columns,mid.inequality_columns,mid.included_columns
      FROM sys.dm_db_missing_index_group_stats migs
      JOIN sys.dm_db_missing_index_groups mig ON mig.index_group_handle=migs.group_handle
      JOIN sys.dm_db_missing_index_details mid ON mid.index_handle=mig.index_handle
      WHERE mid.database_id=DB_ID() AND OBJECT_NAME(mid.object_id) IN (${parametros})
      ORDER BY migs.user_seeks*migs.avg_total_user_cost*(migs.avg_user_impact/100.0) DESC;

      SELECT t.name tabla,c.column_id,c.name columna,TYPE_NAME(c.user_type_id) tipo,c.max_length,c.is_nullable
      FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
      WHERE t.name IN (${parametros}) ORDER BY t.name,c.column_id;
    `);
    console.log(JSON.stringify({
      base: process.env.DB_DATABASE,
      cardinalidades: resultado.recordsets[0], indices: resultado.recordsets[1],
      modulos_sql: resultado.recordsets[2], uso_indices: resultado.recordsets[3],
      indices_faltantes_dmv: resultado.recordsets[4], columnas: resultado.recordsets[5]
    }, null, 2));
  } finally {
    await cerrarDB();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
