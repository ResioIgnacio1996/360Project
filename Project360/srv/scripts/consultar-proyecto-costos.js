require('dotenv').config();
const { conectarDB, sql } = require('../DB/dbConection');

(async () => {
  const patron = String(process.argv[2] || '').trim();
  const resumen = process.argv.includes('--resumen');
  if (!patron) throw new Error('Informe parte del nombre del proyecto');
  const pool = await conectarDB();
  try {
    const result = await pool.request().input('patron', sql.NVarChar(200), `%${patron}%`).query(`
      SELECT proyecto_id,nombre,estado,activo,eliminado
      FROM Proyecto WHERE UPPER(nombre) LIKE UPPER(@patron) ORDER BY proyecto_id;

      SELECT cc.certificado_cliente_id,cc.proyecto_id,cc.fecha_certificacion,cc.metodo_corte,
             cc.total,cc.estado,COUNT(d.detalle_id) lineas
      FROM CertificadoCliente cc
      LEFT JOIN CertificadoClienteDetalle d ON d.certificado_cliente_id=cc.certificado_cliente_id
      WHERE cc.proyecto_id IN (SELECT proyecto_id FROM Proyecto WHERE UPPER(nombre) LIKE UPPER(@patron))
      GROUP BY cc.certificado_cliente_id,cc.proyecto_id,cc.fecha_certificacion,cc.metodo_corte,cc.total,cc.estado
      ORDER BY cc.proyecto_id,cc.fecha_certificacion,cc.certificado_cliente_id;

      SELECT o.operacion_id,o.proyecto_id,o.secuencia,o.nombre,e.nombre etapa_nombre,
             o.precio_cliente,o.costo_responsable
      FROM Operacion o
      JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
      JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id
      WHERE o.proyecto_id IN (SELECT proyecto_id FROM Proyecto WHERE UPPER(nombre) LIKE UPPER(@patron))
        AND ISNULL(o.archivada,0)=0
      ORDER BY o.proyecto_id,o.secuencia;

      SELECT u.usuario,u.nombre,r.nombre rol_nombre,
        CASE WHEN EXISTS(SELECT 1 FROM Accion_Rol ar JOIN Accion a ON a.accion_id=ar.accion_id
          JOIN Entidad e ON e.entidad_id=ar.entidad_id
          WHERE ar.rol_id=u.rol_id AND ar.permitido=1 AND a.codigo='CERTIFICADO_CLIENTE_ELIMINAR'
            AND e.codigo='COSTOS_CERTIFICACIONES') THEN 1 ELSE 0 END puede_eliminar_certificados
      FROM Usuario u JOIN Rol r ON r.rol_id=u.rol_id
      WHERE UPPER(u.usuario) LIKE UPPER(@patron);

      SELECT TOP 100 o.secuencia,o.nombre,h.campo_modificado,h.valor_anterior,h.valor_nuevo,
             h.motivo,h.fecha_modificacion,u.usuario
      FROM HistorialEconomiaOperacion h JOIN Operacion o ON o.operacion_id=h.operacion_id
      JOIN Proyecto p ON p.proyecto_id=o.proyecto_id JOIN Usuario u ON u.usuario_id=h.usuario_id
      WHERE UPPER(p.nombre) LIKE UPPER(@patron)
      ORDER BY h.fecha_modificacion DESC,h.historial_economia_id DESC;
    `);
    console.log(JSON.stringify({
      proyectos: result.recordsets[0],
      certificados: result.recordsets[1],
      operaciones: resumen ? undefined : result.recordsets[2],
      usuario: result.recordsets[3],
      historial_economia: result.recordsets[4]
    }, null, 2));
  } finally {
    await pool.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
