/* Baja lógica de proyectos: 0/NULL = vigente, 1 = eliminado. */
IF COL_LENGTH('dbo.Proyecto', 'eliminado') IS NULL
BEGIN
    ALTER TABLE dbo.Proyecto
        ADD eliminado BIT NOT NULL
            CONSTRAINT DF_Proyecto_eliminado DEFAULT (0) WITH VALUES;
END;
GO

