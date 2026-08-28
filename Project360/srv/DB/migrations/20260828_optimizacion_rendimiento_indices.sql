/*
  Optimización de índices para listados y detalles (2026-08-28)

  Alcance:
  - Avances y consumos paginados por operación.
  - Acumulado de consumos por línea BOM.
  - Detalles de compras y remitos.
  - Listado y agrupación de remitos.
  - Stock disponible por proyecto.

  La migración no modifica datos ni contratos. Es idempotente: cada índice se
  crea únicamente si todavía no existe con el nombre versionado.

  Aplicación recomendada:
  1. Ejecutar primero scripts/verificar-indices-rendimiento-20260828.js.
  2. Aplicar en una ventana de bajo tráfico; CREATE INDEX puede tomar bloqueos.
  3. Ejecutar esta migración una segunda vez para verificar idempotencia.

  Rollback manual (también idempotente):
    DROP INDEX IF EXISTS IX_AvanceOperacion_operacion_creacion
      ON dbo.AvanceOperacion;
    DROP INDEX IF EXISTS IX_ConsumoMaterialOperacion_operacion_creacion
      ON dbo.ConsumoMaterialOperacion;
    DROP INDEX IF EXISTS IX_ConsumoMaterialOperacion_bom_creacion
      ON dbo.ConsumoMaterialOperacion;
    DROP INDEX IF EXISTS IX_DetalleRegistroCompra_compra
      ON dbo.Detalle_RegistroDeCompra;
    DROP INDEX IF EXISTS IX_Remito_compra_activo
      ON dbo.Remito;
    DROP INDEX IF EXISTS IX_Remito_activo_fecha
      ON dbo.Remito;
    DROP INDEX IF EXISTS IX_DetalleRemito_remito
      ON dbo.Detalle_Remito;
    DROP INDEX IF EXISTS IX_Container_proyecto_activo_stock
      ON dbo.Container;
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  -- Evita sort para ORDER BY fecha_creacion DESC, avance_id DESC y cubre la card.
  IF OBJECT_ID(N'dbo.AvanceOperacion', N'U') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.indexes
       WHERE object_id=OBJECT_ID(N'dbo.AvanceOperacion')
         AND name=N'IX_AvanceOperacion_operacion_creacion'
     )
    CREATE INDEX IX_AvanceOperacion_operacion_creacion
      ON dbo.AvanceOperacion(operacion_id,fecha_creacion DESC,avance_id DESC)
      INCLUDE(fecha_registro,pct_avance_anterior,pct_avance_nuevo,cantidad_hoy,
              registrado_por,es_primer_avance);

  -- Página de consumos por operación, en el mismo orden estable usado por la API.
  IF OBJECT_ID(N'dbo.ConsumoMaterialOperacion', N'U') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.indexes
       WHERE object_id=OBJECT_ID(N'dbo.ConsumoMaterialOperacion')
         AND name=N'IX_ConsumoMaterialOperacion_operacion_creacion'
     )
    CREATE INDEX IX_ConsumoMaterialOperacion_operacion_creacion
      ON dbo.ConsumoMaterialOperacion(operacion_id,fecha_creacion DESC,consumo_id DESC)
      INCLUDE(bom_id,container_id,cantidad_consumida,fecha_consumo,uom_id,
              afecta_stock,anulado);

  -- Subconsulta del acumulado histórico de una misma línea BOM.
  IF OBJECT_ID(N'dbo.ConsumoMaterialOperacion', N'U') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.indexes
       WHERE object_id=OBJECT_ID(N'dbo.ConsumoMaterialOperacion')
         AND name=N'IX_ConsumoMaterialOperacion_bom_creacion'
     )
    CREATE INDEX IX_ConsumoMaterialOperacion_bom_creacion
      ON dbo.ConsumoMaterialOperacion(bom_id,fecha_creacion,consumo_id)
      INCLUDE(anulado,cantidad_consumida);

  -- Lectura y agregación de todas las líneas pertenecientes a una compra.
  IF OBJECT_ID(N'dbo.Detalle_RegistroDeCompra', N'U') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.indexes
       WHERE object_id=OBJECT_ID(N'dbo.Detalle_RegistroDeCompra')
         AND name=N'IX_DetalleRegistroCompra_compra'
     )
    CREATE INDEX IX_DetalleRegistroCompra_compra
      ON dbo.Detalle_RegistroDeCompra(id_oc,id_detalle_oc)
      INCLUDE(id_material,cantidad,UoM);

  -- Conteo, validación y detalle de remitos activos de una compra.
  IF OBJECT_ID(N'dbo.Remito', N'U') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.indexes
       WHERE object_id=OBJECT_ID(N'dbo.Remito')
         AND name=N'IX_Remito_compra_activo'
     )
    CREATE INDEX IX_Remito_compra_activo
      ON dbo.Remito(idRegistroDeCompra,activo,remito_id DESC)
      INCLUDE(fecha,numero,Liberado);

  -- Listado global paginado de remitos activos ordenado por fecha.
  IF OBJECT_ID(N'dbo.Remito', N'U') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.indexes
       WHERE object_id=OBJECT_ID(N'dbo.Remito')
         AND name=N'IX_Remito_activo_fecha'
     )
    CREATE INDEX IX_Remito_activo_fecha
      ON dbo.Remito(activo,fecha DESC,remito_id DESC)
      INCLUDE(idRegistroDeCompra,numero,Liberado);

  -- Vista de saldos, detalle y conteo por cabecera de remito.
  IF OBJECT_ID(N'dbo.Detalle_Remito', N'U') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.indexes
       WHERE object_id=OBJECT_ID(N'dbo.Detalle_Remito')
         AND name=N'IX_DetalleRemito_remito'
     )
    CREATE INDEX IX_DetalleRemito_remito
      ON dbo.Detalle_Remito(remito_id,detalle_remito_id)
      INCLUDE(id_material,cantidad,UoM);

  -- Disponibilidad agrupada por proyecto/material a través de StockGeneral.
  IF OBJECT_ID(N'dbo.Container', N'U') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.indexes
       WHERE object_id=OBJECT_ID(N'dbo.Container')
         AND name=N'IX_Container_proyecto_activo_stock'
     )
    CREATE INDEX IX_Container_proyecto_activo_stock
      ON dbo.Container(id_proyecto,activo,stock_general_id)
      INCLUDE(cantidad_actual,container_id);

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
