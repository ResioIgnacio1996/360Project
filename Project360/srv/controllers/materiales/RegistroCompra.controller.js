// controllers/materiales/RegistroCompra.controller.js

const { conectarDB, sql } = require('../../DB/dbConection');


// ======================================================
// FUNCIÓN PRIVADA - OBTENER O CREAR PROVEEDOR
// ======================================================

const obtenerProveedorId = async (transaction, body) => {

    if (body.proveedor_id) {
        const proveedor = await new sql.Request(transaction)
            .input('proveedor_id', sql.BigInt, body.proveedor_id)
            .query(`
                SELECT proveedor_id
                FROM Proveedor
                WHERE proveedor_id = @proveedor_id
            `);

        if (proveedor.recordset.length === 0) {
            throw new Error('Proveedor no encontrado');
        }

        return body.proveedor_id;
    }

    if (!body.proveedor) {
        throw new Error('Debe informar proveedor_id o proveedor');
    }

    if (!body.proveedor.cuit) {
        throw new Error('El CUIT del proveedor es obligatorio');
    }

    const proveedorExistente = await new sql.Request(transaction)
        .input('cuit', sql.VarChar, body.proveedor.cuit)
        .query(`
            SELECT proveedor_id
            FROM Proveedor
            WHERE cuit = @cuit
        `);

    if (proveedorExistente.recordset.length > 0) {
        return proveedorExistente.recordset[0].proveedor_id;
    }

    if (!body.proveedor.razon_social) {
        throw new Error('La razón social del proveedor es obligatoria para crearlo');
    }

    const proveedorNuevo = await new sql.Request(transaction)
        .input('razon_social', sql.VarChar, body.proveedor.razon_social)
        .input('cuit', sql.VarChar, body.proveedor.cuit)
        .input('telefono', sql.VarChar, body.proveedor.telefono || null)
        .input('email', sql.VarChar, body.proveedor.email || null)
        .input('direccion', sql.VarChar, body.proveedor.direccion || null)
        .input('ubicacion', sql.VarChar, body.proveedor.ubicacion || null)
        .input('rubro_id', sql.Int, body.proveedor.rubro_id || 1)
        .query(`
            INSERT INTO Proveedor (
                razon_social,
                cuit,
                telefono,
                email,
                direccion,
                ubicacion,
                rubro_id,
                activo
            )
            OUTPUT INSERTED.proveedor_id
            VALUES (
                @razon_social,
                @cuit,
                @telefono,
                @email,
                @direccion,
                @ubicacion,
                @rubro_id,
                1
            )
        `);

    return proveedorNuevo.recordset[0].proveedor_id;
};


// ======================================================
// FUNCIÓN PRIVADA - OBTENER O CREAR MATERIAL
// ======================================================

const obtenerMaterialId = async (transaction, item) => {

    if (item.id_material) {
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

        return item.id_material;
    }

    const nombreMaterial = item.nombre || item.descripcion;

    if (!nombreMaterial) {
        throw new Error('El material debe tener id_material, nombre o descripcion');
    }

    const materialExistente = await new sql.Request(transaction)
        .input('nombre', sql.VarChar, nombreMaterial)
        .query(`
            SELECT id_material
            FROM Materiales
            WHERE nombre = @nombre
        `);

    if (materialExistente.recordset.length > 0) {
        return materialExistente.recordset[0].id_material;
    }

    const materialNuevo = await new sql.Request(transaction)
        .input('nombre', sql.VarChar, nombreMaterial)
        .input('descripcion', sql.VarChar, item.descripcion || nombreMaterial)
        .input('UoM', sql.VarChar, item.UoM || null)
        .query(`
            INSERT INTO Materiales (
                nombre,
                descripcion,
                UoM
                
            )
            OUTPUT INSERTED.id_material
            VALUES (
                @nombre,
                @descripcion,
                @UoM
                
            )
        `);

    return materialNuevo.recordset[0].id_material;
};


// ======================================================
// GET - LISTAR REGISTROS DE COMPRA
// ======================================================

const getRegistrosCompra = async (req, res) => {
    try {
        const pool = await conectarDB();

        const result = await pool.request().query(`
            SELECT
                rc.estado_registroDeCompra_id,
                rc.numero,
                rc.fecha,
                rc.fecha_entrega,
                rc.observaciones,
                rc.activo,

                p.proveedor_id,
                p.razon_social,

                e.estado_registroDeCompra_id,
                e.nombre AS estado
            FROM RegistroDeCompra rc
            INNER JOIN Proveedor p
                ON p.proveedor_id = rc.proveedor_id
            INNER JOIN estado_registroDecompra e
                ON e.estado_registroDeCompra_id = rc.estado_registroDeCompra_id
            ORDER BY rc.estado_registroDeCompra_id DESC
        `);

        res.json(result.recordset);

    } catch (error) {
        console.error('Error al obtener registros de compra:', error);

        res.status(500).json({
            message: 'Error al obtener registros de compra',
            error: error.message
        });
    }
};


// ======================================================
// GET - REGISTRO DE COMPRA POR ID
// ======================================================

const getRegistroCompraById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await conectarDB();

        const cabecera = await pool.request()
            .input('registro_compra_id', sql.BigInt, id)
            .query(`
        SELECT
            rc.*,
            p.razon_social,
            p.cuit,
            e.nombre AS estado,
            e.nombre AS estado_nombre
        FROM RegistroDeCompra rc
        INNER JOIN Proveedor p
            ON p.proveedor_id = rc.proveedor_id
        INNER JOIN estado_registroDecompra e
            ON e.estado_registroDeCompra_id = rc.estado_registroDeCompra_id
        WHERE rc.registro_compra_id = @registro_compra_id
    `);

        if (cabecera.recordset.length === 0) {
            return res.status(404).json({
                message: 'Registro de compra no encontrado'
            });
        }

        const detalle = await pool.request()
            .input('id_oc', sql.BigInt, id)
            .query(`
        SELECT
            drc.id_detalle_oc,
            drc.id_oc,
            drc.id_material,
            m.nombre AS material,
            drc.cantidad,
            drc.UoM
        FROM Detalle_RegistroDeCompra drc
        INNER JOIN Materiales m
            ON m.id_material = drc.id_material
        WHERE drc.id_oc = @id_oc
       
    `);

        res.json({
            cabecera: cabecera.recordset[0],
            detalle: detalle.recordset
        });

    } catch (error) {
        console.error('Error al obtener registro de compra:', error);

        res.status(500).json({
            message: 'Error al obtener registro de compra',
            error: error.message
        });
    }
};


// ======================================================
// POST - CREAR REGISTRO DE COMPRA CON DETALLE
// ======================================================

const crearRegistroCompra = async (req, res) => {
    let transaction;

    try {
        const {
            numero,
            fecha,
            fecha_entrega,
            observaciones,
            detalle
        } = req.body;

        if (!numero || !fecha) {
            return res.status(400).json({
                message: 'Los campos numero y fecha son obligatorios'
            });
        }

        if (!Array.isArray(detalle) || detalle.length === 0) {
            return res.status(400).json({
                message: 'El registro de compra debe tener al menos un material en el detalle'
            });
        }

        for (const item of detalle) {
            if (!item.cantidad || Number(item.cantidad) <= 0) {
                return res.status(400).json({
                    message: 'Cada detalle debe tener cantidad mayor a cero'
                });
            }

            if (!item.id_material && !item.nombre && !item.descripcion) {
                return res.status(400).json({
                    message: 'Cada detalle debe tener id_material, nombre o descripcion'
                });
            }
        }

        const pool = await conectarDB();

        const estadoCreada = await pool.request()
            .input('nombre', sql.VarChar, 'CREADA')
            .query(`
                SELECT estado_registroDeCompra_id
                FROM estado_registroDecompra
                WHERE nombre = @nombre
            `);

        if (estadoCreada.recordset.length === 0) {
            return res.status(500).json({
                message: 'No existe el estado CREADA en estado_registroDecompra'
            });
        }

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const proveedorId = await obtenerProveedorId(transaction, req.body);

        const insertCabecera = await new sql.Request(transaction)
            .input('numero', sql.VarChar, numero)
            .input('fecha', sql.Date, fecha)
            .input('fecha_entrega', sql.Date, fecha_entrega || null)
            .input('proveedor_id', sql.BigInt, proveedorId)
            .input('observaciones', sql.VarChar, observaciones || null)
            .input(
                'estado_registroDeCompra_id',
                sql.Int,
                estadoCreada.recordset[0].estado_registroDeCompra_id
            )
            .query(`
        INSERT INTO RegistroDeCompra (
            numero,
            fecha,
            fecha_entrega,
            proveedor_id,
            observaciones,
            estado_registroDeCompra_id,
            cantidad_pedida,
            proyecto_id
        )
        OUTPUT INSERTED.registro_compra_id
        VALUES (
            @numero,
            @fecha,
            @fecha_entrega,
            @proveedor_id,
            @observaciones,
            @estado_registroDeCompra_id,
            0,
            1
        )
    `);

        const registroCompraId = insertCabecera.recordset[0].registro_compra_id;

        

        for (const item of detalle) {
            const idMaterial = await obtenerMaterialId(transaction, item);

            await new sql.Request(transaction)
                .input('id_oc', sql.BigInt, registroCompraId)
                .input('id_material', sql.BigInt, idMaterial)
                .input('cantidad', sql.Decimal(18, 2), item.cantidad)
                .input('UoM', sql.VarChar, item.UoM || null)
                .query(`
        INSERT INTO Detalle_RegistroDeCompra (
            id_oc,
            id_material,
            cantidad,
            UoM
        )
        VALUES (
            @id_oc,
            @id_material,
            @cantidad,
            @UoM
        )
    `);
        }

        await transaction.commit();

        res.status(201).json({
            message: 'Registro de compra creado correctamente',
            estado_registroDeCompra_id: registroCompraId,
            proveedor_id: proveedorId
        });

    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }

        console.error('Error al crear registro de compra:', error);

        res.status(500).json({
            message: 'Error al crear registro de compra',
            error: error.message
        });
    }
};


// ======================================================
// PUT - ACTUALIZAR REGISTRO DE COMPRA CON DETALLE
// ======================================================

const actualizarRegistroCompra = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        const {
            numero,
            fecha,
            fecha_entrega,
            observaciones,
            detalle
        } = req.body;

        if (!numero || !fecha) {
            return res.status(400).json({
                message: 'Los campos numero y fecha son obligatorios'
            });
        }

        if (!Array.isArray(detalle) || detalle.length === 0) {
            return res.status(400).json({
                message: 'El registro de compra debe tener al menos un material en el detalle'
            });
        }

        for (const item of detalle) {
            if (!item.cantidad || Number(item.cantidad) <= 0) {
                return res.status(400).json({
                    message: 'Cada detalle debe tener cantidad mayor a cero'
                });
            }

            if (!item.id_material && !item.nombre && !item.descripcion) {
                return res.status(400).json({
                    message: 'Cada detalle debe tener id_material, nombre o descripcion'
                });
            }
        }

        const pool = await conectarDB();

        const registro = await pool.request()
            .input('registro_compra_id', sql.BigInt, id)
            .query(`
                SELECT
                    rc.registro_compra_id,
                    rc.estado_registroDeCompra_id,
                    e.nombre AS estado
                FROM RegistroDeCompra rc
                INNER JOIN estado_registroDecompra e
                    ON e.estado_registroDeCompra_id = rc.estado_registroDeCompra_id
                WHERE rc.registro_compra_id = @registro_compra_id
            `);

        if (registro.recordset.length === 0) {
            return res.status(404).json({
                message: 'Registro de compra no encontrado'
            });
        }

        if (registro.recordset[0].estado === 'COMPLETADA') {
            return res.status(400).json({
                message: 'No se puede editar una registro de compra completada'
            });
        }

        if (registro.recordset[0].estado === 'CANCELADA') {
            return res.status(400).json({
                message: 'No se puede editar una registro de compra cancelada'
            });
        }

        const remitos = await pool.request()
            .input('idRegistroDeCompra', sql.BigInt, id)
            .query(`
                SELECT remito_id
                FROM Remito
                WHERE idRegistroDeCompra = @idRegistroDeCompra
            `);

        if (remitos.recordset.length > 0) {
            return res.status(400).json({
                message: 'No se puede editar una registro de compra con remitos asociados'
            });
        }

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const proveedorId = await obtenerProveedorId(transaction, req.body);

        await new sql.Request(transaction)
            .input('registro_compra_id', sql.BigInt, id)
            .input('numero', sql.VarChar, numero)
            .input('fecha', sql.Date, fecha)
            .input('fecha_entrega', sql.Date, fecha_entrega || null)
            .input('proveedor_id', sql.BigInt, proveedorId)
            .input('observaciones', sql.VarChar, observaciones || null)
            .query(`
                UPDATE RegistroDeCompra
                SET
                    numero = @numero,
                    fecha = @fecha,
                    fecha_entrega = @fecha_entrega,
                    proveedor_id = @proveedor_id,
                    observaciones = @observaciones
                WHERE registro_compra_id = @registro_compra_id
            `);

        await new sql.Request(transaction)
            .input('id_oc', sql.BigInt, id)
            .query(`
                DELETE FROM Detalle_RegistroDeCompra
                WHERE id_oc = @id_oc
            `);

        for (const item of detalle) {
            const idMaterial = await obtenerMaterialId(transaction, item);

            await new sql.Request(transaction)
                .input('id_oc', sql.BigInt, id)
                .input('id_material', sql.BigInt, idMaterial)
                .input('cantidad', sql.Decimal(18, 2), item.cantidad)
                .input('UoM', sql.VarChar, item.UoM || null)
                .query(`
                    INSERT INTO Detalle_RegistroDeCompra (
                        id_oc,
                        id_material,
                        cantidad,
                        UoM
                    )
                    VALUES (
                        @id_oc,
                        @id_material,
                        @cantidad,
                        @UoM
                    )
                `);
        }

        await transaction.commit();

        res.json({
            message: 'Registro de compra actualizado correctamente',
            registro_compra_id: Number(id),
            proveedor_id: proveedorId
        });

    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }

        console.error('Error al actualizar registro de compra:', error);

        res.status(500).json({
            message: 'Error al actualizar registro de compra',
            error: error.message
        });
    }
};


// ======================================================
// PUT - CANCELAR REGISTRO DE COMPRA
// ======================================================

const cancelarRegistroCompra = async (req, res) => {
    try {
        const { id } = req.params;

        const pool = await conectarDB();
console.log(id)
        const registro = await pool.request()
            .input('registro_compra_id', sql.BigInt, id)
            .query(`
                SELECT
                    rc.registro_compra_id,
                    rc.estado_registroDeCompra_id,
                    e.nombre AS estado
                FROM RegistroDeCompra rc
                INNER JOIN estado_registroDecompra e
                    ON e.estado_registroDeCompra_id = rc.estado_registroDeCompra_id
                WHERE rc.registro_compra_id = @registro_compra_id
            `);

        if (registro.recordset.length === 0) {
            return res.status(404).json({
                message: 'Registro de compra no encontrado'
            });
        }

        if (registro.recordset[0].estado === 'COMPLETADA') {
            return res.status(400).json({
                message: 'No se puede cancelar una registro de compra completada'
            });
        }

        if (registro.recordset[0].estado === 'CANCELADA') {
            return res.status(400).json({
                message: 'La registro de compra ya se encuentra cancelada'
            });
        }

        const estadoCancelada = await pool.request()
            .input('nombre', sql.VarChar, 'CANCELADA')
            .query(`
                SELECT estado_registroDeCompra_id
                FROM estado_registroDecompra
                WHERE nombre = @nombre
            `);

        await pool.request()
            .input('registro_compra_id', sql.BigInt, id)
            .input('estado_cancelada_id', sql.Int, estadoCancelada.recordset[0].estado_registroDeCompra_id)
            .query(`
                UPDATE RegistroDeCompra
                SET estado_registroDeCompra_id = @estado_cancelada_id
                WHERE registro_compra_id = @registro_compra_id
            `);

        res.json({
            message: 'Registro de compra cancelado correctamente'
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error al cancelar registro de compra',
            error: error.message
        });
    }
};


module.exports = {
    getRegistrosCompra,
    getRegistroCompraById,
    crearRegistroCompra,
    actualizarRegistroCompra,
    cancelarRegistroCompra
};