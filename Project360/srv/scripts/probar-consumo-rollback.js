require('dotenv').config({ path: '.env', quiet: true });
const { conectarDB, sql } = require('../DB/dbConection');

async function ejecutar() {
  const pool = await conectarDB();
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const usuario = await new sql.Request(tx).query('SELECT TOP 1 usuario_id FROM Usuario ORDER BY usuario_id');
    if (!usuario.recordset.length) throw new Error('No hay usuarios para la prueba');
    await new sql.Request(tx)
      .input('container_id', sql.BigInt, 15)
      .input('cantidad', sql.Decimal(18,2), 0.01)
      .query('UPDATE Container SET cantidad_actual=cantidad_actual-@cantidad WHERE container_id=@container_id');
    const consumo = await new sql.Request(tx)
      .input('bom_id', sql.BigInt, 91)
      .input('operacion_id', sql.BigInt, 58)
      .input('proyecto_id', sql.BigInt, 4)
      .input('usuario_id', sql.BigInt, usuario.recordset[0].usuario_id)
      .input('uom_id', sql.BigInt, 1)
      .input('container_id', sql.BigInt, 15)
      .input('cantidad', sql.Decimal(18,2), 0.01)
      .input('fecha', sql.Date, new Date())
      .input('nota', sql.NVarChar(sql.MAX), 'PRUEBA ROLLBACK')
      .query(`INSERT INTO ConsumoMaterialOperacion(
        bom_id,operacion_id,proyecto_id,registrado_por,uom_id,
        container_id,cantidad_consumida,fecha_consumo,nota,afecta_stock,anulado
      ) OUTPUT INSERTED.consumo_id VALUES(
        @bom_id,@operacion_id,@proyecto_id,@usuario_id,@uom_id,
        @container_id,@cantidad,@fecha,@nota,1,0
      )`);
    console.log(JSON.stringify({ prueba: 'OK', consumo_temporal: consumo.recordset[0].consumo_id }));
  } finally {
    if (tx._aborted === false) await tx.rollback();
    await pool.close();
  }
}

ejecutar().catch(error => { console.error(error.message); process.exitCode = 1; });
