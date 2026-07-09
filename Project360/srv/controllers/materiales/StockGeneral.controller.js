const { conectarDB, sql } = require('../../DB/dbConection');


// ======================================================
// GET STOCK GENERAL
// ======================================================

const getStockGeneral = async (req, res) => {

    try {

        const pool = await conectarDB();

        const result = await pool.request().query(`
            SELECT
                sg.stock_general_id,
                sg.id_material,
                m.nombre AS material,
                sg.cantidad_total,
                sg.cantidad_disponible,
                sg.cantidad_asignada,
                sg.activo
            FROM StockGeneral sg
            INNER JOIN Materiales m
                ON m.id_material = sg.id_material
            ORDER BY m.nombre
        `);

        res.json(result.recordset);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: 'Error al obtener el stock general',
            error: error.message
        });

    }

};
const asignarStockAProyecto = async (req, res) => {

    let transaction;

    try {

        const {

            stock_general_id,
            proyecto_id,
            cantidad

        } = req.body;

        if (!stock_general_id || !proyecto_id || !cantidad) {

            return res.status(400).json({

                message: 'stock_general_id, proyecto_id y cantidad son obligatorios'

            });

        }

        const pool = await conectarDB();

        const stock = await pool.request()

            .input('stock_general_id', sql.BigInt, stock_general_id)

            .query(`
                SELECT *
                FROM StockGeneral
                WHERE stock_general_id=@stock_general_id
            `);

        if (stock.recordset.length === 0) {

            return res.status(404).json({

                message:'Stock no encontrado'

            });

        }

        const disponible = Number(stock.recordset[0].cantidad_disponible);

        if (Number(cantidad) > disponible) {

            return res.status(400).json({

                message:'La cantidad supera el stock disponible'

            });

        }

        transaction = new sql.Transaction(pool);

        await transaction.begin();

        //-----------------------------------------
        // Descontar Stock General
        //-----------------------------------------

        await new sql.Request(transaction)

            .input('stock_general_id', sql.BigInt, stock_general_id)

            .input('cantidad', sql.Decimal(18,2), cantidad)

            .query(`

                UPDATE StockGeneral

                SET

                    cantidad_disponible = cantidad_disponible - @cantidad,

                    cantidad_asignada = cantidad_asignada + @cantidad

                WHERE stock_general_id=@stock_general_id

            `);

        //-----------------------------------------
        // Buscar container
        //-----------------------------------------

        const container = await new sql.Request(transaction)

            .input('stock_general_id', sql.BigInt, stock_general_id)

            .input('proyecto_id', sql.BigInt, proyecto_id)

            .query(`

                SELECT *

                FROM Conteiner

                WHERE

                    stock_general_id=@stock_general_id

                AND

                    proyecto_id=@proyecto_id

            `);

        if(container.recordset.length>0){

            await new sql.Request(transaction)

                .input('container_id', sql.BigInt, container.recordset[0].container_id)

                .input('cantidad', sql.Decimal(18,2), cantidad)

                .query(`

                    UPDATE Conteiner

                    SET

                        cantidad_disponible = cantidad_disponible + @cantidad

                    WHERE container_id=@container_id

                `);

        }else{

            await new sql.Request(transaction)

                .input('stock_general_id', sql.BigInt, stock_general_id)

                .input('id_material', sql.BigInt, stock.recordset[0].id_material)

                .input('proyecto_id', sql.BigInt, proyecto_id)

                .input('cantidad', sql.Decimal(18,2), cantidad)

                .query(`

                    INSERT INTO Conteiner(

                        stock_general_id,

                        id_material,

                        proyecto_id,

                        cantidad_disponible,

                        activo

                    )

                    VALUES(

                        @stock_general_id,

                        @id_material,

                        @proyecto_id,

                        @cantidad,

                        1

                    )

                `);

        }

        await transaction.commit();

        res.json({

            message:'Material asignado correctamente al proyecto'

        });

    } catch(error){

        if(transaction){

            await transaction.rollback();

        }

        console.error(error);

        res.status(500).json({

            message:'Error al asignar stock',

            error:error.message

        });

    }

};

module.exports = {
    getStockGeneral,asignarStockAProyecto
};