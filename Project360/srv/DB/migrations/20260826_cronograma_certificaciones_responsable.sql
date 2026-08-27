SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('Operacion','cronograma_certificacion_responsable_fecha') IS NULL
  ALTER TABLE Operacion ADD cronograma_certificacion_responsable_fecha DATE NULL;

IF COL_LENGTH('Operacion','numero_certificado_responsable_planificado') IS NULL
  ALTER TABLE Operacion ADD numero_certificado_responsable_planificado INT NULL;

IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_Operacion_cronograma_certificacion_responsable')
  EXEC('ALTER TABLE Operacion ADD CONSTRAINT CK_Operacion_cronograma_certificacion_responsable CHECK(
    (cronograma_certificacion_responsable_fecha IS NULL AND numero_certificado_responsable_planificado IS NULL) OR
    (cronograma_certificacion_responsable_fecha IS NOT NULL AND numero_certificado_responsable_planificado>0)
  )');

IF OBJECT_ID('HistorialCronogramaCertificacionResponsableOperacion','U') IS NULL
BEGIN
  CREATE TABLE HistorialCronogramaCertificacionResponsableOperacion(
    historial_cronograma_responsable_id BIGINT IDENTITY PRIMARY KEY,
    operacion_id BIGINT NOT NULL,
    fecha_anterior DATE NULL,
    numero_anterior INT NULL,
    fecha_nueva DATE NULL,
    numero_nuevo INT NULL,
    motivo NVARCHAR(500) NOT NULL,
    usuario_id BIGINT NOT NULL,
    fecha_modificacion DATETIME2(0) NOT NULL CONSTRAINT DF_HistorialCronogramaResponsable_fecha DEFAULT SYSDATETIME(),
    CONSTRAINT FK_HistorialCronogramaResponsable_operacion FOREIGN KEY(operacion_id) REFERENCES Operacion(operacion_id),
    CONSTRAINT FK_HistorialCronogramaResponsable_usuario FOREIGN KEY(usuario_id) REFERENCES Usuario(usuario_id)
  );
END;

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_Operacion_cronograma_certificacion_responsable' AND object_id=OBJECT_ID('Operacion'))
  EXEC('CREATE INDEX IX_Operacion_cronograma_certificacion_responsable
    ON Operacion(proyecto_id,responsable_id,numero_certificado_responsable_planificado,cronograma_certificacion_responsable_fecha)
    INCLUDE(secuencia,version_id)');

COMMIT TRANSACTION;
