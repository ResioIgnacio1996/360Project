SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('MovimientoFinancieroProyecto','U') IS NULL
BEGIN
  CREATE TABLE MovimientoFinancieroProyecto(
    movimiento_id BIGINT IDENTITY PRIMARY KEY,
    proyecto_id BIGINT NOT NULL,
    tipo VARCHAR(10) NOT NULL,
    fecha DATE NOT NULL,
    importe DECIMAL(19,4) NOT NULL,
    descripcion NVARCHAR(500) NOT NULL,
    medio_pago NVARCHAR(50) NULL,
    referencia NVARCHAR(100) NULL,
    vinculo_tipo VARCHAR(30) NOT NULL CONSTRAINT DF_MovimientoFinanciero_vinculo DEFAULT 'LIBRE',
    certificado_cliente_id BIGINT NULL,
    registro_compra_id BIGINT NULL,
    certificado_responsable_id BIGINT NULL,
    estado VARCHAR(10) NOT NULL CONSTRAINT DF_MovimientoFinanciero_estado DEFAULT 'ACTIVO',
    creado_por BIGINT NOT NULL,
    fecha_creacion DATETIME2(0) NOT NULL CONSTRAINT DF_MovimientoFinanciero_fecha DEFAULT SYSDATETIME(),
    anulado_por BIGINT NULL,
    fecha_anulacion DATETIME2(0) NULL,
    motivo_anulacion NVARCHAR(500) NULL,
    row_version ROWVERSION,
    CONSTRAINT FK_MovimientoFinanciero_proyecto FOREIGN KEY(proyecto_id) REFERENCES Proyecto(proyecto_id),
    CONSTRAINT FK_MovimientoFinanciero_certificado_cliente FOREIGN KEY(certificado_cliente_id) REFERENCES CertificadoCliente(certificado_cliente_id),
    CONSTRAINT FK_MovimientoFinanciero_registro_compra FOREIGN KEY(registro_compra_id) REFERENCES registroDecompra(registro_compra_id),
    CONSTRAINT FK_MovimientoFinanciero_creador FOREIGN KEY(creado_por) REFERENCES Usuario(usuario_id),
    CONSTRAINT FK_MovimientoFinanciero_anulador FOREIGN KEY(anulado_por) REFERENCES Usuario(usuario_id),
    CONSTRAINT CK_MovimientoFinanciero_tipo CHECK(tipo IN ('INGRESO','EGRESO')),
    CONSTRAINT CK_MovimientoFinanciero_importe CHECK(importe>0),
    CONSTRAINT CK_MovimientoFinanciero_estado CHECK(estado IN ('ACTIVO','ANULADO')),
    CONSTRAINT CK_MovimientoFinanciero_vinculo CHECK(
      (tipo='INGRESO' AND vinculo_tipo IN ('LIBRE','CERTIFICADO_CLIENTE')) OR
      (tipo='EGRESO' AND vinculo_tipo IN ('LIBRE','OC','FAC','CERTIFICADO_RESPONSABLE'))
    ),
    CONSTRAINT CK_MovimientoFinanciero_origen CHECK(
      (vinculo_tipo='LIBRE' AND certificado_cliente_id IS NULL AND registro_compra_id IS NULL AND certificado_responsable_id IS NULL) OR
      (vinculo_tipo='CERTIFICADO_CLIENTE' AND certificado_cliente_id IS NOT NULL AND registro_compra_id IS NULL AND certificado_responsable_id IS NULL) OR
      (vinculo_tipo IN ('OC','FAC') AND certificado_cliente_id IS NULL AND registro_compra_id IS NOT NULL AND certificado_responsable_id IS NULL) OR
      (vinculo_tipo='CERTIFICADO_RESPONSABLE' AND certificado_cliente_id IS NULL AND registro_compra_id IS NULL AND certificado_responsable_id IS NOT NULL)
    ),
    CONSTRAINT CK_MovimientoFinanciero_anulacion CHECK(
      (estado='ACTIVO' AND anulado_por IS NULL AND fecha_anulacion IS NULL AND motivo_anulacion IS NULL) OR
      (estado='ANULADO' AND anulado_por IS NOT NULL AND fecha_anulacion IS NOT NULL AND LEN(LTRIM(RTRIM(motivo_anulacion)))>0)
    )
  );
END;

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_MovimientoFinanciero_proyecto_fecha' AND object_id=OBJECT_ID('MovimientoFinancieroProyecto'))
  CREATE INDEX IX_MovimientoFinanciero_proyecto_fecha ON MovimientoFinancieroProyecto(proyecto_id,fecha DESC,movimiento_id DESC) INCLUDE(tipo,importe,estado,vinculo_tipo);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_MovimientoFinanciero_certificado_cliente' AND object_id=OBJECT_ID('MovimientoFinancieroProyecto'))
  CREATE INDEX IX_MovimientoFinanciero_certificado_cliente ON MovimientoFinancieroProyecto(certificado_cliente_id,estado) INCLUDE(importe,fecha,medio_pago,referencia);

DECLARE @entidad BIGINT=(SELECT entidad_id FROM Entidad WHERE codigo='COSTOS_CERTIFICACIONES');
DECLARE @permisos TABLE(codigo VARCHAR(100),nombre VARCHAR(150),descripcion VARCHAR(255));
INSERT INTO @permisos VALUES
('MOVIMIENTO_FINANCIERO_VER','Ver ingresos y egresos','Consultar movimientos financieros del proyecto'),
('MOVIMIENTO_FINANCIERO_CREAR','Registrar ingresos y egresos','Crear movimientos financieros y cobranzas'),
('MOVIMIENTO_FINANCIERO_ANULAR','Anular ingresos y egresos','Anular movimientos financieros con motivo');
INSERT INTO Accion(codigo,nombre,descripcion,modulo,activo)
SELECT p.codigo,p.nombre,p.descripcion,'COSTOS',1 FROM @permisos p
WHERE NOT EXISTS(SELECT 1 FROM Accion a WHERE a.codigo=p.codigo);
INSERT INTO Accion_Rol(rol_id,accion_id,permitido,entidad_id)
SELECT r.rol_id,a.accion_id,1,@entidad FROM Rol r CROSS JOIN Accion a
WHERE UPPER(r.nombre) IN ('ADMIN','ADMINISTRADOR') AND a.codigo IN (SELECT codigo FROM @permisos)
AND NOT EXISTS(SELECT 1 FROM Accion_Rol ar WHERE ar.rol_id=r.rol_id AND ar.accion_id=a.accion_id AND ar.entidad_id=@entidad);

COMMIT TRANSACTION;
