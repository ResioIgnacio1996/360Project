const { conectarDB, sql } = require('../../DB/dbConection');

const ESTADOS_REMITO_HABILITADOS = ['CREADA', 'PARCIAL', 'PARCIAL CON DEMORAS'];

const crearHttpError = (message, statusCode = 500) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const responderError = (res, error, contexto) => {
    console.error(contexto, error);

    res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || contexto,
        error: error.message
    });
};

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
                rc.numero AS registro_compra_numero,
                p.proveedor_id,
                p.razon_social,
                e.nombre AS estado_registro_compra
            FROM Remito r
            INNER JOIN registroDecompra rc
                ON rc.registro_compra_id = r.idRegistroDeCompra
            INNER JOIN Proveedor p
                ON p.proveedor_id = rc.proveedor_id
            LEFT JOIN estado_registroDecompra e
                ON e.estado_registroDecompra_id = rc.estado_registroDecompra_id
            WHERE ISNULL(r.activo, 1) = 1
            ORDER BY r.remito_id DESC
        `);

        res.json(result.recordset);

    } catch (error) {
        responderError(res, error, 'Error al obtener remitos');
    }
};

const getRemitoById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await conectarDB();

        const cabecera = await pool.request()
            .input('remito_id', sql.BigInt, id)
            .query(`
                SELECT
                    r.*,
                    rc.numero AS registro_compra_numero,
                    rc.proyecto_id,
                    pr.nombre AS proyecto_nombre,
                    p.razon_social,
                    e.nombre AS estado_registro_compra
                FROM Remito r
                INNER JOIN registroDecompra rc
                    ON rc.registro_compra_id = r.idRegistroDeCompra
                INNER JOIN Proveedor p
                    ON p.proveedor_id = rc.proveedor_id
                LEFT JOIN Proyecto pr
                    ON pr.proyecto_id = rc.proyecto_id
                LEFT JOIN estado_registroDecompra e
                    ON e.estado_registroDecompra_id = rc.estado_registroDecompra_id
                WHERE r.remito_id = @remito_id
            `);

        if (cabecera.recordset.length === 0) {
            return res.status(404).json({
                success: false,
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
        responderError(res, error, 'Error al obtener remito');
    }
};

const getRemitosByRegistroCompra = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await conectarDB();

        const result = await pool.request()
            .input('idRegistroDeCompra', sql.BigInt, id)
            .query(`
                SELECT
                    r.remito_id,
                    r.numero,
                    r.fecha,
                    r.liberado,
                    r.idRegistroDeCompra,
                    COUNT(dr.detalle_remito_id) AS cantidad_items
                FROM Remito r
                LEFT JOIN Detalle_Remito dr
                    ON dr.remito_id = r.remito_id
                WHERE r.idRegistroDeCompra = @idRegistroDeCompra
                GROUP BY
                    r.remito_id,
                    r.numero,
                    r.fecha,
                    r.liberado,
                    r.idRegistroDeCompra
                ORDER BY r.remito_id DESC
            `);

        res.json(result.recordset);

    } catch (error) {
        responderError(res, error, 'Error al obtener remitos por registro de compra');
    }
};

const obtenerRegistroCompra = async (request, idRegistroDeCompra) => {
    const result = await request
        .input('registro_compra_id', sql.BigInt, idRegistroDeCompra)
        .query(`
            SELECT
                rc.registro_compra_id,
                rc.numero,
                rc.fecha_entrega,
                rc.proyecto_id,
                rc.precio_unitario,
                rc.monto_total,
                rc.cantidad_pedida,
                rc.activo,
                e.nombre AS estado
            FROM registroDecompra rc
            LEFT JOIN estado_registroDecompra e
                ON e.estado_registroDecompra_id = rc.estado_registroDecompra_id
            WHERE rc.registro_compra_id = @registro_compra_id
        `);

    return result.recordset[0];
};

const validarRegistroCompraParaRemito = (registroCompra) => {
    if (!registroCompra) {
        throw crearHttpError('Registro de compra no encontrado', 404);
    }

    if (registroCompra.activo === false) {
        throw crearHttpError('El Registro de Compra esta inactivo', 409);
    }

    if (!ESTADOS_REMITO_HABILITADOS.includes(registroCompra.estado)) {
        throw crearHttpError(`El Registro de Compra esta ${registroCompra.estado} y no admite remitos`, 409);
    }
};

const obtenerDetalleRegistroCompra = async (request, idRegistroDeCompra) => {
    const result = await request
        .input('id_oc', sql.BigInt, idRegistroDeCompra)
        .query(`
            SELECT
                drc.id_detalle_oc,
                drc.id_oc,
                drc.id_material,
                m.nombre AS material,
                drc.cantidad AS cantidad_solicitada,
                drc.UoM
            FROM Detalle_RegistroDeCompra drc
            INNER JOIN Materiales m
                ON m.id_material = drc.id_material
            WHERE drc.id_oc = @id_oc
        `);

    return result.recordset;
};

const obtenerCantidadesLiberadas = async (request, idRegistroDeCompra) => {
    const result = await request
        .input('idRegistroDeCompra', sql.BigInt, idRegistroDeCompra)
        .query(`
            SELECT
                dr.id_material,
                SUM(dr.cantidad) AS cantidad_recibida
            FROM Remito r
            INNER JOIN Detalle_Remito dr
                ON dr.remito_id = r.remito_id
            WHERE
                r.idRegistroDeCompra = @idRegistroDeCompra
                AND r.liberado = 1
            GROUP BY dr.id_material
        `);

    return result.recordset.reduce((acc, item) => {
        acc[Number(item.id_material)] = Number(item.cantidad_recibida);
        return acc;
    }, {});
};

const validarDetalleContraRegistroCompra = (detalleRemito, detalleRegistroCompra, cantidadesLiberadas) => {
    const detallePorMaterial = new Map(
        detalleRegistroCompra.map(item => [Number(item.id_material), item])
    );

    for (const item of detalleRemito) {
        const idMaterial = Number(item.id_material);
        const cantidad = Number(item.cantidad);
        const detalleOc = detallePorMaterial.get(idMaterial);

        if (!idMaterial || !cantidad || cantidad <= 0) {
            throw crearHttpError('Cada detalle debe tener id_material y cantidad mayor a cero', 400);
        }

        if (!item.UoM) {
            throw crearHttpError('Cada detalle debe tener unidad de medida', 400);
        }

        if (!detalleOc) {
            throw crearHttpError(`El material ${idMaterial} no pertenece al Registro de Compra`, 409);
        }

        const solicitado = Number(detalleOc.cantidad_solicitada);
        const recibido = Number(cantidadesLiberadas[idMaterial] || 0);
        const pendiente = solicitado - recibido;

        if (cantidad > pendiente) {
            throw crearHttpError(`La cantidad supera el pendiente del material ${detalleOc.material}`, 409);
        }
    }
};

const crearRemito = async (req, res) => {
    let transaction;

    try {
        const {
            numero,
            fecha,
            idRegistroDeCompra,
            registro_compra_id,
            observaciones,
            detalle
        } = req.body;

        const idRegistro = idRegistroDeCompra || registro_compra_id;

        if (!numero || !fecha || !idRegistro) {
            return res.status(400).json({
                success: false,
                message: 'numero, fecha y registro_compra_id son obligatorios'
            });
        }

        if (!Array.isArray(detalle) || detalle.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'El remito debe tener al menos un material'
            });
        }

        const pool = await conectarDB();
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const registroCompra = await obtenerRegistroCompra(new sql.Request(transaction), idRegistro);
        validarRegistroCompraParaRemito(registroCompra);

        const duplicado = await new sql.Request(transaction)
            .input('numero', sql.VarChar, numero)
            .query(`
                SELECT remito_id
                FROM Remito
                WHERE numero = @numero
            `);

        if (duplicado.recordset.length > 0) {
            throw crearHttpError('Ya existe un Remito con ese numero', 409);
        }

        const detalleOc = await obtenerDetalleRegistroCompra(new sql.Request(transaction), idRegistro);
        const cantidadesLiberadas = await obtenerCantidadesLiberadas(new sql.Request(transaction), idRegistro);
        validarDetalleContraRegistroCompra(detalle, detalleOc, cantidadesLiberadas);

        const insertRemito = await new sql.Request(transaction)
            .input('numero', sql.VarChar, numero)
            .input('fecha', sql.Date, fecha)
            .input('idRegistroDeCompra', sql.BigInt, idRegistro)
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
            await new sql.Request(transaction)
                .input('remito_id', sql.BigInt, remitoId)
                .input('id_material', sql.BigInt, item.id_material)
                .input('cantidad', sql.Decimal(18, 2), item.cantidad)
                .input('UoM', sql.VarChar, item.UoM)
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
            success: true,
            message: 'Remito creado correctamente',
            data: {
                remito_id: remitoId,
                liberado: false,
                observaciones: observaciones || null
            }
        });

    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }

        responderError(res, error, 'Error al crear remito');
    }
};

const registrarIngresoEnProyecto = async (transaction, item, proyectoId, fechaIngreso, costoUnitario, remitoNumero) => {
    const stockExistente = await new sql.Request(transaction)
        .input('id_material', sql.BigInt, item.id_material)
        .query(`
            SELECT stock_general_id
            FROM StockGeneral WITH (UPDLOCK, HOLDLOCK)
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
                    cantidad_asignada = cantidad_asignada + @cantidad
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
                    0,
                    @cantidad,
                    1
                )
            `);
    }

    const stock = await new sql.Request(transaction)
        .input('id_material', sql.BigInt, item.id_material)
        .query('SELECT stock_general_id FROM StockGeneral WHERE id_material=@id_material');
    const stockGeneralId = stock.recordset[0].stock_general_id;

    const containerExistente = await new sql.Request(transaction)
        .input('stock_general_id', sql.BigInt, stockGeneralId)
        .input('id_proyecto', sql.BigInt, proyectoId)
        .query(`SELECT container_id FROM Container WITH (UPDLOCK,HOLDLOCK)
                WHERE stock_general_id=@stock_general_id AND id_proyecto=@id_proyecto`);

    let containerId;
    if (containerExistente.recordset.length) {
        containerId = containerExistente.recordset[0].container_id;
        await new sql.Request(transaction)
            .input('container_id', sql.BigInt, containerId)
            .input('cantidad', sql.Decimal(18,2), item.cantidad)
            .query('UPDATE Container SET cantidad_actual=cantidad_actual+@cantidad,activo=1 WHERE container_id=@container_id');
    } else {
        const insertContainer = await new sql.Request(transaction)
            .input('stock_general_id', sql.BigInt, stockGeneralId)
            .input('id_proyecto', sql.BigInt, proyectoId)
            .input('nombre', sql.NVarChar(200), item.material)
            .input('unidad_medida', sql.NVarChar(50), item.UoM || null)
            .input('cantidad', sql.Decimal(18,2), item.cantidad)
            .query(`INSERT INTO Container(stock_general_id,id_proyecto,nombre,unidad_medida,cantidad_actual,activo)
                    OUTPUT INSERTED.container_id
                    VALUES(@stock_general_id,@id_proyecto,@nombre,@unidad_medida,@cantidad,1)`);
        containerId = insertContainer.recordset[0].container_id;
    }

    await new sql.Request(transaction)
        .input('conteiner_id', sql.BigInt, containerId)
        .input('costo_unitario', sql.Decimal(18,4), costoUnitario)
        .input('cantidad', sql.Decimal(18,2), item.cantidad)
        .input('costo_total', sql.Decimal(18,4), Number(costoUnitario) * Number(item.cantidad))
        .input('fecha', sql.DateTime2, fechaIngreso)
        .input('observaciones', sql.NVarChar(500), `Ingreso por remito ${remitoNumero}`)
        .query(`INSERT INTO CostoStock(conteiner_id,costo_unitario,cantidad_valorizada,costo_total,fecha_valorizacion,observaciones,activo)
                VALUES(@conteiner_id,@costo_unitario,@cantidad,@costo_total,@fecha,@observaciones,1)`);
};

const recalcularEstadoRegistroCompra = async (transaction, idRegistroDeCompra) => {
    const registro = await obtenerRegistroCompra(new sql.Request(transaction), idRegistroDeCompra);

    if (!registro) {
        throw crearHttpError('Registro de compra no encontrado', 404);
    }

    if (registro.estado === 'CANCELADA') {
        return {
            estadoAnterior: 'CANCELADA',
            estadoActual: 'CANCELADA'
        };
    }

    const cantidades = await new sql.Request(transaction)
        .input('registro_compra_id', sql.BigInt, idRegistroDeCompra)
        .query(`
            SELECT
                drc.id_material,
                drc.cantidad AS cantidad_solicitada,
                ISNULL(SUM(CASE WHEN r.liberado = 1 THEN dr.cantidad ELSE 0 END), 0) AS cantidad_recibida
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
        throw crearHttpError('El Registro de Compra no tiene detalle', 409);
    }

    const algunoRecibido = cantidades.recordset.some(item =>
        Number(item.cantidad_recibida) > 0
    );

    const todosCompletos = cantidades.recordset.every(item =>
        Number(item.cantidad_recibida) === Number(item.cantidad_solicitada)
    );

    const algunoExcedido = cantidades.recordset.some(item =>
        Number(item.cantidad_recibida) > Number(item.cantidad_solicitada)
    );

    if (algunoExcedido) {
        throw crearHttpError('La cantidad recibida supera la cantidad solicitada', 409);
    }

    let estadoNombre = 'CREADA';

    if (todosCompletos) {
        estadoNombre = 'COMPLETADA';
    } else if (algunoRecibido) {
        estadoNombre = 'PARCIAL';
    }

    const estado = await new sql.Request(transaction)
        .input('nombre', sql.VarChar, estadoNombre)
        .query(`
            SELECT estado_registroDecompra_id
            FROM estado_registroDecompra
            WHERE nombre = @nombre
        `);

    if (estado.recordset.length === 0) {
        throw crearHttpError(`No existe el estado ${estadoNombre}`, 500);
    }

    await new sql.Request(transaction)
        .input('registro_compra_id', sql.BigInt, idRegistroDeCompra)
        .input('estado_registroDecompra_id', sql.Int, estado.recordset[0].estado_registroDecompra_id)
        .query(`
            UPDATE registroDecompra
            SET estado_registroDecompra_id = @estado_registroDecompra_id
            WHERE registro_compra_id = @registro_compra_id
        `);

    return {
        estadoAnterior: registro.estado,
        estadoActual: estadoNombre
    };
};

const liberarRemito = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;
        const proyectoSolicitado = Number(req.body?.proyecto_id || 0);
        const pool = await conectarDB();

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const remito = await new sql.Request(transaction)
            .input('remito_id', sql.BigInt, id)
            .query(`
                SELECT
                    remito_id,
                    numero,
                    fecha,
                    idRegistroDeCompra,
                    liberado
                FROM Remito WITH (UPDLOCK, HOLDLOCK)
                WHERE remito_id = @remito_id
            `);

        if (remito.recordset.length === 0) {
            throw crearHttpError('Remito no encontrado', 404);
        }

        const remitoActual = remito.recordset[0];

        if (remitoActual.liberado) {
            throw crearHttpError('El Remito ya fue liberado anteriormente', 409);
        }

        const registroCompra = await obtenerRegistroCompra(new sql.Request(transaction), remitoActual.idRegistroDeCompra);
        validarRegistroCompraParaRemito(registroCompra);
        const proyectoId = Number(registroCompra.proyecto_id || proyectoSolicitado);
        if (!proyectoId) {
            throw crearHttpError('Debe seleccionar el proyecto al que se liberará el stock', 400);
        }
        const proyecto = await new sql.Request(transaction)
            .input('proyecto_id', sql.BigInt, proyectoId)
            .query('SELECT proyecto_id,nombre FROM Proyecto WHERE proyecto_id=@proyecto_id AND activo=1');
        if (!proyecto.recordset.length) {
            throw crearHttpError('El proyecto seleccionado no existe o está inactivo', 400);
        }
        if (!registroCompra.proyecto_id) {
            await new sql.Request(transaction)
                .input('registro_compra_id', sql.BigInt, remitoActual.idRegistroDeCompra)
                .input('proyecto_id', sql.BigInt, proyectoId)
                .query('UPDATE registroDecompra SET proyecto_id=@proyecto_id WHERE registro_compra_id=@registro_compra_id');
        }

        const detalleRemito = await new sql.Request(transaction)
            .input('remito_id', sql.BigInt, id)
            .query(`
                SELECT
                    dr.detalle_remito_id,
                    dr.id_material,
                    m.nombre AS material,
                    dr.cantidad,
                    dr.UoM
                FROM Detalle_Remito dr
                INNER JOIN Materiales m
                    ON m.id_material = dr.id_material
                WHERE dr.remito_id = @remito_id
            `);

        if (detalleRemito.recordset.length === 0) {
            throw crearHttpError('No se puede liberar un Remito sin detalle', 400);
        }

        const detalleOc = await obtenerDetalleRegistroCompra(new sql.Request(transaction), remitoActual.idRegistroDeCompra);
        const cantidadesLiberadas = await obtenerCantidadesLiberadas(new sql.Request(transaction), remitoActual.idRegistroDeCompra);
        validarDetalleContraRegistroCompra(detalleRemito.recordset, detalleOc, cantidadesLiberadas);

        const costoUnitario = Number(registroCompra.precio_unitario || (Number(registroCompra.cantidad_pedida) ? Number(registroCompra.monto_total || 0) / Number(registroCompra.cantidad_pedida) : 0));
        for (const item of detalleRemito.recordset) {
            await registrarIngresoEnProyecto(transaction, item, proyectoId, remitoActual.fecha, costoUnitario, remitoActual.numero);
        }

        await new sql.Request(transaction)
            .input('remito_id', sql.BigInt, id)
            .query(`
                UPDATE Remito
                SET liberado = 1
                WHERE remito_id = @remito_id
            `);

        const estado = await recalcularEstadoRegistroCompra(transaction, remitoActual.idRegistroDeCompra);

        await transaction.commit();

        res.json({
            success: true,
            message: 'Remito liberado correctamente',
            data: {
                remito: {
                    idRemito: remitoActual.remito_id,
                    numero: remitoActual.numero,
                    liberado: true
                },
                registroCompra: {
                    idRegistroCompra: remitoActual.idRegistroDeCompra,
                    numero: registroCompra.numero,
                    estadoAnterior: estado.estadoAnterior,
                    estadoActual: estado.estadoActual
                },
                stockActualizado: detalleRemito.recordset.map(item => ({
                    idMaterial: item.id_material,
                    nombreMaterial: item.material,
                    cantidadIngresada: Number(item.cantidad),
                    costoUnitario
                })),
                proyecto: proyecto.recordset[0]
            }
        });

    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }

        responderError(res, error, 'Error al liberar remito');
    }
};

module.exports = {
    getRemitos,
    getRemitoById,
    getRemitosByRegistroCompra,
    crearRemito,
    liberarRemito,
    recalcularEstadoRegistroCompra
};
