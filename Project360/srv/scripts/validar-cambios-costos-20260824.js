require('dotenv').config();
const assert = require('node:assert/strict');
const { conectarDB, sql } = require('../DB/dbConection');
const certificaciones = require('../services/CertificacionCliente.service');
const importacion = require('../services/ImportacionCostos.service');

const fechaISO = value => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : String(value || '').slice(0, 10);

(async () => {
  const pool = await conectarDB();
  try {
    const contexto = await pool.request().query(`
      SELECT TOP 1 p.proyecto_id,p.nombre
      FROM Proyecto p
      WHERE p.activo=1 AND p.eliminado=0 AND UPPER(p.estado)='ACTIVO' AND p.cliente_id IS NOT NULL
        AND EXISTS(SELECT 1 FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
          WHERE o.proyecto_id=p.proyecto_id AND ISNULL(o.archivada,0)=0)
      ORDER BY p.proyecto_id;
    `);
    assert.ok(contexto.recordset.length, 'No hay un proyecto activo con cliente y operaciones para validar');
    const proyecto = contexto.recordset[0];
    const datos = await pool.request().input('p', sql.BigInt, proyecto.proyecto_id).query(`
      SELECT o.operacion_id,o.secuencia,o.nombre,o.precio_cliente,o.costo_responsable,
             CONVERT(varchar(34),o.economia_row_version,1) economia_version
      FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
      WHERE o.proyecto_id=@p AND ISNULL(o.archivada,0)=0 ORDER BY o.secuencia;
      SELECT TOP 1 fecha_certificacion FROM CertificadoCliente
      WHERE proyecto_id=@p AND estado='EMITIDO' ORDER BY fecha_certificacion DESC,certificado_cliente_id DESC;
      SELECT COUNT(*) cantidad FROM CertificadoCliente WHERE proyecto_id=@p;
    `);
    const operaciones = datos.recordsets[0];
    const hoy = fechaISO(new Date());
    const ultima = fechaISO(datos.recordsets[1][0]?.fecha_certificacion);
    const fecha = ultima && ultima > hoy ? ultima : hoy;

    const porFecha = await certificaciones.generarPreview(pool, proyecto.proyecto_id, {
      metodo_corte: 'POR_FECHA', fecha_certificacion: fecha
    });
    assert.ok(porFecha.lineas.every(linea => linea.fecha_inicio_corte <= fecha),
      'El corte por fecha incluyo una operacion posterior al corte');

    const corte = operaciones[operaciones.length - 1];
    const porOperacion = await certificaciones.generarPreview(pool, proyecto.proyecto_id, {
      metodo_corte: 'POR_OPERACION', fecha_certificacion: fecha,
      operacion_corte_id: corte.operacion_id
    });
    const esperadas = operaciones.filter(op => Number(op.secuencia) <= Number(corte.secuencia));
    assert.deepEqual(porOperacion.lineas.map(linea => Number(linea.operacion_id)),
      esperadas.map(op => Number(op.operacion_id)),
      'El corte por operacion no respeto secuencia menor o igual');

    const primera = operaciones[0];
    const csvSinCambios = `secuencia,precio_cliente,costo_responsable\n${primera.secuencia},${Number(primera.precio_cliente).toFixed(4)},${Number(primera.costo_responsable).toFixed(4)}`;
    const vistaCsv = await importacion.previsualizar(pool, proyecto.proyecto_id, csvSinCambios);
    assert.equal(vistaCsv.filas_con_error, 0);
    assert.equal(vistaCsv.filas[0].operacion_nombre, primera.nombre);
    assert.equal(vistaCsv.filas_con_cambios, 0);

    const auditoriaAntes = await pool.request().input('o', sql.BigInt, primera.operacion_id)
      .query('SELECT COUNT(*) cantidad FROM HistorialEconomiaOperacion WHERE operacion_id=@o');
    const importacionNoOp = await importacion.importar(pool, proyecto.proyecto_id, csvSinCambios, 1);
    assert.equal(importacionNoOp.operaciones_actualizadas, 0);

    const csvInvalido = `secuencia,precio_cliente,costo_responsable\n${primera.secuencia},${(Number(primera.precio_cliente) + 1).toFixed(4)},${Number(primera.costo_responsable).toFixed(4)}\n999999999,1,1`;
    await assert.rejects(
      importacion.importar(pool, proyecto.proyecto_id, csvInvalido, 1),
      error => error.status === 422
    );
    const despuesCsv = await pool.request().input('o', sql.BigInt, primera.operacion_id).query(`
      SELECT precio_cliente,costo_responsable,CONVERT(varchar(34),economia_row_version,1) economia_version
      FROM Operacion WHERE operacion_id=@o;
      SELECT COUNT(*) cantidad FROM HistorialEconomiaOperacion WHERE operacion_id=@o;
    `);
    assert.equal(Number(despuesCsv.recordsets[0][0].precio_cliente), Number(primera.precio_cliente));
    assert.equal(Number(despuesCsv.recordsets[0][0].costo_responsable), Number(primera.costo_responsable));
    assert.equal(despuesCsv.recordsets[0][0].economia_version, primera.economia_version);
    assert.equal(despuesCsv.recordsets[1][0].cantidad, auditoriaAntes.recordset[0].cantidad);

    const cantidadCertificadosAntes = datos.recordsets[2][0].cantidad;
    const lineasObsoletas = porOperacion.lineas.map((linea, i) => ({
      operacion_id: linea.operacion_id,
      porcentaje_actual: linea.porcentaje_actual,
      motivo_modificacion: null,
      base: i === 0 ? { ...linea.base, economia_version: '0xDEADBEEF' } : linea.base
    }));
    await assert.rejects(certificaciones.emitir(pool, proyecto.proyecto_id, {
      metodo_corte: 'POR_OPERACION', fecha_certificacion: fecha,
      operacion_corte_id: corte.operacion_id, lineas: lineasObsoletas
    }, 1), error => error.status === 409 && /desactualizado/.test(error.message));
    const certificadosDespues = await pool.request().input('p', sql.BigInt, proyecto.proyecto_id)
      .query('SELECT COUNT(*) cantidad FROM CertificadoCliente WHERE proyecto_id=@p');
    assert.equal(certificadosDespues.recordset[0].cantidad, cantidadCertificadosAntes,
      'La prueba de concurrencia dejo un certificado persistido');

    console.log(JSON.stringify({
      ok: true,
      proyecto,
      fecha_certificacion_prueba: fecha,
      corte_por_fecha: { operaciones: porFecha.lineas.length },
      corte_por_operacion: {
        operacion_corte: porOperacion.operacion_corte,
        operaciones: porOperacion.lineas.length
      },
      csv: {
        preview_valido: true,
        no_op_sin_auditoria: true,
        archivo_invalido_revertido: true
      },
      concurrencia: { preview_obsoleto_rechazado: true, certificado_persistido: false }
    }, null, 2));
  } finally {
    await pool.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
