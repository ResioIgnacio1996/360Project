require('dotenv').config();
const assert = require('node:assert/strict');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { conectarDB, sql } = require('../DB/dbConection');

(async () => {
  const pool = await conectarDB();
  try {
    const datos = await pool.request().query(`
      SELECT TOP 1 u.usuario_id,u.empresa_id,u.usuario,u.rol_id,r.nombre rol_nombre
      FROM Usuario u JOIN Rol r ON r.rol_id=u.rol_id
      WHERE u.activo=1 AND UPPER(r.nombre) IN ('ADMIN','ADMINISTRADOR')
      ORDER BY u.usuario_id;
      SELECT TOP 1 p.proyecto_id
      FROM Proyecto p
      WHERE p.activo=1 AND p.eliminado=0 AND UPPER(p.estado)='ACTIVO' AND p.cliente_id IS NOT NULL
        AND EXISTS(SELECT 1 FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
          WHERE o.proyecto_id=p.proyecto_id AND ISNULL(o.archivada,0)=0)
      ORDER BY p.proyecto_id;
      SELECT TOP 2 cc.proyecto_id,cc.certificado_cliente_id
      FROM CertificadoCliente cc JOIN Proyecto p ON p.proyecto_id=cc.proyecto_id
      WHERE UPPER(p.nombre) LIKE '%IRE%' AND cc.estado='EMITIDO'
      ORDER BY cc.fecha_certificacion DESC,cc.certificado_cliente_id DESC;
    `);
    assert.ok(datos.recordsets[0].length, 'No hay un usuario administrador activo para validar middleware');
    assert.ok(datos.recordsets[1].length, 'No hay un proyecto apto para validar endpoints');
    const usuario = datos.recordsets[0][0];
    const proyectoId = Number(datos.recordsets[1][0].proyecto_id);
    const token = jwt.sign(usuario, process.env.JWT_SECRET, { expiresIn: '5m' });
    const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { Authorization: `Bearer ${token}` } });

    await assert.rejects(
      axios.get(`http://localhost:3000/api/economia-operaciones/proyectos/${proyectoId}/operaciones`),
      error => error.response?.status === 401
    );
    const permisos = await api.get('/economia-operaciones/permisos');
    assert.ok(permisos.data.includes('COSTOS_VER'));
    assert.ok(permisos.data.includes('ECONOMIA_OPERACION_EDITAR'));
    assert.ok(permisos.data.includes('CERTIFICADO_CLIENTE_ELIMINAR'));
    const economia = await api.get(`/economia-operaciones/proyectos/${proyectoId}/operaciones`);
    assert.ok(economia.data.operaciones.length);
    const fecha = new Date().toISOString().slice(0, 10);
    const previewFecha = await api.post(`/certificados-cliente/proyectos/${proyectoId}/preview`, {
      metodo_corte: 'POR_FECHA', fecha_certificacion: fecha
    });
    assert.equal(previewFecha.data.metodo_corte, 'POR_FECHA');
    const operacionCorte = economia.data.operaciones[economia.data.operaciones.length - 1];
    const previewOperacion = await api.post(`/certificados-cliente/proyectos/${proyectoId}/preview`, {
      metodo_corte: 'POR_OPERACION', fecha_certificacion: fecha,
      operacion_corte_id: operacionCorte.operacion_id
    });
    assert.equal(previewOperacion.data.metodo_corte, 'POR_OPERACION');
    assert.equal(Number(previewOperacion.data.operacion_corte.operacion_id), Number(operacionCorte.operacion_id));
    const primera = economia.data.operaciones[0];
    const csv = `secuencia,precio_cliente,costo_responsable\n${primera.secuencia},${Number(primera.precio_cliente).toFixed(4)},${Number(primera.costo_responsable).toFixed(4)}`;
    const previewCsv = await api.post(`/economia-operaciones/proyectos/${proyectoId}/importacion/preview`, { contenido_csv: csv });
    assert.equal(previewCsv.data.filas_con_error, 0);
    assert.equal(previewCsv.data.filas[0].operacion_nombre, primera.nombre);
    const certificados = await api.get(`/certificados-cliente/proyectos/${proyectoId}`);
    assert.ok(Array.isArray(certificados.data));
    await assert.rejects(
      api.delete(`/certificados-cliente/proyectos/${proyectoId}/999999999`, { data: { motivo: 'Prueba de certificado inexistente' } }),
      error => error.response?.status === 404
    );
    let eliminacionIntermedia = 'omitida';
    if (datos.recordsets[2].length === 2) {
      const noUltimo = datos.recordsets[2][1];
      await assert.rejects(
        api.delete(`/certificados-cliente/proyectos/${noUltimo.proyecto_id}/${noUltimo.certificado_cliente_id}`, { data: { motivo: 'Prueba de proteccion de cadena' } }),
        error => error.response?.status === 409 && /ultimo certificado/.test(error.response?.data?.message || '')
      );
      eliminacionIntermedia = 'rechazada con 409';
    }

    console.log(JSON.stringify({
      ok: true,
      autenticacion: { sin_token: 401, token_temporal: 'aceptado' },
      permisos: permisos.data,
      proyecto_id: proyectoId,
      endpoints: {
        economia: economia.status,
        preview_por_fecha: previewFecha.status,
        preview_por_operacion: previewOperacion.status,
        preview_csv: previewCsv.status,
        historial_certificados: certificados.status,
        eliminar_inexistente: 404
      },
      eliminacion_intermedia: eliminacionIntermedia
    }, null, 2));
  } finally {
    await pool.close();
  }
})().catch(error => {
  console.error(error.response?.data || error);
  process.exitCode = 1;
});
