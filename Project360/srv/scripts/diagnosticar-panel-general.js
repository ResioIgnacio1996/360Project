require('dotenv').config();
const { conectarDB } = require('../DB/dbConection');
const panel = require('../services/PanelGeneral.service');

(async () => {
  try {
    const pool = await conectarDB();
    const proyectos = await pool.request().query(`SELECT TOP 10 proyecto_id,nombre FROM Proyecto WHERE ISNULL(eliminado,0)=0 ORDER BY proyecto_id DESC`);
    console.log('Proyectos:', proyectos.recordset);
    for (const proyecto of proyectos.recordset) {
      try {
        const resultado = await panel.obtener(pool, Number(proyecto.proyecto_id), { fecha_corte: '2026-08-31', etapa_id: null, responsable_id: null, ventana_dias: 30 });
        console.log('OK', proyecto.proyecto_id, resultado.kpis);
      } catch (error) {
        console.error('ERROR', proyecto.proyecto_id, error.message, error.number || '', error.lineNumber || '');
      }
    }
    await pool.close();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
