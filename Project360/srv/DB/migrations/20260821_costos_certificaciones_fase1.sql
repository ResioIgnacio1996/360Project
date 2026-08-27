SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('Operacion','precio_cliente') IS NULL
  EXEC('ALTER TABLE Operacion ADD precio_cliente DECIMAL(19,4) NOT NULL CONSTRAINT DF_Operacion_precio_cliente DEFAULT 0');
IF COL_LENGTH('Operacion','costo_responsable') IS NULL
  EXEC('ALTER TABLE Operacion ADD costo_responsable DECIMAL(19,4) NOT NULL CONSTRAINT DF_Operacion_costo_responsable DEFAULT 0');
IF COL_LENGTH('Operacion','economia_actualizada_por') IS NULL
  EXEC('ALTER TABLE Operacion ADD economia_actualizada_por BIGINT NULL');
IF COL_LENGTH('Operacion','economia_actualizada_en') IS NULL
  EXEC('ALTER TABLE Operacion ADD economia_actualizada_en DATETIME2(0) NULL');
IF COL_LENGTH('Operacion','economia_row_version') IS NULL
  EXEC('ALTER TABLE Operacion ADD economia_row_version ROWVERSION');

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_Operacion_precio_cliente_no_negativo')
  EXEC('ALTER TABLE Operacion ADD CONSTRAINT CK_Operacion_precio_cliente_no_negativo CHECK (precio_cliente>=0)');
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_Operacion_costo_responsable_no_negativo')
  EXEC('ALTER TABLE Operacion ADD CONSTRAINT CK_Operacion_costo_responsable_no_negativo CHECK (costo_responsable>=0)');
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_Operacion_economia_usuario')
  EXEC('ALTER TABLE Operacion ADD CONSTRAINT FK_Operacion_economia_usuario FOREIGN KEY(economia_actualizada_por) REFERENCES Usuario(usuario_id)');

IF OBJECT_ID('HistorialEconomiaOperacion','U') IS NULL
BEGIN
  CREATE TABLE HistorialEconomiaOperacion(
    historial_economia_id BIGINT IDENTITY PRIMARY KEY,
    operacion_id BIGINT NOT NULL,
    campo_modificado NVARCHAR(50) NOT NULL,
    valor_anterior DECIMAL(19,4) NOT NULL,
    valor_nuevo DECIMAL(19,4) NOT NULL,
    motivo NVARCHAR(500) NOT NULL,
    usuario_id BIGINT NOT NULL,
    fecha_modificacion DATETIME2(0) NOT NULL CONSTRAINT DF_HistorialEconomia_fecha DEFAULT SYSDATETIME(),
    CONSTRAINT FK_HistorialEconomia_operacion FOREIGN KEY(operacion_id) REFERENCES Operacion(operacion_id),
    CONSTRAINT FK_HistorialEconomia_usuario FOREIGN KEY(usuario_id) REFERENCES Usuario(usuario_id),
    CONSTRAINT CK_HistorialEconomia_campo CHECK(campo_modificado IN ('precio_cliente','costo_responsable'))
  );
END;

IF OBJECT_ID('CertificadoCliente','U') IS NULL
BEGIN
  CREATE TABLE CertificadoCliente(
    certificado_cliente_id BIGINT IDENTITY PRIMARY KEY,
    proyecto_id BIGINT NOT NULL,
    metodo_corte NVARCHAR(30) NOT NULL CONSTRAINT DF_Certificado_metodo DEFAULT 'POR_FECHA',
    operacion_corte_id BIGINT NULL,
    fecha_certificacion DATE NOT NULL,
    total DECIMAL(19,4) NOT NULL,
    estado NVARCHAR(30) NOT NULL CONSTRAINT DF_Certificado_estado DEFAULT 'EMITIDO',
    observaciones NVARCHAR(1000) NULL,
    creado_por BIGINT NOT NULL,
    fecha_creacion DATETIME2(0) NOT NULL CONSTRAINT DF_Certificado_fecha DEFAULT SYSDATETIME(),
    eliminado_por BIGINT NULL,
    fecha_eliminacion DATETIME2(0) NULL,
    motivo_eliminacion NVARCHAR(500) NULL,
    row_version ROWVERSION,
    CONSTRAINT FK_Certificado_proyecto FOREIGN KEY(proyecto_id) REFERENCES Proyecto(proyecto_id),
    CONSTRAINT FK_Certificado_usuario FOREIGN KEY(creado_por) REFERENCES Usuario(usuario_id),
    CONSTRAINT FK_Certificado_eliminado_usuario FOREIGN KEY(eliminado_por) REFERENCES Usuario(usuario_id),
    CONSTRAINT FK_Certificado_operacion_corte FOREIGN KEY(operacion_corte_id) REFERENCES Operacion(operacion_id),
    CONSTRAINT CK_Certificado_metodo CHECK(metodo_corte IN ('POR_FECHA','POR_OPERACION')),
    CONSTRAINT CK_Certificado_operacion_corte CHECK(
      (metodo_corte='POR_FECHA' AND operacion_corte_id IS NULL) OR
      (metodo_corte='POR_OPERACION' AND operacion_corte_id IS NOT NULL)),
    CONSTRAINT CK_Certificado_estado CHECK(estado IN ('EMITIDO','RECHAZADO','ELIMINADO')),
    CONSTRAINT CK_Certificado_eliminacion CHECK(
      (estado='ELIMINADO' AND eliminado_por IS NOT NULL AND fecha_eliminacion IS NOT NULL AND LEN(LTRIM(RTRIM(motivo_eliminacion)))>0) OR
      (estado<>'ELIMINADO' AND eliminado_por IS NULL AND fecha_eliminacion IS NULL AND motivo_eliminacion IS NULL)),
    CONSTRAINT CK_Certificado_total CHECK(total>=0)
  );
END;

IF COL_LENGTH('CertificadoCliente','operacion_corte_id') IS NULL
  EXEC('ALTER TABLE CertificadoCliente ADD operacion_corte_id BIGINT NULL');
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_Certificado_metodo')
  ALTER TABLE CertificadoCliente DROP CONSTRAINT CK_Certificado_metodo;
ALTER TABLE CertificadoCliente ADD CONSTRAINT CK_Certificado_metodo
  CHECK(metodo_corte IN ('POR_FECHA','POR_OPERACION'));
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_Certificado_operacion_corte')
  EXEC('ALTER TABLE CertificadoCliente ADD CONSTRAINT FK_Certificado_operacion_corte FOREIGN KEY(operacion_corte_id) REFERENCES Operacion(operacion_id)');
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_Certificado_operacion_corte')
  EXEC('ALTER TABLE CertificadoCliente ADD CONSTRAINT CK_Certificado_operacion_corte CHECK ((metodo_corte=''POR_FECHA'' AND operacion_corte_id IS NULL) OR (metodo_corte=''POR_OPERACION'' AND operacion_corte_id IS NOT NULL))');
IF COL_LENGTH('CertificadoCliente','eliminado_por') IS NULL
  EXEC('ALTER TABLE CertificadoCliente ADD eliminado_por BIGINT NULL');
IF COL_LENGTH('CertificadoCliente','fecha_eliminacion') IS NULL
  EXEC('ALTER TABLE CertificadoCliente ADD fecha_eliminacion DATETIME2(0) NULL');
IF COL_LENGTH('CertificadoCliente','motivo_eliminacion') IS NULL
  EXEC('ALTER TABLE CertificadoCliente ADD motivo_eliminacion NVARCHAR(500) NULL');
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_Certificado_estado')
  ALTER TABLE CertificadoCliente DROP CONSTRAINT CK_Certificado_estado;
ALTER TABLE CertificadoCliente ADD CONSTRAINT CK_Certificado_estado
  CHECK(estado IN ('EMITIDO','RECHAZADO','ELIMINADO'));
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_Certificado_eliminado_usuario')
  EXEC('ALTER TABLE CertificadoCliente ADD CONSTRAINT FK_Certificado_eliminado_usuario FOREIGN KEY(eliminado_por) REFERENCES Usuario(usuario_id)');
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_Certificado_eliminacion')
  EXEC('ALTER TABLE CertificadoCliente ADD CONSTRAINT CK_Certificado_eliminacion CHECK ((estado=''ELIMINADO'' AND eliminado_por IS NOT NULL AND fecha_eliminacion IS NOT NULL AND LEN(LTRIM(RTRIM(motivo_eliminacion)))>0) OR (estado<>''ELIMINADO'' AND eliminado_por IS NULL AND fecha_eliminacion IS NULL AND motivo_eliminacion IS NULL))');

IF OBJECT_ID('CertificadoClienteDetalle','U') IS NULL
BEGIN
  CREATE TABLE CertificadoClienteDetalle(
    detalle_id BIGINT IDENTITY PRIMARY KEY,
    certificado_cliente_id BIGINT NOT NULL,
    operacion_id BIGINT NOT NULL,
    secuencia_aplicada INT NOT NULL,
    avance_fisico_referencia DECIMAL(7,3) NOT NULL,
    porcentaje_anterior DECIMAL(7,3) NOT NULL,
    porcentaje_actual DECIMAL(7,3) NOT NULL,
    delta DECIMAL(7,3) NOT NULL,
    precio_cliente_aplicado DECIMAL(19,4) NOT NULL,
    importe DECIMAL(19,4) NOT NULL,
    modificado_manualmente BIT NOT NULL CONSTRAINT DF_CertificadoDetalle_manual DEFAULT 0,
    motivo_modificacion NVARCHAR(500) NULL,
    CONSTRAINT FK_CertificadoDetalle_certificado FOREIGN KEY(certificado_cliente_id) REFERENCES CertificadoCliente(certificado_cliente_id),
    CONSTRAINT FK_CertificadoDetalle_operacion FOREIGN KEY(operacion_id) REFERENCES Operacion(operacion_id),
    CONSTRAINT UQ_CertificadoDetalle_operacion UNIQUE(certificado_cliente_id,operacion_id),
    CONSTRAINT CK_CertificadoDetalle_porcentajes CHECK(avance_fisico_referencia BETWEEN 0 AND 100 AND porcentaje_anterior BETWEEN 0 AND 100 AND porcentaje_actual BETWEEN 0 AND 100 AND delta>=0 AND porcentaje_actual>=porcentaje_anterior),
    CONSTRAINT CK_CertificadoDetalle_importes CHECK(precio_cliente_aplicado>=0 AND importe>=0),
    CONSTRAINT CK_CertificadoDetalle_motivo CHECK((modificado_manualmente=0) OR (LEN(LTRIM(RTRIM(motivo_modificacion)))>0))
  );
END;

IF COL_LENGTH('CertificadoClienteDetalle','etapa_id_aplicada') IS NULL
  ALTER TABLE CertificadoClienteDetalle ADD etapa_id_aplicada BIGINT NULL;
IF COL_LENGTH('CertificadoClienteDetalle','etapa_nombre_aplicada') IS NULL
  ALTER TABLE CertificadoClienteDetalle ADD etapa_nombre_aplicada NVARCHAR(200) NULL;
IF COL_LENGTH('CertificadoClienteDetalle','etapa_orden_aplicado') IS NULL
  ALTER TABLE CertificadoClienteDetalle ADD etapa_orden_aplicado SMALLINT NULL;
IF COL_LENGTH('CertificadoClienteDetalle','peso_operacion_aplicado') IS NULL
  ALTER TABLE CertificadoClienteDetalle ADD peso_operacion_aplicado DECIMAL(5,2) NULL;

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_Operacion_proyecto_archivada' AND object_id=OBJECT_ID('Operacion'))
  EXEC('CREATE INDEX IX_Operacion_proyecto_archivada ON Operacion(proyecto_id,archivada) INCLUDE(version_id,secuencia,precio_cliente,costo_responsable)');
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_AvanceOperacion_operacion_fecha' AND object_id=OBJECT_ID('AvanceOperacion'))
  CREATE INDEX IX_AvanceOperacion_operacion_fecha ON AvanceOperacion(operacion_id,fecha_registro DESC,fecha_creacion DESC,avance_id DESC) INCLUDE(pct_avance_nuevo);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_Certificado_proyecto_fecha' AND object_id=OBJECT_ID('CertificadoCliente'))
  CREATE INDEX IX_Certificado_proyecto_fecha ON CertificadoCliente(proyecto_id,fecha_certificacion DESC,certificado_cliente_id DESC) INCLUDE(estado,total);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_CertificadoDetalle_operacion' AND object_id=OBJECT_ID('CertificadoClienteDetalle'))
  CREATE INDEX IX_CertificadoDetalle_operacion ON CertificadoClienteDetalle(operacion_id,certificado_cliente_id DESC) INCLUDE(porcentaje_actual);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_HistorialEconomia_operacion_fecha' AND object_id=OBJECT_ID('HistorialEconomiaOperacion'))
  CREATE INDEX IX_HistorialEconomia_operacion_fecha ON HistorialEconomiaOperacion(operacion_id,fecha_modificacion DESC,historial_economia_id DESC);

IF NOT EXISTS(SELECT 1 FROM Entidad WHERE codigo='COSTOS_CERTIFICACIONES')
  INSERT INTO Entidad(codigo,nombre,descripcion,modulo,activo) VALUES('COSTOS_CERTIFICACIONES','Costos y Certificaciones','Economia de operaciones y certificados al cliente','COSTOS',1);

DECLARE @permisos TABLE(codigo VARCHAR(100),nombre VARCHAR(150),descripcion VARCHAR(255));
INSERT INTO @permisos VALUES
('COSTOS_VER','Ver Costos','Acceso al modulo Costos y Certificaciones'),
('ECONOMIA_OPERACION_EDITAR','Editar economia de operacion','Modificar precio cliente y costo responsable'),
('CERTIFICADO_CLIENTE_PREVIEW','Previsualizar certificado cliente','Calcular preview temporal por fecha u operacion'),
('CERTIFICADO_CLIENTE_EMITIR','Emitir certificado cliente','Emitir certificados por delta'),
('CERTIFICADO_CLIENTE_VER','Ver certificados cliente','Consultar listado y detalle historico'),
('CERTIFICADO_CLIENTE_ELIMINAR','Eliminar certificado cliente','Eliminar logicamente el ultimo certificado emitido con auditoria');
INSERT INTO Accion(codigo,nombre,descripcion,modulo,activo)
SELECT p.codigo,p.nombre,p.descripcion,'COSTOS',1 FROM @permisos p WHERE NOT EXISTS(SELECT 1 FROM Accion a WHERE a.codigo=p.codigo);

DECLARE @entidad BIGINT=(SELECT entidad_id FROM Entidad WHERE codigo='COSTOS_CERTIFICACIONES');
INSERT INTO Accion_Rol(rol_id,accion_id,permitido,entidad_id)
SELECT r.rol_id,a.accion_id,1,@entidad FROM Rol r CROSS JOIN Accion a
WHERE UPPER(r.nombre) IN ('ADMIN','ADMINISTRADOR') AND a.codigo IN (SELECT codigo FROM @permisos)
AND NOT EXISTS(SELECT 1 FROM Accion_Rol ar WHERE ar.rol_id=r.rol_id AND ar.accion_id=a.accion_id AND ar.entidad_id=@entidad);

EXEC(N'CREATE OR ALTER TRIGGER TR_Operacion_bloquear_responsable_certificado ON Operacion AFTER UPDATE AS
BEGIN
  SET NOCOUNT ON;
  IF UPDATE(responsable_id) AND EXISTS(
    SELECT 1 FROM inserted i JOIN deleted d ON d.operacion_id=i.operacion_id
    WHERE ISNULL(i.responsable_id,-1)<>ISNULL(d.responsable_id,-1)
      AND EXISTS(SELECT 1 FROM CertificadoClienteDetalle cd JOIN CertificadoCliente cc ON cc.certificado_cliente_id=cd.certificado_cliente_id
                 WHERE cd.operacion_id=i.operacion_id AND cc.estado=''EMITIDO'' AND (cd.porcentaje_actual>0 OR cd.delta>0))
  ) THROW 51001,''No se puede cambiar el responsable de una operacion certificada'',1;
END');

COMMIT TRANSACTION;
