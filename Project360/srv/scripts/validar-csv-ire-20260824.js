require('dotenv').config();
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { conectarDB } = require('../DB/dbConection');
const { previsualizar } = require('../services/ImportacionCostos.service');

(async () => {
  const archivo = path.join(__dirname, '../../output/COSTOS_OPERACIONES_IRE001_20260824.csv');
  const contenido = fs.readFileSync(archivo, 'utf8');
  const pool = await conectarDB();
  try {
    const preview = await previsualizar(pool, 8, contenido);
    assert.equal(preview.total_filas, 19);
    assert.equal(preview.filas_validas, 19);
    assert.equal(preview.filas_con_error, 0);
    assert.equal(preview.filas_con_cambios, 0);
    console.log(JSON.stringify({
      ok: true,
      proyecto: preview.proyecto.nombre,
      archivo,
      filas: preview.total_filas,
      errores: preview.filas_con_error,
      cambios_al_importar: preview.filas_con_cambios
    }, null, 2));
  } finally {
    await pool.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
