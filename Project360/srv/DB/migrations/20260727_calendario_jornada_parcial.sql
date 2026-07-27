/*
  Extensión aditiva de CalendarioProyecto.
  Conserva las columnas BIT actuales para compatibilidad y agrega el tipo
  de jornada 0/1/2 requerido por los CSV de programación.
*/
IF COL_LENGTH('CalendarioProyecto', 'fecha_inicio_programacion') IS NULL
  ALTER TABLE CalendarioProyecto ADD fecha_inicio_programacion DATE NULL;

IF COL_LENGTH('CalendarioProyecto', 'tipo_lunes') IS NULL
  ALTER TABLE CalendarioProyecto ADD
    tipo_lunes TINYINT NOT NULL CONSTRAINT DF_Calendario_tipo_lunes DEFAULT 1,
    tipo_martes TINYINT NOT NULL CONSTRAINT DF_Calendario_tipo_martes DEFAULT 1,
    tipo_miercoles TINYINT NOT NULL CONSTRAINT DF_Calendario_tipo_miercoles DEFAULT 1,
    tipo_jueves TINYINT NOT NULL CONSTRAINT DF_Calendario_tipo_jueves DEFAULT 1,
    tipo_viernes TINYINT NOT NULL CONSTRAINT DF_Calendario_tipo_viernes DEFAULT 1,
    tipo_sabado TINYINT NOT NULL CONSTRAINT DF_Calendario_tipo_sabado DEFAULT 0,
    tipo_domingo TINYINT NOT NULL CONSTRAINT DF_Calendario_tipo_domingo DEFAULT 0,
    hs_jornada_parcial DECIMAL(4,2) NULL,
    hora_inicio_parcial TIME NULL,
    hora_fin_parcial TIME NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CHK_Calendario_tipos_jornada')
  ALTER TABLE CalendarioProyecto ADD CONSTRAINT CHK_Calendario_tipos_jornada CHECK (
    tipo_lunes BETWEEN 0 AND 2 AND tipo_martes BETWEEN 0 AND 2 AND
    tipo_miercoles BETWEEN 0 AND 2 AND tipo_jueves BETWEEN 0 AND 2 AND
    tipo_viernes BETWEEN 0 AND 2 AND tipo_sabado BETWEEN 0 AND 2 AND
    tipo_domingo BETWEEN 0 AND 2
  );
