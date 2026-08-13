const { conectarDB, sql } = require('../../DB/dbConection');

const getStockGeneral = async (_req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool.request().query(`
      SELECT sg.stock_general_id,sg.id_material,m.nombre AS material,
             sg.cantidad_total,sg.cantidad_disponible,sg.cantidad_asignada,sg.activo
      FROM StockGeneral sg INNER JOIN Materiales m ON m.id_material=sg.id_material
      ORDER BY m.nombre
    `);
    res.json(result.recordset);
  } catch (error) { res.status(500).json({message:'Error al obtener el stock general',error:error.message}); }
};

const asignarStockAProyecto = async (req, res) => {
  let transaction;
  try {
    const stockId=Number(req.body.stock_general_id), proyectoId=Number(req.body.proyecto_id), cantidad=Number(req.body.cantidad);
    if(!Number.isInteger(stockId)||!Number.isInteger(proyectoId)||!Number.isFinite(cantidad)||cantidad<=0)
      return res.status(400).json({message:'Stock, proyecto y una cantidad mayor a cero son obligatorios'});
    const pool=await conectarDB(); transaction=new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const stock=await new sql.Request(transaction).input('id',sql.BigInt,stockId).query(`
      SELECT sg.*,m.nombre AS material FROM StockGeneral sg WITH (UPDLOCK,HOLDLOCK)
      INNER JOIN Materiales m ON m.id_material=sg.id_material
      WHERE sg.stock_general_id=@id AND sg.activo=1
    `);
    if(!stock.recordset.length){await transaction.rollback();return res.status(404).json({message:'Stock no encontrado'});}
    if(cantidad>Number(stock.recordset[0].cantidad_disponible)){await transaction.rollback();return res.status(400).json({message:'La cantidad supera el stock disponible'});}
    const proyecto=await new sql.Request(transaction).input('id',sql.BigInt,proyectoId).query('SELECT proyecto_id FROM Proyecto WHERE proyecto_id=@id');
    if(!proyecto.recordset.length){await transaction.rollback();return res.status(404).json({message:'Proyecto no encontrado'});}
    await new sql.Request(transaction).input('id',sql.BigInt,stockId).input('cantidad',sql.Decimal(18,2),cantidad).query(`
      UPDATE StockGeneral SET cantidad_disponible=cantidad_disponible-@cantidad,
      cantidad_asignada=cantidad_asignada+@cantidad WHERE stock_general_id=@id
    `);
    const container=await new sql.Request(transaction).input('stock_id',sql.BigInt,stockId).input('proyecto_id',sql.BigInt,proyectoId).query(`
      SELECT container_id FROM Container WITH (UPDLOCK,HOLDLOCK)
      WHERE stock_general_id=@stock_id AND id_proyecto=@proyecto_id
    `);
    if(container.recordset.length){
      await new sql.Request(transaction).input('id',sql.BigInt,container.recordset[0].container_id).input('cantidad',sql.Decimal(18,2),cantidad)
        .query('UPDATE Container SET cantidad_actual=cantidad_actual+@cantidad,activo=1 WHERE container_id=@id');
    }else{
      await new sql.Request(transaction).input('stock_id',sql.BigInt,stockId).input('proyecto_id',sql.BigInt,proyectoId)
        .input('nombre',sql.NVarChar(200),stock.recordset[0].material).input('cantidad',sql.Decimal(18,2),cantidad).query(`
          INSERT INTO Container(stock_general_id,id_proyecto,nombre,cantidad_actual,activo)
          VALUES(@stock_id,@proyecto_id,@nombre,@cantidad,1)
        `);
    }
    await transaction.commit(); res.json({message:'Material asignado correctamente al proyecto'});
  }catch(error){if(transaction)try{await transaction.rollback();}catch(_){} console.error('Error al asignar stock:',error);res.status(500).json({message:'Error al asignar stock',error:error.message});}
};

const getStockPorProyecto=async(req,res)=>{try{const pool=await conectarDB();const result=await pool.request().input('id',sql.BigInt,req.params.proyectoId).query(`
  SELECT MIN(sg.stock_general_id) AS stock_general_id,sg.id_material,c.id_proyecto,
         SUM(c.cantidad_actual) AS cantidad_disponible,
         CAST(1 AS bit) AS activo,
         COALESCE(m.nombre,MAX(c.nombre)) AS material,
         u.nombre AS uom_nombre,
         COUNT_BIG(*) AS cantidad_lotes
  FROM Container c
  INNER JOIN StockGeneral sg ON sg.stock_general_id=c.stock_general_id
  LEFT JOIN Materiales m ON m.id_material=sg.id_material
  LEFT JOIN UoM u ON u.uom_id=m.uom_id
  WHERE c.id_proyecto=@id AND c.activo=1
  GROUP BY sg.id_material,c.id_proyecto,m.nombre,u.nombre
  ORDER BY COALESCE(m.nombre,MAX(c.nombre))
`);res.json(result.recordset);}catch(error){res.status(500).json({message:'Error al obtener materiales del proyecto',error:error.message});}};

const getMovimientosMaterialProyecto = async (req, res) => {
  const proyectoId = Number(req.params.proyectoId);
  const materialId = Number(req.params.materialId);
  if (!Number.isInteger(proyectoId) || proyectoId <= 0 || !Number.isInteger(materialId) || materialId <= 0) {
    return res.status(400).json({ message: 'Proyecto y material válidos son obligatorios' });
  }

  try {
    const pool = await conectarDB();
    const result = await pool.request()
      .input('proyecto_id', sql.BigInt, proyectoId)
      .input('material_id', sql.BigInt, materialId)
      .query(`
        SELECT
          p.proyecto_id,
          p.nombre AS proyecto_nombre,
          m.id_material,
          m.nombre AS material,
          u.nombre AS uom_nombre,
          ISNULL(SUM(c.cantidad_actual),0) AS stock_actual,
          COUNT_BIG(c.container_id) AS cantidad_lotes
        FROM Proyecto p
        CROSS JOIN Materiales m
        LEFT JOIN UoM u ON u.uom_id=m.uom_id
        LEFT JOIN StockGeneral sg ON sg.id_material=m.id_material
        LEFT JOIN Container c
          ON c.stock_general_id=sg.stock_general_id
         AND c.id_proyecto=p.proyecto_id
         AND c.activo=1
        WHERE p.proyecto_id=@proyecto_id
          AND m.id_material=@material_id
        GROUP BY p.proyecto_id,p.nombre,m.id_material,m.nombre,u.nombre;

        SELECT movimientos.*
        FROM (
          SELECT
            'INGRESO' AS tipo,
            lrd.liberacion_detalle_id AS movimiento_id,
            lrd.fecha_liberacion AS fecha,
            lrd.cantidad,
            CAST(NULL AS bigint) AS operacion_id,
            CAST(NULL AS int) AS operacion_secuencia,
            CAST(NULL AS nvarchar(200)) AS operacion_nombre,
            r.numero AS remito_numero,
            CONCAT('LiberaciÃ³n desde remito ',r.numero) AS detalle,
            CAST(0 AS bit) AS anulado
          FROM LiberacionRemitoDetalle lrd
          JOIN Detalle_Remito dr ON dr.detalle_remito_id=lrd.detalle_remito_id
          JOIN Remito r ON r.remito_id=dr.remito_id
          WHERE lrd.proyecto_id=@proyecto_id
            AND lrd.material_id=@material_id
            AND lrd.activo=1

          UNION ALL

          SELECT
            'CONSUMO' AS tipo,
            cm.consumo_id AS movimiento_id,
            COALESCE(CAST(cm.fecha_consumo AS datetime2),cm.fecha_creacion) AS fecha,
            cm.cantidad_consumida AS cantidad,
            o.operacion_id,
            o.secuencia AS operacion_secuencia,
            o.nombre AS operacion_nombre,
            CAST(NULL AS nvarchar(500)) AS remito_numero,
            cm.nota AS detalle,
            cm.anulado
          FROM ConsumoMaterialOperacion cm
          JOIN Container c ON c.container_id=cm.container_id
          JOIN StockGeneral sg ON sg.stock_general_id=c.stock_general_id
          JOIN Operacion o ON o.operacion_id=cm.operacion_id
          WHERE cm.proyecto_id=@proyecto_id
            AND sg.id_material=@material_id
            AND cm.afecta_stock=1
        ) movimientos
        ORDER BY movimientos.fecha DESC,movimientos.movimiento_id DESC;
      `);

    if (!result.recordsets[0].length) {
      return res.status(404).json({ message: 'No se encontró el material para este proyecto' });
    }

    res.json({
      ...result.recordsets[0][0],
      movimientos: result.recordsets[1]
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los movimientos del material', error: error.message });
  }
};

const devolverStockDeProyecto=async(req,res)=>{let transaction;try{const id=Number(req.body.container_id),cantidad=Number(req.body.cantidad);if(!Number.isInteger(id)||!Number.isFinite(cantidad)||cantidad<=0)return res.status(400).json({message:'Container y cantidad mayor a cero son obligatorios'});const pool=await conectarDB();transaction=new sql.Transaction(pool);await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const result=await new sql.Request(transaction).input('id',sql.BigInt,id).query('SELECT * FROM Container WITH (UPDLOCK,HOLDLOCK) WHERE container_id=@id AND activo=1');if(!result.recordset.length){await transaction.rollback();return res.status(404).json({message:'Material asignado no encontrado'});}const container=result.recordset[0];if(cantidad>Number(container.cantidad_actual)){await transaction.rollback();return res.status(400).json({message:'La devolución supera el stock del proyecto'});}await new sql.Request(transaction).input('id',sql.BigInt,id).input('cantidad',sql.Decimal(18,2),cantidad).query('UPDATE Container SET cantidad_actual=cantidad_actual-@cantidad WHERE container_id=@id');await new sql.Request(transaction).input('id',sql.BigInt,container.stock_general_id).input('cantidad',sql.Decimal(18,2),cantidad).query('UPDATE StockGeneral SET cantidad_disponible=cantidad_disponible+@cantidad,cantidad_asignada=cantidad_asignada-@cantidad WHERE stock_general_id=@id');await transaction.commit();res.json({message:'Material devuelto correctamente al stock general'});}catch(error){if(transaction)try{await transaction.rollback();}catch(_){}res.status(500).json({message:'Error al devolver stock',error:error.message});}};

module.exports={getStockGeneral,asignarStockAProyecto,getStockPorProyecto,getMovimientosMaterialProyecto,devolverStockDeProyecto};
