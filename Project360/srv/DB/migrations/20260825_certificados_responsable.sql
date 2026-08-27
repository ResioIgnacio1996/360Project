SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('CertificadoResponsable','U') IS NULL
BEGIN
  CREATE TABLE CertificadoResponsable(
    certificado_responsable_id BIGINT IDENTITY PRIMARY KEY,
    proyecto_id BIGINT NOT NULL,
    responsable_id BIGINT NOT NULL,
    metodo_corte VARCHAR(20) NOT NULL,
    operacion_corte_id BIGINT NULL,
    fecha_certificacion DATE NOT NULL,
    total DECIMAL(19,4) NOT NULL,
    estado VARCHAR(20) NOT NULL CONSTRAINT DF_CertificadoResponsable_estado DEFAULT 'EMITIDO',
    observaciones NVARCHAR(1000) NULL,
    creado_por BIGINT NOT NULL,
    fecha_creacion DATETIME2(0) NOT NULL CONSTRAINT DF_CertificadoResponsable_fecha DEFAULT SYSDATETIME(),
    eliminado_por BIGINT NULL,
    fecha_eliminacion DATETIME2(0) NULL,
    motivo_eliminacion NVARCHAR(500) NULL,
    row_version ROWVERSION,
    CONSTRAINT FK_CertificadoResponsable_proyecto FOREIGN KEY(proyecto_id) REFERENCES Proyecto(proyecto_id),
    CONSTRAINT FK_CertificadoResponsable_responsable FOREIGN KEY(responsable_id) REFERENCES ResponsableOperacion(responsable_id),
    CONSTRAINT FK_CertificadoResponsable_operacion_corte FOREIGN KEY(operacion_corte_id) REFERENCES Operacion(operacion_id),
    CONSTRAINT FK_CertificadoResponsable_creador FOREIGN KEY(creado_por) REFERENCES Usuario(usuario_id),
    CONSTRAINT FK_CertificadoResponsable_eliminador FOREIGN KEY(eliminado_por) REFERENCES Usuario(usuario_id),
    CONSTRAINT CK_CertificadoResponsable_metodo CHECK(metodo_corte IN ('POR_FECHA','POR_OPERACION')),
    CONSTRAINT CK_CertificadoResponsable_corte CHECK(
      (metodo_corte='POR_FECHA' AND operacion_corte_id IS NULL) OR
      (metodo_corte='POR_OPERACION' AND operacion_corte_id IS NOT NULL)),
    CONSTRAINT CK_CertificadoResponsable_total CHECK(total>=0),
    CONSTRAINT CK_CertificadoResponsable_estado CHECK(estado IN ('EMITIDO','ELIMINADO')),
    CONSTRAINT CK_CertificadoResponsable_eliminacion CHECK(
      (estado='ELIMINADO' AND eliminado_por IS NOT NULL AND fecha_eliminacion IS NOT NULL AND LEN(LTRIM(RTRIM(motivo_eliminacion)))>0) OR
      (estado='EMITIDO' AND eliminado_por IS NULL AND fecha_eliminacion IS NULL AND motivo_eliminacion IS NULL))
  );
END;

IF OBJECT_ID('CertificadoResponsableDetalle','U') IS NULL
BEGIN
  CREATE TABLE CertificadoResponsableDetalle(
    detalle_id BIGINT IDENTITY PRIMARY KEY,
    certificado_responsable_id BIGINT NOT NULL,
    operacion_id BIGINT NOT NULL,
    secuencia_aplicada INT NOT NULL,
    avance_fisico_referencia DECIMAL(7,3) NOT NULL,
    porcentaje_anterior DECIMAL(7,3) NOT NULL,
    porcentaje_actual DECIMAL(7,3) NOT NULL,
    delta DECIMAL(7,3) NOT NULL,
    costo_responsable_aplicado DECIMAL(19,4) NOT NULL,
    importe DECIMAL(19,4) NOT NULL,
    etapa_id_aplicada BIGINT NULL,
    etapa_nombre_aplicada NVARCHAR(200) NULL,
    etapa_orden_aplicado SMALLINT NULL,
    peso_operacion_aplicado DECIMAL(5,2) NULL,
    modificado_manualmente BIT NOT NULL CONSTRAINT DF_CertificadoResponsableDetalle_manual DEFAULT 0,
    motivo_modificacion NVARCHAR(500) NULL,
    CONSTRAINT FK_CertificadoResponsableDetalle_certificado FOREIGN KEY(certificado_responsable_id) REFERENCES CertificadoResponsable(certificado_responsable_id),
    CONSTRAINT FK_CertificadoResponsableDetalle_operacion FOREIGN KEY(operacion_id) REFERENCES Operacion(operacion_id),
    CONSTRAINT UQ_CertificadoResponsableDetalle_operacion UNIQUE(certificado_responsable_id,operacion_id),
    CONSTRAINT CK_CertificadoResponsableDetalle_porcentajes CHECK(
      avance_fisico_referencia BETWEEN 0 AND 100 AND porcentaje_anterior BETWEEN 0 AND 100 AND
      porcentaje_actual BETWEEN 0 AND 100 AND delta>=0 AND porcentaje_actual>=porcentaje_anterior),
    CONSTRAINT CK_CertificadoResponsableDetalle_importes CHECK(costo_responsable_aplicado>=0 AND importe>=0),
    CONSTRAINT CK_CertificadoResponsableDetalle_motivo CHECK(
      modificado_manualmente=0 OR LEN(LTRIM(RTRIM(motivo_modificacion)))>0)
  );
END;

IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_MovimientoFinanciero_certificado_responsable')
  EXEC('ALTER TABLE MovimientoFinancieroProyecto ADD CONSTRAINT FK_MovimientoFinanciero_certificado_responsable FOREIGN KEY(certificado_responsable_id) REFERENCES CertificadoResponsable(certificado_responsable_id)');

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_CertificadoResponsable_proyecto_responsable_fecha' AND object_id=OBJECT_ID('CertificadoResponsable'))
  CREATE INDEX IX_CertificadoResponsable_proyecto_responsable_fecha ON CertificadoResponsable(proyecto_id,responsable_id,fecha_certificacion DESC,certificado_responsable_id DESC) INCLUDE(estado,total);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_CertificadoResponsableDetalle_operacion' AND object_id=OBJECT_ID('CertificadoResponsableDetalle'))
  CREATE INDEX IX_CertificadoResponsableDetalle_operacion ON CertificadoResponsableDetalle(operacion_id,certificado_responsable_id DESC) INCLUDE(porcentaje_actual);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_MovimientoFinanciero_certificado_responsable' AND object_id=OBJECT_ID('MovimientoFinancieroProyecto'))
  CREATE INDEX IX_MovimientoFinanciero_certificado_responsable ON MovimientoFinancieroProyecto(certificado_responsable_id,estado) INCLUDE(importe,fecha,medio_pago,referencia);

DECLARE @entidad BIGINT=(SELECT entidad_id FROM Entidad WHERE codigo='COSTOS_CERTIFICACIONES');
DECLARE @permisos TABLE(codigo VARCHAR(100),nombre VARCHAR(150),descripcion VARCHAR(255));
INSERT INTO @permisos VALUES
('CERTIFICADO_RESPONSABLE_PREVIEW','Previsualizar certificado responsable','Calcular certificado por responsable y delta'),
('CERTIFICADO_RESPONSABLE_EMITIR','Emitir certificado responsable','Emitir certificados a contratistas y cuadrillas'),
('CERTIFICADO_RESPONSABLE_VER','Ver certificados responsable','Consultar certificados y pagos del responsable'),
('CERTIFICADO_RESPONSABLE_ELIMINAR','Eliminar certificado responsable','Eliminar el ultimo certificado vigente del responsable');
INSERT INTO Accion(codigo,nombre,descripcion,modulo,activo)
SELECT p.codigo,p.nombre,p.descripcion,'COSTOS',1 FROM @permisos p
WHERE NOT EXISTS(SELECT 1 FROM Accion a WHERE a.codigo=p.codigo);
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
      AND (
        EXISTS(SELECT 1 FROM CertificadoClienteDetalle cd JOIN CertificadoCliente cc ON cc.certificado_cliente_id=cd.certificado_cliente_id
          WHERE cd.operacion_id=i.operacion_id AND cc.estado=''EMITIDO'' AND (cd.porcentaje_actual>0 OR cd.delta>0))
        OR EXISTS(SELECT 1 FROM CertificadoResponsableDetalle rd JOIN CertificadoResponsable cr ON cr.certificado_responsable_id=rd.certificado_responsable_id
          WHERE rd.operacion_id=i.operacion_id AND cr.estado=''EMITIDO'' AND (rd.porcentaje_actual>0 OR rd.delta>0))
      )
  ) THROW 51001,''No se puede cambiar el responsable de una operacion certificada'',1;
END');

COMMIT TRANSACTION;
