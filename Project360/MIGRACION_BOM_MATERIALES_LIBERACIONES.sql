/*
  OBRA360 - Migración BOM, Materiales y liberaciones parciales (v2)
  Microsoft SQL Server

  CORRECCIÓN v2:
  Los ALTER TABLE que agregan columnas se ejecutan en lotes separados.
  SQL Server debe terminar cada ALTER antes de compilar las referencias
  posteriores a esas columnas.

  IMPORTANTE:
  - Codex NO ejecutó este script.
  - Ejecutar primero en una base de prueba y con backup verificado.
  - El script es reejecutable.
  - No regulariza automáticamente BOM históricas sin material_id.
  - No vuelve obligatoria Materiales.uom_id porque hay datos históricos sin UOM.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* ================================================================
   1. Normalización compartida
   ================================================================ */
CREATE OR ALTER FUNCTION dbo.fn_NormalizarClave
(
    @valor NVARCHAR(4000)
)
RETURNS NVARCHAR(4000)
WITH SCHEMABINDING
AS
BEGIN
    DECLARE @resultado NVARCHAR(4000);

    SET @resultado = UPPER(LTRIM(RTRIM(ISNULL(@valor, N''))));

    WHILE CHARINDEX(N'  ', @resultado) > 0
        SET @resultado = REPLACE(@resultado, N'  ', N' ');

    RETURN @resultado COLLATE Latin1_General_100_CI_AI;
END;
GO

/* ================================================================
   2. Materiales: agregar la columna calculada en su propio lote
   ================================================================ */
IF COL_LENGTH('dbo.Materiales', 'nombre_normalizado') IS NULL
BEGIN
    EXEC(N'
        ALTER TABLE dbo.Materiales
        ADD nombre_normalizado AS
        (
            CONVERT(NVARCHAR(100), dbo.fn_NormalizarClave([Nombre]))
            COLLATE Latin1_General_100_CI_AI
        ) PERSISTED;
    ');
END;
GO

/* A partir de este lote la columna ya existe y SQL Server puede compilarla. */
IF EXISTS
(
    SELECT 1
    FROM dbo.Materiales
    GROUP BY nombre_normalizado
    HAVING COUNT_BIG(*) > 1
)
BEGIN
    SELECT
        nombre_normalizado,
        COUNT_BIG(*) AS cantidad_repetida,
        STRING_AGG(CONVERT(NVARCHAR(MAX), CONCAT(id_material, N': ', Nombre)), N' | ') AS registros
    FROM dbo.Materiales
    GROUP BY nombre_normalizado
    HAVING COUNT_BIG(*) > 1;

    THROW 51001, 'Existen materiales duplicados por nombre normalizado. Resolverlos antes de continuar.', 1;
END;

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Materiales')
      AND name = 'UQ_Materiales_NombreNormalizado'
)
BEGIN
    CREATE UNIQUE INDEX UQ_Materiales_NombreNormalizado
        ON dbo.Materiales(nombre_normalizado);
END;
GO

/* ================================================================
   3. UoM: agregar la columna calculada en su propio lote
   ================================================================ */
IF COL_LENGTH('dbo.UoM', 'nombre_normalizado') IS NULL
BEGIN
    EXEC(N'
        ALTER TABLE dbo.UoM
        ADD nombre_normalizado AS
        (
            CONVERT(NVARCHAR(50), dbo.fn_NormalizarClave([nombre]))
            COLLATE Latin1_General_100_CI_AI
        ) PERSISTED;
    ');
END;
GO

IF EXISTS
(
    SELECT 1
    FROM dbo.UoM
    GROUP BY nombre_normalizado
    HAVING COUNT_BIG(*) > 1
)
BEGIN
    SELECT
        nombre_normalizado,
        COUNT_BIG(*) AS cantidad_repetida,
        STRING_AGG(CONVERT(NVARCHAR(MAX), CONCAT(uom_id, N': ', nombre)), N' | ') AS registros
    FROM dbo.UoM
    GROUP BY nombre_normalizado
    HAVING COUNT_BIG(*) > 1;

    THROW 51002, 'Existen UOM duplicadas por nombre normalizado. Resolverlas antes de continuar.', 1;
END;

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.UoM')
      AND name = 'UQ_UoM_NombreNormalizado'
)
BEGIN
    CREATE UNIQUE INDEX UQ_UoM_NombreNormalizado
        ON dbo.UoM(nombre_normalizado);
END;
GO

/* ================================================================
   4. La OC conserva datos documentales y deja de definir Materiales
   ================================================================ */
ALTER TABLE dbo.Detalle_RegistroDeCompra
    ALTER COLUMN id_material BIGINT NULL;
GO

/* ================================================================
   5. El remito conserva la descripción documental original
   ================================================================ */
IF COL_LENGTH('dbo.Detalle_Remito', 'Descripcion') IS NULL
BEGIN
    EXEC(N'
        ALTER TABLE dbo.Detalle_Remito
        ADD Descripcion NVARCHAR(255) NULL;
    ');
END;
GO

/* La columna ya existe en este lote; se completan los registros históricos. */
UPDATE dr
   SET dr.Descripcion = m.Nombre
FROM dbo.Detalle_Remito dr
INNER JOIN dbo.Materiales m
    ON m.id_material = dr.id_material
WHERE NULLIF(LTRIM(RTRIM(dr.Descripcion)), N'') IS NULL;
GO

/* ================================================================
   6. Historial de liberaciones parciales

   material_id: material destino definido por la BOM.
   container_id: referencia Container.container_id.
   ================================================================ */
IF OBJECT_ID('dbo.LiberacionRemitoDetalle', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.LiberacionRemitoDetalle
    (
        liberacion_detalle_id BIGINT IDENTITY(1,1) NOT NULL,
        detalle_remito_id     BIGINT NOT NULL,
        proyecto_id           BIGINT NOT NULL,
        material_id           BIGINT NOT NULL,
        container_id          BIGINT NOT NULL,
        cantidad              DECIMAL(18,2) NOT NULL,
        fecha_liberacion      DATETIME2(0) NOT NULL
            CONSTRAINT DF_LiberacionRemitoDetalle_Fecha DEFAULT SYSDATETIME(),
        registrado_por       BIGINT NULL,
        observaciones         NVARCHAR(500) NULL,
        activo                BIT NOT NULL
            CONSTRAINT DF_LiberacionRemitoDetalle_Activo DEFAULT (1),

        CONSTRAINT PK_LiberacionRemitoDetalle
            PRIMARY KEY CLUSTERED (liberacion_detalle_id),

        CONSTRAINT CK_LiberacionRemitoDetalle_Cantidad
            CHECK (cantidad > 0),

        CONSTRAINT FK_LiberacionRemitoDetalle_DetalleRemito
            FOREIGN KEY (detalle_remito_id)
            REFERENCES dbo.Detalle_Remito(detalle_remito_id),

        CONSTRAINT FK_LiberacionRemitoDetalle_Proyecto
            FOREIGN KEY (proyecto_id)
            REFERENCES dbo.Proyecto(proyecto_id),

        CONSTRAINT FK_LiberacionRemitoDetalle_Material
            FOREIGN KEY (material_id)
            REFERENCES dbo.Materiales(id_material),

        CONSTRAINT FK_LiberacionRemitoDetalle_Container
            FOREIGN KEY (container_id)
            REFERENCES dbo.Container(container_id),

        CONSTRAINT FK_LiberacionRemitoDetalle_Usuario
            FOREIGN KEY (registrado_por)
            REFERENCES dbo.Usuario(usuario_id)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.LiberacionRemitoDetalle')
      AND name = 'IX_LiberacionRemitoDetalle_Detalle'
)
BEGIN
    CREATE INDEX IX_LiberacionRemitoDetalle_Detalle
        ON dbo.LiberacionRemitoDetalle(detalle_remito_id, activo)
        INCLUDE (cantidad, proyecto_id, material_id, container_id, fecha_liberacion);
END;

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.LiberacionRemitoDetalle')
      AND name = 'IX_LiberacionRemitoDetalle_ProyectoMaterial'
)
BEGIN
    CREATE INDEX IX_LiberacionRemitoDetalle_ProyectoMaterial
        ON dbo.LiberacionRemitoDetalle(proyecto_id, material_id, activo)
        INCLUDE (cantidad, detalle_remito_id, container_id, fecha_liberacion);
END;
GO

/* ================================================================
   7. Protección de las liberaciones
   ================================================================ */
CREATE OR ALTER TRIGGER dbo.TR_LiberacionRemitoDetalle_Validar
ON dbo.LiberacionRemitoDetalle
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    /* kg, KG, Kg y variantes con espacios se consideran iguales. */
    IF EXISTS
    (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.Detalle_Remito dr
            ON dr.detalle_remito_id = i.detalle_remito_id
        INNER JOIN dbo.Materiales m
            ON m.id_material = i.material_id
        LEFT JOIN dbo.UoM u
            ON u.uom_id = m.uom_id
        WHERE i.activo = 1
          AND
          (
              u.uom_id IS NULL
              OR NULLIF(dbo.fn_NormalizarClave(dr.UoM), N'') IS NULL
              OR dbo.fn_NormalizarClave(dr.UoM) <> u.nombre_normalizado
          )
    )
    BEGIN
        THROW 51003, 'La UOM del remito no coincide con la UOM del material BOM seleccionado.', 1;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM inserted i
        WHERE i.activo = 1
          AND NOT EXISTS
          (
              SELECT 1
              FROM dbo.BomOperacion b
              INNER JOIN dbo.Operacion o
                  ON o.operacion_id = b.operacion_id
                 AND ISNULL(o.archivada, 0) = 0
              INNER JOIN dbo.VersionPlan vp
                  ON vp.version_id = o.version_id
                 AND vp.es_activa = 1
              WHERE b.proyecto_id = i.proyecto_id
                AND b.material_id = i.material_id
          )
    )
    BEGIN
        THROW 51004, 'El material seleccionado no pertenece a la BOM activa del proyecto.', 1;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM
        (
            SELECT DISTINCT detalle_remito_id
            FROM inserted
        ) afectados
        INNER JOIN dbo.Detalle_Remito dr WITH (UPDLOCK, HOLDLOCK)
            ON dr.detalle_remito_id = afectados.detalle_remito_id
        CROSS APPLY
        (
            SELECT ISNULL(SUM(lrd.cantidad), 0) AS cantidad_liberada
            FROM dbo.LiberacionRemitoDetalle lrd WITH (UPDLOCK, HOLDLOCK)
            WHERE lrd.detalle_remito_id = afectados.detalle_remito_id
              AND lrd.activo = 1
        ) total
        WHERE total.cantidad_liberada > dr.cantidad
    )
    BEGIN
        THROW 51005, 'La suma de liberaciones supera la cantidad original del detalle del remito.', 1;
    END;
END;
GO

/* ================================================================
   8. Saldo por detalle

   Compatibilidad histórica:
   Un remito antiguo Liberado=1 sin movimientos nuevos se considera
   completamente liberado.
   ================================================================ */
CREATE OR ALTER VIEW dbo.vw_SaldoLiberacionRemitoDetalle
AS
    SELECT
        dr.detalle_remito_id,
        dr.remito_id,
        dr.Descripcion,
        dr.UoM,
        dr.cantidad AS cantidad_original,
        CAST(
            CASE
                WHEN ISNULL(r.Liberado, 0) = 1
                 AND ISNULL(mov.cantidad_movimientos, 0) = 0
                    THEN dr.cantidad
                ELSE ISNULL(mov.cantidad_movimientos, 0)
            END AS DECIMAL(18,2)
        ) AS cantidad_liberada,
        CAST(
            CASE
                WHEN dr.cantidad -
                    CASE
                        WHEN ISNULL(r.Liberado, 0) = 1
                         AND ISNULL(mov.cantidad_movimientos, 0) = 0
                            THEN dr.cantidad
                        ELSE ISNULL(mov.cantidad_movimientos, 0)
                    END < 0
                    THEN 0
                ELSE dr.cantidad -
                    CASE
                        WHEN ISNULL(r.Liberado, 0) = 1
                         AND ISNULL(mov.cantidad_movimientos, 0) = 0
                            THEN dr.cantidad
                        ELSE ISNULL(mov.cantidad_movimientos, 0)
                    END
            END AS DECIMAL(18,2)
        ) AS cantidad_pendiente,
        CASE
            WHEN
                CASE
                    WHEN ISNULL(r.Liberado, 0) = 1
                     AND ISNULL(mov.cantidad_movimientos, 0) = 0
                        THEN dr.cantidad
                    ELSE ISNULL(mov.cantidad_movimientos, 0)
                END = 0
                THEN 'PENDIENTE'
            WHEN
                CASE
                    WHEN ISNULL(r.Liberado, 0) = 1
                     AND ISNULL(mov.cantidad_movimientos, 0) = 0
                        THEN dr.cantidad
                    ELSE ISNULL(mov.cantidad_movimientos, 0)
                END >= dr.cantidad
                THEN 'LIBERADO'
            ELSE 'PARCIAL'
        END AS estado_liberacion
    FROM dbo.Detalle_Remito dr
    INNER JOIN dbo.Remito r
        ON r.remito_id = dr.remito_id
    OUTER APPLY
    (
        SELECT SUM(lrd.cantidad) AS cantidad_movimientos
        FROM dbo.LiberacionRemitoDetalle lrd
        WHERE lrd.detalle_remito_id = dr.detalle_remito_id
          AND lrd.activo = 1
    ) mov;
GO

/* ================================================================
   9. Estado general del remito
   ================================================================ */
CREATE OR ALTER VIEW dbo.vw_EstadoLiberacionRemito
AS
    SELECT
        saldo.remito_id,
        CAST(SUM(saldo.cantidad_original) AS DECIMAL(18,2)) AS cantidad_original,
        CAST(SUM(saldo.cantidad_liberada) AS DECIMAL(18,2)) AS cantidad_liberada,
        CAST(SUM(saldo.cantidad_pendiente) AS DECIMAL(18,2)) AS cantidad_pendiente,
        CASE
            WHEN SUM(saldo.cantidad_liberada) = 0 THEN 'PENDIENTE'
            WHEN SUM(saldo.cantidad_pendiente) = 0 THEN 'LIBERADO'
            ELSE 'PARCIAL'
        END AS estado_liberacion
    FROM dbo.vw_SaldoLiberacionRemitoDetalle saldo
    GROUP BY saldo.remito_id;
GO

/* ================================================================
   10. Verificación final (solo lectura)
   ================================================================ */
SELECT id_material, Nombre, nombre_normalizado, uom_id
FROM dbo.Materiales
ORDER BY nombre_normalizado;

SELECT uom_id, nombre, nombre_normalizado
FROM dbo.UoM
ORDER BY nombre_normalizado;

SELECT *
FROM dbo.vw_EstadoLiberacionRemito
ORDER BY remito_id DESC;

SELECT COUNT_BIG(*) AS materiales_sin_uom_pendientes
FROM dbo.Materiales
WHERE uom_id IS NULL;

SELECT COUNT_BIG(*) AS lineas_bom_sin_material_pendientes
FROM dbo.BomOperacion
WHERE material_id IS NULL;
GO

/*
  REGLAS PARA LA APLICACIÓN

  1. BOM manual/CSV es la única fuente que crea Materiales.
  2. Buscar materiales mediante dbo.fn_NormalizarClave(descripción).
  3. Reutilizar id_material si la descripción ya existe.
  4. Bloquear si la misma descripción tiene una UOM diferente.
  5. OC y Remito guardan Descripcion/UoM documentales con id_material NULL.
  6. Liberar exige seleccionar un material de la BOM del proyecto.
  7. Crear Container, CostoStock y LiberacionRemitoDetalle en la misma
     transacción SERIALIZABLE.
  8. Remito.Liberado pasa a 1 solamente cuando el saldo llega a cero.
  9. Consumos usa BomOperacion.material_id y descuenta del Container común.
*/
