require('dotenv').config();

const { conectarDB, sql } = require('../DB/dbConection');
const certificaciones = require('../services/CertificacionCliente.service');

const PROYECTO_ID = 7;
const NOTA = 'Escenario completo TEST1 2026-08-25';

const primeraMedicion = new Map([
  [100, 100], [200, 40], [300, 20], [400, 10]
]);

const segundaMedicion = new Map([
  [100, 100], [200, 80], [300, 60], [400, 45], [500, 35],
  [550, 30], [560, 25], [570, 20], [600, 10], [700, 5]
]);

const medicionPosterior = new Map([
  [700, 55], [800, 35], [900, 25], [1000, 15], [1100, 5]
]);

async function operacionesActivas(pool) {
  const resultado = await pool.request().input('proyecto', sql.BigInt, PROYECTO_ID).query(`
    SELECT o.operacion_id,o.secuencia,o.pct_avance_actual,o.fecha_inicio_real
    FROM Operacion o
    JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
    WHERE o.proyecto_id=@proyecto AND ISNULL(o.archivada,0)=0
    ORDER BY o.secuencia`);
  return resultado.recordset;
}

async function registrarMedicion(pool, usuarioId, mapaOperaciones, avances, fecha) {
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    for (const [secuencia, porcentaje] of avances) {
      const operacion = mapaOperaciones.get(secuencia);
      if (!operacion) throw new Error(`No existe la operacion ${secuencia}`);
      const anteriorResult = await new sql.Request(tx)
        .input('operacion', sql.BigInt, operacion.operacion_id)
        .input('fecha', sql.Date, fecha)
        .query(`SELECT TOP 1 pct_avance_nuevo
          FROM AvanceOperacion
          WHERE operacion_id=@operacion AND fecha_registro<@fecha
          ORDER BY fecha_registro DESC,fecha_creacion DESC,avance_id DESC`);
      const anterior = Number(anteriorResult.recordset[0]?.pct_avance_nuevo || 0);
      if (porcentaje < anterior) {
        throw new Error(`La operacion ${secuencia} no puede bajar de ${anterior}% a ${porcentaje}%`);
      }
      await new sql.Request(tx)
        .input('operacion', sql.BigInt, operacion.operacion_id)
        .input('proyecto', sql.BigInt, PROYECTO_ID)
        .input('usuario', sql.BigInt, usuarioId)
        .input('nuevo', sql.Decimal(5, 2), porcentaje)
        .input('anterior', sql.Decimal(5, 2), anterior)
        .input('fecha', sql.Date, fecha)
        .input('nota', sql.NVarChar(sql.MAX), NOTA)
        .query(`INSERT INTO AvanceOperacion
          (operacion_id,proyecto_id,registrado_por,pct_avance_nuevo,pct_avance_anterior,
           cantidad_hoy,fecha_registro,es_primer_avance,fecha_inicio_real_declarada,nota,es_correccion)
          VALUES(@operacion,@proyecto,@usuario,@nuevo,@anterior,NULL,@fecha,0,NULL,@nota,0)`);
      await new sql.Request(tx)
        .input('operacion', sql.BigInt, operacion.operacion_id)
        .input('porcentaje', sql.Decimal(5, 2), porcentaje)
        .input('inicio', sql.Date, '2026-08-01')
        .query(`UPDATE Operacion SET pct_avance_actual=@porcentaje,
          fecha_inicio_real=COALESCE(fecha_inicio_real,@inicio),
          estado_id=COALESCE((SELECT TOP 1 estado_id FROM estado_operacion
            WHERE codigo=CASE WHEN @porcentaje=100 THEN 'COMPLETA' ELSE 'EN_CURSO' END),estado_id),
          fecha_actualizacion=SYSDATETIME()
          WHERE operacion_id=@operacion`);
    }
    await tx.commit();
  } catch (error) {
    try { await tx.rollback(); } catch {}
    throw error;
  }
}

async function emitirDesdePreview(pool, usuarioId, fecha, secuenciaCorte, observaciones) {
  const operaciones = await operacionesActivas(pool);
  const corte = operaciones.find(op => Number(op.secuencia) === secuenciaCorte);
  if (!corte) throw new Error(`No existe la operacion de corte ${secuenciaCorte}`);
  const opciones = {
    metodo_corte: 'POR_OPERACION',
    operacion_corte_id: Number(corte.operacion_id),
    fecha_certificacion: fecha
  };
  const preview = await certificaciones.generarPreview(pool, PROYECTO_ID, opciones);
  return certificaciones.emitir(pool, PROYECTO_ID, {
    ...opciones,
    observaciones,
    lineas: preview.lineas
  }, usuarioId);
}

async function main() {
  const pool = await conectarDB();
  const contexto = await pool.request().input('proyecto', sql.BigInt, PROYECTO_ID).query(`
    SELECT proyecto_id,nombre FROM Proyecto WHERE proyecto_id=@proyecto;
    SELECT certificado_cliente_id FROM CertificadoCliente
      WHERE proyecto_id=@proyecto AND estado='EMITIDO';
    SELECT TOP 1 usuario_id,nombre FROM Usuario WHERE activo=1 ORDER BY usuario_id`);
  if (!contexto.recordsets[0].length) throw new Error('Proyecto TEST1 no encontrado');
  if (contexto.recordsets[1].length) throw new Error('TEST1 ya tiene certificados emitidos; no se duplico el escenario');
  const usuario = contexto.recordsets[2][0];
  if (!usuario) throw new Error('No hay un usuario activo para auditar el escenario');

  const operaciones = await operacionesActivas(pool);
  const mapaOperaciones = new Map(operaciones.map(op => [Number(op.secuencia), op]));

  await registrarMedicion(pool, usuario.usuario_id, mapaOperaciones, primeraMedicion, '2026-08-01');
  const certificado1 = await emitirDesdePreview(
    pool, usuario.usuario_id, '2026-08-05', 400,
    'Primera certificacion real del escenario completo TEST1'
  );

  await registrarMedicion(pool, usuario.usuario_id, mapaOperaciones, segundaMedicion, '2026-08-12');
  const certificado2 = await emitirDesdePreview(
    pool, usuario.usuario_id, '2026-08-15', 800,
    'Segunda certificacion real con deltas del escenario completo TEST1'
  );

  await registrarMedicion(pool, usuario.usuario_id, mapaOperaciones, medicionPosterior, '2026-08-20');

  const verificacion = await pool.request().input('proyecto', sql.BigInt, PROYECTO_ID).query(`
    SELECT cc.certificado_cliente_id,cc.fecha_certificacion,cc.metodo_corte,cc.total,cc.estado,
      COUNT(d.detalle_id) operaciones_incluidas,SUM(CASE WHEN d.delta>0 THEN 1 ELSE 0 END) operaciones_con_delta
    FROM CertificadoCliente cc
    JOIN CertificadoClienteDetalle d ON d.certificado_cliente_id=cc.certificado_cliente_id
    WHERE cc.proyecto_id=@proyecto AND cc.estado='EMITIDO'
    GROUP BY cc.certificado_cliente_id,cc.fecha_certificacion,cc.metodo_corte,cc.total,cc.estado
    ORDER BY cc.fecha_certificacion,cc.certificado_cliente_id;

    SELECT o.secuencia,o.pct_avance_actual,
      ISNULL(cert.porcentaje_certificado,0) porcentaje_certificado
    FROM Operacion o
    JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
    OUTER APPLY(SELECT TOP 1 d.porcentaje_actual porcentaje_certificado
      FROM CertificadoClienteDetalle d
      JOIN CertificadoCliente cc ON cc.certificado_cliente_id=d.certificado_cliente_id
      WHERE d.operacion_id=o.operacion_id AND cc.estado='EMITIDO'
      ORDER BY cc.fecha_certificacion DESC,cc.certificado_cliente_id DESC,d.detalle_id DESC) cert
    WHERE o.proyecto_id=@proyecto AND ISNULL(o.archivada,0)=0
    ORDER BY o.secuencia`);

  console.log(JSON.stringify({
    proyecto: contexto.recordsets[0][0],
    certificado1,
    certificado2,
    certificados: verificacion.recordsets[0],
    operaciones: verificacion.recordsets[1]
  }, null, 2));
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
