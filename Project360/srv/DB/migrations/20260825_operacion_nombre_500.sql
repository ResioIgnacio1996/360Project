SET NOCOUNT ON;

IF COL_LENGTH('dbo.Operacion', 'nombre') IS NOT NULL
   AND COL_LENGTH('dbo.Operacion', 'nombre') < 1000
BEGIN
  DECLARE @permite_nulos BIT = (
    SELECT c.is_nullable
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('dbo.Operacion')
      AND c.name = 'nombre'
  );

  IF @permite_nulos = 1
    ALTER TABLE dbo.Operacion ALTER COLUMN nombre NVARCHAR(500) NULL;
  ELSE
    ALTER TABLE dbo.Operacion ALTER COLUMN nombre NVARCHAR(500) NOT NULL;
END;
