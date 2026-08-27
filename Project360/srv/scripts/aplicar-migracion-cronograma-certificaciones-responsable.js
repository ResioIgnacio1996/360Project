const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { conectarDB } = require('../DB/dbConection');

(async () => {
  const pool = await conectarDB();
  try {
    const migration = fs.readFileSync(
      path.join(__dirname, '../DB/migrations/20260826_cronograma_certificaciones_responsable.sql'),
      'utf8'
    );
    await pool.request().batch(migration);
    console.log('Migracion de cronograma de certificaciones a responsables aplicada correctamente');
  } finally {
    await pool.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
