/*
  Trazabilidad del consumo contra el stock físico del proyecto.
  afecta_stock diferencia los consumos históricos (0), que nunca descontaron
  Container, de los consumos creados por el circuito nuevo (1).
*/
IF COL_LENGTH('ConsumoMaterialOperacion', 'container_id') IS NULL
  ALTER TABLE ConsumoMaterialOperacion ADD container_id BIGINT NULL;
GO

IF COL_LENGTH('ConsumoMaterialOperacion', 'afecta_stock') IS NULL
  ALTER TABLE ConsumoMaterialOperacion ADD afecta_stock BIT NOT NULL
    CONSTRAINT DF_ConsumoMaterialOperacion_afecta_stock DEFAULT 0;
GO

IF COL_LENGTH('ConsumoMaterialOperacion', 'anulado') IS NULL
  ALTER TABLE ConsumoMaterialOperacion ADD anulado BIT NOT NULL
    CONSTRAINT DF_ConsumoMaterialOperacion_anulado DEFAULT 0;
GO

IF COL_LENGTH('ConsumoMaterialOperacion', 'fecha_anulacion') IS NULL
  ALTER TABLE ConsumoMaterialOperacion ADD fecha_anulacion DATETIME2(0) NULL;
GO

IF COL_LENGTH('ConsumoMaterialOperacion', 'anulado_por') IS NULL
  ALTER TABLE ConsumoMaterialOperacion ADD anulado_por BIGINT NULL;
GO

IF COL_LENGTH('ConsumoMaterialOperacion', 'motivo_anulacion') IS NULL
  ALTER TABLE ConsumoMaterialOperacion ADD motivo_anulacion NVARCHAR(500) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = 'FK_ConsumoMaterialOperacion_Container'
)
  ALTER TABLE ConsumoMaterialOperacion WITH CHECK
    ADD CONSTRAINT FK_ConsumoMaterialOperacion_Container
    FOREIGN KEY (container_id) REFERENCES Container(container_id);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = 'FK_ConsumoMaterialOperacion_AnuladoPor'
)
  ALTER TABLE ConsumoMaterialOperacion WITH CHECK
    ADD CONSTRAINT FK_ConsumoMaterialOperacion_AnuladoPor
    FOREIGN KEY (anulado_por) REFERENCES Usuario(usuario_id);
GO

/* Vincula automáticamente las líneas BOM cuyo nombre y UOM coinciden. */
UPDATE b
SET
  material_id = m.id_material,
  sin_codigo = 0,
  fecha_actualizacion = SYSDATETIME()
FROM BomOperacion b
JOIN Materiales m
  ON UPPER(LTRIM(RTRIM(m.nombre))) COLLATE Latin1_General_CI_AI
   = UPPER(LTRIM(RTRIM(b.descripcion_libre))) COLLATE Latin1_General_CI_AI
 AND m.uom_id = b.uom_id
WHERE b.material_id IS NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_ConsumoMaterialOperacion_container_activo'
    AND object_id = OBJECT_ID('ConsumoMaterialOperacion')
)
  CREATE INDEX IX_ConsumoMaterialOperacion_container_activo
    ON ConsumoMaterialOperacion(container_id, anulado, afecta_stock);
GO
