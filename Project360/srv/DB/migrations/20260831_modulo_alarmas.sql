SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.AlarmaProyecto', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AlarmaProyecto (
    alarma_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    proyecto_id BIGINT NOT NULL,
    categoria VARCHAR(30) NOT NULL,
    severidad VARCHAR(20) NOT NULL CONSTRAINT DF_AlarmaProyecto_severidad DEFAULT 'ADVERTENCIA',
    mensaje NVARCHAR(500) NOT NULL,
    recurso_tipo VARCHAR(50) NULL,
    recurso_id BIGINT NULL,
    url_destino NVARCHAR(500) NULL,
    clave_deduplicacion VARCHAR(250) NULL,
    fecha_disparo DATETIME2(0) NOT NULL CONSTRAINT DF_AlarmaProyecto_fecha DEFAULT SYSUTCDATETIME(),
    activa BIT NOT NULL CONSTRAINT DF_AlarmaProyecto_activa DEFAULT 1,
    CONSTRAINT FK_AlarmaProyecto_Proyecto FOREIGN KEY (proyecto_id) REFERENCES dbo.Proyecto(proyecto_id),
    CONSTRAINT CK_AlarmaProyecto_categoria CHECK (categoria IN ('OPERACIONES','BOM','CERTIFICACIONES','COMPRAS','PROYECTO')),
    CONSTRAINT CK_AlarmaProyecto_severidad CHECK (severidad IN ('INFORMATIVA','ADVERTENCIA','CRITICA'))
  );

  CREATE INDEX IX_AlarmaProyecto_activas
    ON dbo.AlarmaProyecto (activa, fecha_disparo DESC)
    INCLUDE (proyecto_id, categoria, severidad);

  CREATE UNIQUE INDEX UX_AlarmaProyecto_deduplicacion
    ON dbo.AlarmaProyecto (proyecto_id, clave_deduplicacion)
    WHERE clave_deduplicacion IS NOT NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.AlarmaProyecto') AND name='IX_AlarmaProyecto_activas')
  CREATE INDEX IX_AlarmaProyecto_activas ON dbo.AlarmaProyecto (activa, fecha_disparo DESC) INCLUDE (proyecto_id, categoria, severidad);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.AlarmaProyecto') AND name='UX_AlarmaProyecto_deduplicacion')
  CREATE UNIQUE INDEX UX_AlarmaProyecto_deduplicacion ON dbo.AlarmaProyecto (proyecto_id, clave_deduplicacion) WHERE clave_deduplicacion IS NOT NULL;
GO

IF OBJECT_ID('dbo.ReglaAlarmaProyecto', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ReglaAlarmaProyecto (
    regla_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    proyecto_id BIGINT NOT NULL,
    categoria VARCHAR(30) NOT NULL,
    tipo VARCHAR(80) NOT NULL,
    nombre NVARCHAR(150) NOT NULL,
    mensaje NVARCHAR(500) NOT NULL,
    parametros_json NVARCHAR(MAX) NULL,
    alcance VARCHAR(20) NOT NULL CONSTRAINT DF_ReglaAlarma_alcance DEFAULT 'TODAS',
    entidades_json NVARCHAR(MAX) NULL,
    estado VARCHAR(15) NOT NULL CONSTRAINT DF_ReglaAlarma_estado DEFAULT 'ACTIVA',
    creada_por BIGINT NOT NULL,
    fecha_creacion DATETIME2(0) NOT NULL CONSTRAINT DF_ReglaAlarma_creacion DEFAULT SYSUTCDATETIME(),
    fecha_actualizacion DATETIME2(0) NOT NULL CONSTRAINT DF_ReglaAlarma_actualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ReglaAlarma_Proyecto FOREIGN KEY (proyecto_id) REFERENCES dbo.Proyecto(proyecto_id),
    CONSTRAINT FK_ReglaAlarma_Usuario FOREIGN KEY (creada_por) REFERENCES dbo.Usuario(usuario_id),
    CONSTRAINT CK_ReglaAlarma_categoria CHECK (categoria IN ('OPERACIONES','BOM','CERTIFICACIONES','COMPRAS','PROYECTO')),
    CONSTRAINT CK_ReglaAlarma_alcance CHECK (alcance IN ('TODAS','SELECCIONADAS')),
    CONSTRAINT CK_ReglaAlarma_estado CHECK (estado IN ('ACTIVA','PAUSADA')),
    CONSTRAINT CK_ReglaAlarma_parametros_json CHECK (parametros_json IS NULL OR ISJSON(parametros_json) = 1),
    CONSTRAINT CK_ReglaAlarma_entidades_json CHECK (entidades_json IS NULL OR ISJSON(entidades_json) = 1)
  );
  CREATE INDEX IX_ReglaAlarmaProyecto_proyecto ON dbo.ReglaAlarmaProyecto(proyecto_id, categoria, estado);
END;
GO

IF OBJECT_ID('dbo.AlarmaLectura', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AlarmaLectura (
    alarma_id BIGINT NOT NULL,
    usuario_id BIGINT NOT NULL,
    fecha_lectura DATETIME2(0) NOT NULL CONSTRAINT DF_AlarmaLectura_fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_AlarmaLectura PRIMARY KEY (alarma_id, usuario_id),
    CONSTRAINT FK_AlarmaLectura_Alarma FOREIGN KEY (alarma_id) REFERENCES dbo.AlarmaProyecto(alarma_id),
    CONSTRAINT FK_AlarmaLectura_Usuario FOREIGN KEY (usuario_id) REFERENCES dbo.Usuario(usuario_id)
  );
END;
GO

IF COL_LENGTH('dbo.AlarmaProyecto','estado_gestion') IS NULL
  ALTER TABLE dbo.AlarmaProyecto ADD estado_gestion VARCHAR(15) NOT NULL CONSTRAINT DF_AlarmaProyecto_estado_gestion DEFAULT 'ACTIVA';
IF COL_LENGTH('dbo.AlarmaProyecto','aceptada_por') IS NULL
  ALTER TABLE dbo.AlarmaProyecto ADD aceptada_por BIGINT NULL;
IF COL_LENGTH('dbo.AlarmaProyecto','comentario_aceptacion') IS NULL
  ALTER TABLE dbo.AlarmaProyecto ADD comentario_aceptacion NVARCHAR(1000) NULL;
IF COL_LENGTH('dbo.AlarmaProyecto','fecha_aceptacion') IS NULL
  ALTER TABLE dbo.AlarmaProyecto ADD fecha_aceptacion DATETIME2(0) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_AlarmaProyecto_aceptada_usuario')
  ALTER TABLE dbo.AlarmaProyecto ADD CONSTRAINT FK_AlarmaProyecto_aceptada_usuario FOREIGN KEY(aceptada_por) REFERENCES dbo.Usuario(usuario_id);
GO
