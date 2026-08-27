require('dotenv').config();
const assert = require('node:assert/strict');
const { conectarDB, sql } = require('../DB/dbConection');

(async () => {
  const pool = await conectarDB();
  const inicial = await pool.request().query(`
    SELECT TOP 1 proyecto_id,nombre FROM Proyecto WHERE UPPER(nombre) LIKE '%IRE%' ORDER BY proyecto_id;
    SELECT TOP 1 usuario_id FROM Usuario WHERE activo=1 ORDER BY usuario_id;
  `);
  assert.ok(inicial.recordsets[0].length, 'No se encontro el proyecto IRE');
  assert.ok(inicial.recordsets[1].length, 'No hay un usuario activo para validar la auditoria');
  const proyectoId = Number(inicial.recordsets[0][0].proyecto_id);
  const usuarioId = Number(inicial.recordsets[1][0].usuario_id);
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  let ultimo;
  let anterior;
  try {
    const cadena = await new sql.Request(tx).input('p', sql.BigInt, proyectoId).query(`
      SELECT certificado_cliente_id,fecha_certificacion,estado
      FROM CertificadoCliente WITH(UPDLOCK,HOLDLOCK)
      WHERE proyecto_id=@p AND estado='EMITIDO'
      ORDER BY fecha_certificacion DESC,certificado_cliente_id DESC;
    `);
    assert.ok(cadena.recordset.length >= 2, 'IRE necesita al menos dos certificados para validar el fallback');
    ultimo = cadena.recordset[0];
    anterior = cadena.recordset[1];
    await new sql.Request(tx)
      .input('id', sql.BigInt, ultimo.certificado_cliente_id)
      .input('u', sql.BigInt, usuarioId)
      .query(`UPDATE CertificadoCliente SET estado='ELIMINADO',eliminado_por=@u,
        fecha_eliminacion=SYSDATETIME(),motivo_eliminacion='Prueba automatica con rollback'
        WHERE certificado_cliente_id=@id`);
    const fallback = await new sql.Request(tx).input('p', sql.BigInt, proyectoId).query(`
      SELECT TOP 1 certificado_cliente_id,fecha_certificacion
      FROM CertificadoCliente WHERE proyecto_id=@p AND estado='EMITIDO'
      ORDER BY fecha_certificacion DESC,certificado_cliente_id DESC;

      SELECT o.operacion_id,referencia.certificado_cliente_id
      FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
      OUTER APPLY(SELECT TOP 1 cc.certificado_cliente_id
        FROM CertificadoClienteDetalle d JOIN CertificadoCliente cc ON cc.certificado_cliente_id=d.certificado_cliente_id
        WHERE d.operacion_id=o.operacion_id AND cc.estado='EMITIDO'
        ORDER BY cc.fecha_certificacion DESC,cc.certificado_cliente_id DESC,d.detalle_id DESC) referencia
      WHERE o.proyecto_id=@p AND ISNULL(o.archivada,0)=0;
    `);
    assert.equal(Number(fallback.recordsets[0][0].certificado_cliente_id), Number(anterior.certificado_cliente_id));
    assert.ok(fallback.recordsets[1].every(fila =>
      Number(fila.certificado_cliente_id) === Number(anterior.certificado_cliente_id)),
    'Todas las operaciones de IRE deben volver a tomar el certificado anterior');
    await tx.rollback();
  } catch (error) {
    try { await tx.rollback(); } catch {}
    throw error;
  }
  const restaurado = await pool.request().input('id', sql.BigInt, ultimo.certificado_cliente_id).query(`
    SELECT estado,eliminado_por,fecha_eliminacion,motivo_eliminacion
    FROM CertificadoCliente WHERE certificado_cliente_id=@id;
  `);
  assert.equal(restaurado.recordset[0].estado, 'EMITIDO');
  assert.equal(restaurado.recordset[0].eliminado_por, null);
  assert.equal(restaurado.recordset[0].fecha_eliminacion, null);
  assert.equal(restaurado.recordset[0].motivo_eliminacion, null);
  console.log(JSON.stringify({
    ok: true,
    proyecto: inicial.recordsets[0][0],
    certificado_eliminado_en_prueba: Number(ultimo.certificado_cliente_id),
    fallback_verificado: Number(anterior.certificado_cliente_id),
    rollback: true,
    estado_final: 'EMITIDO'
  }, null, 2));
  await pool.close();
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
