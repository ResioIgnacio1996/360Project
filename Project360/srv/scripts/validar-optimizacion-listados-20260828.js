require('dotenv').config();
const assert = require('node:assert/strict');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { conectarDB } = require('../DB/dbConection');

(async () => {
  const pool = await conectarDB();
  try {
    const datos = await pool.request().query(`
      SELECT TOP 1 u.usuario_id,u.empresa_id,u.usuario,u.rol_id,r.nombre rol_nombre
      FROM Usuario u JOIN Rol r ON r.rol_id=u.rol_id
      WHERE u.activo=1 AND UPPER(r.nombre) IN ('ADMIN','ADMINISTRADOR') ORDER BY u.usuario_id;
      SELECT TOP 1 o.proyecto_id,o.operacion_id
      FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
      WHERE ISNULL(o.archivada,0)=0 ORDER BY o.operacion_id;
    `);
    assert.ok(datos.recordsets[0].length, 'No hay administrador activo para validar la API');
    assert.ok(datos.recordsets[1].length, 'No hay operaciones activas para validar Avances');

    const token = jwt.sign(datos.recordsets[0][0], process.env.JWT_SECRET, { expiresIn: '5m' });
    const api = axios.create({
      baseURL: 'http://localhost:3000/api',
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000
    });
    const medir = async ruta => {
      const inicio = process.hrtime.bigint();
      const respuesta = await api.get(ruta);
      return {
        respuesta,
        duracion_ms: Number((Number(process.hrtime.bigint() - inicio) / 1e6).toFixed(2)),
        bytes_json: Buffer.byteLength(JSON.stringify(respuesta.data))
      };
    };

    const comprasLegacy = await medir('/registro-compra');
    const comprasPagina = await medir('/registro-compra?page=0&pageSize=10&sort=fecha&direction=desc');
    assert.ok(Array.isArray(comprasLegacy.respuesta.data));
    assert.equal(comprasPagina.respuesta.data.page.total, comprasLegacy.respuesta.data.length);
    assert.ok(comprasPagina.respuesta.data.data.length <= 10);

    const remitosLegacy = await medir('/remitos');
    const remitosPagina = await medir('/remitos?page=0&pageSize=10&sort=fecha&direction=desc');
    assert.ok(Array.isArray(remitosLegacy.respuesta.data));
    assert.equal(remitosPagina.respuesta.data.page.total, remitosLegacy.respuesta.data.length);
    assert.ok(remitosPagina.respuesta.data.data.length <= 10);

    await assert.rejects(
      api.get('/registro-compra?page=0&pageSize=10&sort=DROP_TABLE'),
      error => error.response?.status === 400
    );

    const { proyecto_id: proyectoId, operacion_id: operacionId } = datos.recordsets[1][0];
    const avancesInicial = await medir(`/avance-operaciones/proyectos/${proyectoId}`);
    assert.ok(Array.isArray(avancesInicial.respuesta.data.operaciones));
    assert.equal('avances' in avancesInicial.respuesta.data, false);
    assert.equal('bom' in avancesInicial.respuesta.data, false);
    assert.equal('consumos' in avancesInicial.respuesta.data, false);
    const detalleAvances = await medir(`/avance-operaciones/operaciones/${operacionId}/avances?pagina=1&limite=5`);
    const detalleConsumos = await medir(`/avance-operaciones/operaciones/${operacionId}/consumos?pagina=1&limite=10`);
    assert.ok(detalleAvances.respuesta.data.avances.length <= 5);
    assert.ok(detalleConsumos.respuesta.data.consumos.length <= 10);

    console.log(JSON.stringify({
      ok: true,
      compras: {
        total: comprasPagina.respuesta.data.page.total,
        legacy: { duracion_ms: comprasLegacy.duracion_ms, bytes_json: comprasLegacy.bytes_json },
        pagina_10: { duracion_ms: comprasPagina.duracion_ms, bytes_json: comprasPagina.bytes_json }
      },
      remitos: {
        total: remitosPagina.respuesta.data.page.total,
        legacy: { duracion_ms: remitosLegacy.duracion_ms, bytes_json: remitosLegacy.bytes_json },
        pagina_10: { duracion_ms: remitosPagina.duracion_ms, bytes_json: remitosPagina.bytes_json }
      },
      avances: {
        operaciones: avancesInicial.respuesta.data.operaciones.length,
        inicial: { duracion_ms: avancesInicial.duracion_ms, bytes_json: avancesInicial.bytes_json },
        avances_pagina: { duracion_ms: detalleAvances.duracion_ms, bytes_json: detalleAvances.bytes_json },
        consumos_pagina: { duracion_ms: detalleConsumos.duracion_ms, bytes_json: detalleConsumos.bytes_json }
      }
    }, null, 2));
  } finally {
    await pool.close();
  }
})().catch(error => {
  console.error(error.response?.data || error);
  process.exitCode = 1;
});
