const { conectarDB, sql } = require('../../DB/dbConection');


// ======================================================
// GET - LISTAR REMITOS
// ======================================================

const getRemitos = async (req, res) => {
    try {
        const pool = await conectarDB();

        const result = await pool.request().query(`
            SELECT
                r.remito_id,
                r.numero,
                r.fecha,
                r.liberado,
                r.idRegistroDeCompra,
                p.razon_social
            FROM Remito r
            INNER JOIN RegistroDeCompra rc
                ON rc.registro_compra_id = r.idRegistroDeCompra
            INNER JOIN Proveedor p
                ON p.proveedor_id = rc.proveedor_id
            ORDER BY r.remito_id DESC
        `);

        res.json(result.recordset);

    } catch (error) {
        console.error('Error al obtener remitos:', error);

        res.status(500).json({
            message: 'Error al obtener remitos',
            error: error.message
        });
    }
};


// ======================================================
// GET - REMITO POR ID
// ======================================================

const getRemitoById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await conectarDB();

        const cabecera = await pool.request()
            .input('remito_id', sql.BigInt, id)
            .query(`
                SELECT
                    r.*
                FROM Remito r
                WHERE r.remito_id = @remito_id
            `);

        if (cabecera.recordset.length === 0) {
            return res.status(404).json({
                message: 'Remito no encontrado'
            });
        }

        const detalle = await pool.request()
            .input('remito_id', sql.BigInt, id)
            .query(`
                SELECT
                    dr.detalle_remito_id,
                    dr.remito_id,
                    dr.id_material,
                    m.nombre AS material,
                    dr.cantidad,
                    dr.UoM
                FROM Detalle_Remito dr
                INNER JOIN Materiales m
                    ON m.id_material = dr.id_material
                WHERE dr.remito_id = @remito_id
            `);

        res.json({
            cabecera: cabecera.recordset[0],
            detalle: detalle.recordset
        });

    } catch (error) {
        console.error('Error al obtener remito:', error);

        res.status(500).json({
            message: 'Error al obtener remito',
            error: error.message
        });
    }
};


// ======================================================
// GET - REMITOS POR REGISTRO DE COMPRA
// ======================================================

const getRemitosByRegistroCompra = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await conectarDB();

        const result = await pool.request()
            .input('idRegistroDeCompra', sql.BigInt, id)
            .query(`
                SELECT
                    remito_id,
                    numero,
                    fecha,
                    liberado,
                    idRegistroDeCompra
                FROM Remito
                WHERE idRegistroDeCompra = @idRegistroDeCompra
                ORDER BY remito_id DESC
            `);

        res.json(result.recordset);

    } catch (error) {
        console.error('Error al obtener remitos por registro de compra:', error);

        res.status(500).json({
            message: 'Error al obtener remitos por registro de compra',
            error: error.message
        });
    }
};


// ======================================================
// POST - CREAR REMITO CON DETALLE
// ======================================================

const crearRemito = async (req, res) => {
    let transaction;

    try {
        const {
            numero,
            fecha,
            idRegistroDeCompra,
            detalle
        } = req.body;

        if (!numero || !fecha || !idRegistroDeCompra) {
            return res.status(400).json({
                message: 'numero, fecha e idRegistroDeCompra son obligatorios'
            });
        }

        if (!Array.isArray(detalle) || detalle.length === 0) {
            return res.status(400).json({
                message: 'El remito debe tener al menos un material'
            });
        }

        for (const item of detalle) {
            if (!item.id_material || !item.cantidad || Number(item.cantidad) <= 0) {
                return res.status(400).json({
                    message: 'Cada detalle debe tener id_material y cantidad mayor a cero'
                });
            }
        }

        const pool = await conectarDB();

        const registroCompra = await pool.request()
            .input('registro_compra_id', sql.BigInt, idRegistroDeCompra)
            .query(`
                SELECT registro_compra_id
                FROM RegistroDeCompra
                WHERE registro_compra_id = @registro_compra_id
            `);

        if (registroCompra.recordset.length === 0) {
            return res.status(404).json({
                message: 'Registro de compra no encontrado'
            });
        }

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const insertRemito = await new sql.Request(transaction)
            .input('numero', sql.VarChar, numero)
            .input('fecha', sql.Date, fecha)
            .input('idRegistroDeCompra', sql.BigInt, idRegistroDeCompra)
            .query(`
                INSERT INTO Remito (
                    numero,
                    fecha,
                    idRegistroDeCompra,
                    liberado,
                    activo
                )
                OUTPUT INSERTED.remito_id
                VALUES (
                    @numero,
                    @fecha,
                    @idRegistroDeCompra,
                    0,
                    1
                )
            `);

        const remitoId = insertRemito.recordset[0].remito_id;

        for (const item of detalle) {
            const material = await new sql.Request(transaction)
                .input('id_material', sql.BigInt, item.id_material)
                .query(`
                    SELECT id_material
                    FROM Materiales
                    WHERE id_material = @id_material
                `);

            if (material.recordset.length === 0) {
                throw new Error(`Material no encontrado: ${item.id_material}`);
            }

            await new sql.Request(transaction)
                .input('remito_id', sql.BigInt, remitoId)
                .input('id_material', sql.BigInt, item.id_material)
                .input('cantidad', sql.Decimal(18, 2), item.cantidad)
                .input('UoM', sql.VarChar, item.UoM || null)
                .query(`
                    INSERT INTO Detalle_Remito (
                        remito_id,
                        id_material,
                        cantidad,
                        UoM
                    )
                    VALUES (
                        @remito_id,
                        @id_material,
                        @cantidad,
                        @UoM
                    )
                `);
        }

        await transaction.commit();

        res.status(201).json({
            message: 'Remito creado correctamente',
            remito_id: remitoId
        });

    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }

        console.error('Error al crear remito:', error);

        res.status(500).json({
            message: 'Error al crear remito',
            error: error.message
        });
    }
};


// ======================================================
// PUT - LIBERAR REMITO
// ======================================================

const liberarRemito = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        const pool = await conectarDB();

        const remito = await pool.request()
            .input('remito_id', sql.BigInt, id)
            .query(`
                SELECT
                    remito_id,
                    idRegistroDeCompra,
                    liberado
                FROM Remito
                WHERE remito_id = @remito_id
            `);

        if (remito.recordset.length === 0) {
            return res.status(404).json({
                message: 'Remito no encontrado'
            });
        }

        if (remito.recordset[0].liberado) {
            return res.status(400).json({
                message: 'El remito ya fue liberado'
            });
        }

        const detalle = await pool.request()
            .input('remito_id', sql.BigInt, id)
            .query(`
                SELECT
                    dr.detalle_remito_id,
                    dr.id_material,
                    dr.cantidad,
                    dr.UoM,
                    m.nombre AS material
                FROM Detalle_Remito dr
                LEFT JOIN Materiales m
                    ON m.id_material = dr.id_material
                WHERE dr.remito_id = @remito_id
            `);

        if (detalle.recordset.length === 0) {
            return res.status(400).json({
                message: 'El remito no tiene detalle'
            });
        }

        for (const item of detalle.recordset) {
            if (!item.id_material) {
                return res.status(400).json({
                    message: `El detalle ${item.detalle_remito_id} no tiene id_material`
                });
            }

            if (!item.material) {
                return res.status(400).json({
                    message: `El material ${item.id_material} no existe en la tabla Materiales`
                });
            }

            if (!item.cantidad || Number(item.cantidad) <= 0) {
                return res.status(400).json({
                    message: `El detalle ${item.detalle_remito_id} tiene cantidad inválida`
                });
            }
        }

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        for (const item of detalle.recordset) {
            const stockExistente = await new sql.Request(transaction)
                .input('id_material', sql.BigInt, item.id_material)
                .query(`
                    SELECT stock_general_id
                    FROM StockGeneral
                    WHERE id_material = @id_material
                `);

            if (stockExistente.recordset.length > 0) {
                await new sql.Request(transaction)
                    .input('id_material', sql.BigInt, item.id_material)
                    .input('cantidad', sql.Decimal(18, 2), item.cantidad)
                    .query(`
                        UPDATE StockGeneral
                        SET
                            cantidad_total = cantidad_total + @cantidad,
                            cantidad_disponible = cantidad_disponible + @cantidad
                        WHERE id_material = @id_material
                    `);
            } else {
                await new sql.Request(transaction)
                    .input('id_material', sql.BigInt, item.id_material)
                    .input('cantidad', sql.Decimal(18, 2), item.cantidad)
                    .query(`
                        INSERT INTO StockGeneral (
                            id_material,
                            cantidad_total,
                            cantidad_disponible,
                            cantidad_asignada,
                            activo
                        )
                        VALUES (
                            @id_material,
                            @cantidad,
                            @cantidad,
                            0,
                            1
                        )
                    `);
            }
        }

        await new sql.Request(transaction)
            .input('remito_id', sql.BigInt, id)
            .query(`
        UPDATE Remito
        SET liberado = 1
        WHERE remito_id = @remito_id
    `);

        const nuevoEstado = await recalcularEstadoRegistroCompra(
            transaction,
            remito.recordset[0].idRegistroDeCompra
        );

        await transaction.commit();

        res.json({
            message: 'Remito liberado correctamente. Stock general actualizado.',
            estado_registro_compra: nuevoEstado
        });
        await transaction.commit();

        res.json({
            message: 'Remito liberado correctamente. Stock general actualizado.'
        });

    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }

        console.error('Error al liberar remito:', error);

        res.status(500).json({
            message: 'Error al liberar remito',
            error: error.message
        });
    }
};

const recalcularEstadoRegistroCompra = async (transaction, idRegistroDeCompra) => {

    const cantidades = await new sql.Request(transaction)
        .input('registro_compra_id', sql.BigInt, idRegistroDeCompra)
        .query(`
            SELECT
                drc.id_material,
                drc.cantidad AS cantidad_pedida,
                ISNULL(SUM(
                    CASE 
                        WHEN r.liberado = 1 THEN dr.cantidad 
                        ELSE 0 
                    END
                ), 0) AS cantidad_recibida
            FROM Detalle_RegistroDeCompra drc
            LEFT JOIN Remito r
                ON r.idRegistroDeCompra = drc.id_oc
            LEFT JOIN Detalle_Remito dr
                ON dr.remito_id = r.remito_id
                AND dr.id_material = drc.id_material
            WHERE drc.id_oc = @registro_compra_id
            GROUP BY
                drc.id_material,
                drc.cantidad
        `);

    if (cantidades.recordset.length === 0) {
        throw new Error('La registro de compra no tiene detalle');
    }

    const todosRecibidos = cantidades.recordset.every(item =>
        Number(item.cantidad_recibida) >= Number(item.cantidad_pedida)
    );

    const algunoRecibido = cantidades.recordset.some(item =>
        Number(item.cantidad_recibida) > 0
    );

    let estadoNombre = 'CREADA';

    if (todosRecibidos) {
        estadoNombre = 'COMPLETADA';
    } else if (algunoRecibido) {
        estadoNombre = 'PARCIAL';
    }

    const estado = await new sql.Request(transaction)
        .input('nombre', sql.VarChar, estadoNombre)
        .query(`
            SELECT estado_registroDeCompra_id
            FROM estado_registroDecompra
            WHERE nombre = @nombre
        `);

    if (estado.recordset.length === 0) {
        throw new Error(`No existe el estado ${estadoNombre}`);
    }

    await new sql.Request(transaction)
        .input('registro_compra_id', sql.BigInt, idRegistroDeCompra)
        .input('estado_registroDeCompra_id', sql.Int, estado.recordset[0].estado_registroDeCompra_id)
        .query(`
            UPDATE RegistroDeCompra
            SET estado_registroDeCompra_id = @estado_registroDeCompra_id
            WHERE registro_compra_id = @registro_compra_id
        `);

    return estadoNombre;
};
module.exports = {
    getRemitos,
    getRemitoById,
    getRemitosByRegistroCompra,
    crearRemito,
    liberarRemito
};