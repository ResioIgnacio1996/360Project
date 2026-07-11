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
  SELECT c.container_id,c.stock_general_id,sg.id_material,c.id_proyecto,
         c.cantidad_actual AS cantidad_disponible,c.activo,c.nombre AS material
  FROM Container c INNER JOIN StockGeneral sg ON sg.stock_general_id=c.stock_general_id
  WHERE c.id_proyecto=@id AND c.activo=1 ORDER BY c.nombre
`);res.json(result.recordset);}catch(error){res.status(500).json({message:'Error al obtener materiales del proyecto',error:error.message});}};

const devolverStockDeProyecto=async(req,res)=>{let transaction;try{const id=Number(req.body.container_id),cantidad=Number(req.body.cantidad);if(!Number.isInteger(id)||!Number.isFinite(cantidad)||cantidad<=0)return res.status(400).json({message:'Container y cantidad mayor a cero son obligatorios'});const pool=await conectarDB();transaction=new sql.Transaction(pool);await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const result=await new sql.Request(transaction).input('id',sql.BigInt,id).query('SELECT * FROM Container WITH (UPDLOCK,HOLDLOCK) WHERE container_id=@id AND activo=1');if(!result.recordset.length){await transaction.rollback();return res.status(404).json({message:'Material asignado no encontrado'});}const container=result.recordset[0];if(cantidad>Number(container.cantidad_actual)){await transaction.rollback();return res.status(400).json({message:'La devolución supera el stock del proyecto'});}await new sql.Request(transaction).input('id',sql.BigInt,id).input('cantidad',sql.Decimal(18,2),cantidad).query('UPDATE Container SET cantidad_actual=cantidad_actual-@cantidad WHERE container_id=@id');await new sql.Request(transaction).input('id',sql.BigInt,container.stock_general_id).input('cantidad',sql.Decimal(18,2),cantidad).query('UPDATE StockGeneral SET cantidad_disponible=cantidad_disponible+@cantidad,cantidad_asignada=cantidad_asignada-@cantidad WHERE stock_general_id=@id');await transaction.commit();res.json({message:'Material devuelto correctamente al stock general'});}catch(error){if(transaction)try{await transaction.rollback();}catch(_){}res.status(500).json({message:'Error al devolver stock',error:error.message});}};

module.exports={getStockGeneral,asignarStockAProyecto,getStockPorProyecto,devolverStockDeProyecto};
