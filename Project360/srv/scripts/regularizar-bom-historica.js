require('dotenv').config({ path: '.env', quiet: true });
const { conectarDB, sql } = require('../DB/dbConection');

const aplicar = process.argv.includes('--apply');
const normalizar = valor => String(valor ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();

async function ejecutar() {
  const pool = await conectarDB();
  const tx = new sql.Transaction(pool);
  try {
    const datos = await pool.request().query(`
      SELECT b.bom_id,b.descripcion_libre,b.uom_id,u.nombre AS uom_nombre
      FROM BomOperacion b
      JOIN UoM u ON u.uom_id=b.uom_id
      WHERE b.material_id IS NULL
      ORDER BY b.bom_id;
      SELECT m.id_material,m.nombre,m.uom_id,u.nombre AS uom_nombre
      FROM Materiales m
      LEFT JOIN UoM u ON u.uom_id=m.uom_id;
    `);
    const lineas = datos.recordsets[0];
    const materiales = datos.recordsets[1];
    const grupos = new Map();
    for (const linea of lineas) {
      const clave = normalizar(linea.descripcion_libre);
      if (!clave) throw new Error(`La linea BOM ${linea.bom_id} no tiene descripcion`);
      const grupo = grupos.get(clave) || { descripcion: String(linea.descripcion_libre).trim().replace(/\s+/g, ' '), uomIds: new Set(), uoms: new Set(), lineas: [] };
      grupo.uomIds.add(Number(linea.uom_id));
      grupo.uoms.add(normalizar(linea.uom_nombre));
      grupo.lineas.push(Number(linea.bom_id));
      grupos.set(clave, grupo);
    }

    const catalogo = new Map(materiales.map(m => [normalizar(m.nombre), m]));
    const conflictos = [];
    const resumen = { lineas: lineas.length, grupos: grupos.size, reutilizados: 0, nuevos: 0, uomCompletadas: 0 };
    for (const [clave, grupo] of grupos) {
      if (grupo.uomIds.size !== 1 || grupo.uoms.size !== 1) {
        conflictos.push(`${grupo.descripcion}: aparece con mas de una UOM en la BOM`);
        continue;
      }
      const existente = catalogo.get(clave);
      if (!existente) { resumen.nuevos++; continue; }
      resumen.reutilizados++;
      if (existente.uom_id == null) resumen.uomCompletadas++;
      else if (Number(existente.uom_id) !== [...grupo.uomIds][0])
        conflictos.push(`${grupo.descripcion}: BOM=${[...grupo.uoms][0]}, maestro=${existente.uom_nombre}`);
    }

    console.log(JSON.stringify({ modo: aplicar ? 'APLICAR' : 'SIMULACION', resumen, conflictos }, null, 2));
    if (conflictos.length) throw new Error('La regularizacion tiene conflictos de UOM; no se aplico ningun cambio');
    if (!aplicar || !lineas.length) return;

    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    for (const grupo of grupos.values()) {
      const uomId = [...grupo.uomIds][0];
      const existente = await new sql.Request(tx)
        .input('descripcion', sql.NVarChar(200), grupo.descripcion)
        .query(`SELECT TOP 1 id_material,uom_id,nombre FROM Materiales WITH (UPDLOCK,HOLDLOCK)
                WHERE nombre_normalizado=dbo.fn_NormalizarClave(@descripcion)`);
      let materialId;
      if (existente.recordset.length) {
        const material = existente.recordset[0];
        if (material.uom_id == null) {
          await new sql.Request(tx).input('id', sql.BigInt, material.id_material).input('uom', sql.BigInt, uomId)
            .query('UPDATE Materiales SET uom_id=@uom WHERE id_material=@id AND uom_id IS NULL');
        } else if (Number(material.uom_id) !== uomId) {
          throw new Error(`Conflicto de UOM para ${material.nombre}`);
        }
        materialId = material.id_material;
      } else {
        const creado = await new sql.Request(tx)
          .input('nombre', sql.NVarChar(200), grupo.descripcion)
          .input('uom', sql.BigInt, uomId)
          .query(`INSERT INTO Materiales(nombre,descripcion,uom_id)
                  OUTPUT INSERTED.id_material VALUES(@nombre,@nombre,@uom)`);
        materialId = creado.recordset[0].id_material;
      }
      for (const bomId of grupo.lineas) {
        await new sql.Request(tx).input('bom', sql.BigInt, bomId).input('material', sql.BigInt, materialId)
          .query(`UPDATE BomOperacion SET material_id=@material,sin_codigo=0,fecha_actualizacion=SYSDATETIME()
                  WHERE bom_id=@bom AND material_id IS NULL`);
      }
    }
    await tx.commit();
    console.log('REGULARIZACION_APLICADA');
  } catch (error) {
    if (tx._aborted === false) try { await tx.rollback(); } catch {}
    throw error;
  } finally { await pool.close(); }
}

ejecutar().catch(error => { console.error(error.message); process.exitCode = 1; });
