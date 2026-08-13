const { conectarDB, sql } = require('../../DB/dbConection');

const ESTADOS_REMITO_HABILITADOS = ['CREADA', 'PARCIAL', 'PARCIAL CON DEMORAS'];

const normalizarUom = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

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
                e.nombre AS estado_registro_compra,
                el.estado_liberacion,
                el.cantidad_pendiente
            FROM Remito r
            INNER JOIN registroDecompra rc
                ON rc.registro_compra_id = r.idRegistroDeCompra
            INNER JOIN Proveedor p
                ON p.proveedor_id = rc.proveedor_id
            LEFT JOIN estado_registroDecompra e
                ON e.estado_registroDecompra_id = rc.estado_registroDecompra_id
            LEFT JOIN vw_EstadoLiberacionRemito el
                ON el.remito_id=r.remito_id
            WHERE ISNULL(r.activo, 1) = 1
            ORDER BY r.remito_id DESC
        `);

        res.json(result.recordset);

    } catch (error) {
        responderError(res, error, 'Error al obtener remitos');
    }
};

const getMaterialesBomProyecto = async (req, res) => {
    const proyectoId = Number(req.params.proyectoId);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
        return res.status(400).json({ message: 'El proyecto es obligatorio' });
    }

    try {
        const pool = await conectarDB();
        const result = await pool.request()
            .input('proyecto_id', sql.BigInt, proyectoId)
            .query(`
                SELECT
                    MIN(b.bom_id) AS bom_id,
                    b.material_id,
                    m.nombre AS descripcion_libre,
                    m.nombre AS material_bom,
                    u.nombre AS uom_nombre,
                    COUNT_BIG(*) AS cantidad_operaciones
                FROM BomOperacion b
                INNER JOIN Operacion o
                    ON o.operacion_id = b.operacion_id
                   AND ISNULL(o.archivada, 0) = 0
                INNER JOIN VersionPlan vp
                    ON vp.version_id = o.version_id
                   AND vp.es_activa = 1
                INNER JOIN Materiales m
                    ON m.id_material = b.material_id
                INNER JOIN UoM u
                    ON u.uom_id = m.uom_id
                WHERE b.proyecto_id = @proyecto_id
                  AND b.material_id IS NOT NULL
                GROUP BY b.material_id,m.nombre,u.nombre
                ORDER BY m.nombre
            `);

        res.json(result.recordset);
    } catch (error) {
        responderError(res, error, 'Error al obtener los materiales BOM del proyecto');
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
                    rc.tipo AS registro_compra_tipo,
                    rc.proyecto_id,
                    pr.nombre AS proyecto_nombre,
                    p.razon_social,
                    e.nombre AS estado_registro_compra
                    ,el.estado_liberacion
                    ,el.cantidad_liberada
                    ,el.cantidad_pendiente
                FROM Remito r
                INNER JOIN registroDecompra rc
                    ON rc.registro_compra_id = r.idRegistroDeCompra
                INNER JOIN Proveedor p
                    ON p.proveedor_id = rc.proveedor_id
                LEFT JOIN Proyecto pr
                    ON pr.proyecto_id = rc.proyecto_id
                LEFT JOIN estado_registroDecompra e
                    ON e.estado_registroDecompra_id = rc.estado_registroDecompra_id
                LEFT JOIN vw_EstadoLiberacionRemito el
                    ON el.remito_id=r.remito_id
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
                    COALESCE(dr.Descripcion,m.nombre) AS material,
                    dr.cantidad,
                    dr.UoM,
                    saldo.cantidad_liberada,
                    saldo.cantidad_pendiente,
                    saldo.estado_liberacion
                FROM Detalle_Remito dr
                LEFT JOIN Materiales m
                    ON m.id_material = dr.id_material
                LEFT JOIN vw_SaldoLiberacionRemitoDetalle saldo
                    ON saldo.detalle_remito_id=dr.detalle_remito_id
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
                    el.estado_liberacion,
                    el.cantidad_pendiente,
                    COUNT(dr.detalle_remito_id) AS cantidad_items
                FROM Remito r
                LEFT JOIN vw_EstadoLiberacionRemito el ON el.remito_id=r.remito_id
                LEFT JOIN Detalle_Remito dr
                    ON dr.remito_id = r.remito_id
                WHERE r.idRegistroDeCompra = @idRegistroDeCompra
                GROUP BY
                    r.remito_id,
                    r.numero,
                    r.fecha,
                    r.liberado,
                    r.idRegistroDeCompra,
                    el.estado_liberacion,
                    el.cantidad_pendiente
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
                COALESCE(drc.Descripcion,m.nombre) AS material,
                drc.cantidad AS cantidad_solicitada,
                drc.UoM
            FROM Detalle_RegistroDeCompra drc
            LEFT JOIN Materiales m
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
                dbo.fn_NormalizarClave(dr.Descripcion) AS descripcion_clave,
                dbo.fn_NormalizarClave(dr.UoM) AS uom_clave,
                SUM(dr.cantidad) AS cantidad_recibida
            FROM Remito r
            INNER JOIN Detalle_Remito dr
                ON dr.remito_id = r.remito_id
            WHERE
                r.idRegistroDeCompra = @idRegistroDeCompra
                AND r.liberado = 1
            GROUP BY dbo.fn_NormalizarClave(dr.Descripcion),dbo.fn_NormalizarClave(dr.UoM)
        `);

    return result.recordset.reduce((acc, item) => {
        acc[`${normalizarUom(item.descripcion_clave)}|${normalizarUom(item.uom_clave)}`] = Number(item.cantidad_recibida);
        return acc;
    }, {});
};

const validarDetalleContraRegistroCompra = (detalleRemito, detalleRegistroCompra, cantidadesLiberadas) => {
    const detallePorMaterial = new Map(
        detalleRegistroCompra.map(item => [`${normalizarUom(item.material)}|${normalizarUom(item.UoM)}`, item])
    );

    for (const item of detalleRemito) {
        const clave = `${normalizarUom(item.descripcion || item.material)}|${normalizarUom(item.UoM)}`;
        const cantidad = Number(item.cantidad);
        const detalleOc = detallePorMaterial.get(clave);

        if (!item.descripcion && !item.material || !cantidad || cantidad <= 0) {
            throw crearHttpError('Cada detalle debe tener descripcion y cantidad mayor a cero', 400);
        }

        if (!item.UoM) {
            throw crearHttpError('Cada detalle debe tener unidad de medida', 400);
        }

        if (!detalleOc) {
            throw crearHttpError(`El material ${item.descripcion || item.material} no pertenece al Registro de Compra`, 409);
        }

        if (normalizarUom(item.UoM) !== normalizarUom(detalleOc.UoM)) {
            throw crearHttpError(
                `La UOM de ${detalleOc.material} debe ser ${normalizarUom(detalleOc.UoM)}`,
                409
            );
        }

        const solicitado = Number(detalleOc.cantidad_solicitada);
        const recibido = Number(cantidadesLiberadas[clave] || 0);
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
                .input('id_material', sql.BigInt, null)
                .input('descripcion', sql.NVarChar(255), String(item.descripcion || item.material || '').trim())
                .input('cantidad', sql.Decimal(18, 2), item.cantidad)
                .input('UoM', sql.VarChar, normalizarUom(item.UoM))
                .query(`
                    INSERT INTO Detalle_Remito (
                        remito_id,
                        id_material,
                        Descripcion,
                        cantidad,
                        UoM
                    )
                    VALUES (
                        @remito_id,
                        @id_material,
                        @descripcion,
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
        .query(`SELECT TOP 1 container_id FROM Container WITH (UPDLOCK,HOLDLOCK)
                WHERE stock_general_id=@stock_general_id AND id_proyecto=@id_proyecto AND activo=1
                ORDER BY container_id`);

    let containerId;
    if (containerExistente.recordset.length) {
        containerId = containerExistente.recordset[0].container_id;
        await new sql.Request(transaction)
            .input('container_id', sql.BigInt, containerId)
            .input('nombre', sql.NVarChar(200), item.material)
            .input('unidad_medida', sql.NVarChar(50), normalizarUom(item.UoM) || null)
            .input('cantidad', sql.Decimal(18,2), item.cantidad)
            .query(`UPDATE Container SET cantidad_actual=cantidad_actual+@cantidad,
                    nombre=@nombre,unidad_medida=@unidad_medida,activo=1
                    WHERE container_id=@container_id`);
    } else {
        const insertContainer = await new sql.Request(transaction)
        .input('stock_general_id', sql.BigInt, stockGeneralId)
        .input('id_proyecto', sql.BigInt, proyectoId)
        .input('nombre', sql.NVarChar(200), item.material)
        .input('unidad_medida', sql.NVarChar(50), normalizarUom(item.UoM) || null)
        .input('cantidad', sql.Decimal(18,2), item.cantidad)
        .query(`INSERT INTO Container(stock_general_id,id_proyecto,nombre,unidad_medida,cantidad_actual,activo)
                OUTPUT INSERTED.container_id
                VALUES(@stock_general_id,@id_proyecto,@nombre,@unidad_medida,@cantidad,1)`);
        containerId = insertContainer.recordset[0].container_id;
    }

    const costo = await new sql.Request(transaction)
        .input('conteiner_id', sql.BigInt, containerId)
        .query('SELECT costo_stock_id,costo_unitario,cantidad_valorizada FROM CostoStock WITH (UPDLOCK,HOLDLOCK) WHERE conteiner_id=@conteiner_id');
    if (costo.recordset.length) {
        await new sql.Request(transaction)
            .input('costo_stock_id', sql.BigInt, costo.recordset[0].costo_stock_id)
            .input('costo_unitario', sql.Decimal(18,4), costoUnitario)
            .input('cantidad', sql.Decimal(18,2), item.cantidad)
            .input('observaciones', sql.NVarChar(500), `Ultimo ingreso por remito ${remitoNumero}`)
            .query(`UPDATE CostoStock SET
                    costo_unitario=CASE WHEN cantidad_valorizada+@cantidad=0 THEN @costo_unitario
                      ELSE ((costo_unitario*cantidad_valorizada)+(@costo_unitario*@cantidad))/(cantidad_valorizada+@cantidad) END,
                    cantidad_valorizada=cantidad_valorizada+@cantidad,
                    observaciones=@observaciones,activo=1
                    WHERE costo_stock_id=@costo_stock_id`);
    } else await new sql.Request(transaction)
        .input('conteiner_id', sql.BigInt, containerId)
        .input('costo_unitario', sql.Decimal(18,4), costoUnitario)
        .input('cantidad', sql.Decimal(18,2), item.cantidad)
        .input('fecha', sql.DateTime2, fechaIngreso)
        .input('observaciones', sql.NVarChar(500), `Ingreso por remito ${remitoNumero}`)
        .query(`INSERT INTO CostoStock(conteiner_id,costo_unitario,cantidad_valorizada,fecha_valorizacion,observaciones,activo)
                VALUES(@conteiner_id,@costo_unitario,@cantidad,@fecha,@observaciones,1)`);
    return containerId;
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
                drc.id_detalle_oc,
                drc.cantidad AS cantidad_solicitada,
                ISNULL(recibido.cantidad_recibida,0) AS cantidad_recibida
            FROM Detalle_RegistroDeCompra drc
            OUTER APPLY (
                SELECT SUM(saldo.cantidad_liberada) AS cantidad_recibida
                FROM Remito r
                INNER JOIN Detalle_Remito dr ON dr.remito_id=r.remito_id
                INNER JOIN vw_SaldoLiberacionRemitoDetalle saldo ON saldo.detalle_remito_id=dr.detalle_remito_id
                WHERE r.idRegistroDeCompra=drc.id_oc
                  AND dbo.fn_NormalizarClave(dr.UoM)=dbo.fn_NormalizarClave(drc.UoM)
                  AND (
                    (drc.id_material IS NOT NULL AND dr.id_material=drc.id_material)
                    OR dbo.fn_NormalizarClave(dr.Descripcion)=dbo.fn_NormalizarClave(drc.Descripcion)
                  )
            ) recibido
            WHERE drc.id_oc = @registro_compra_id
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

const obtenerProyectosActivos = async (transaction, proyectoIds) => {
    const proyectos = new Map();

    for (const proyectoId of [...new Set(proyectoIds)]) {
        const result = await new sql.Request(transaction)
            .input('proyecto_id', sql.BigInt, proyectoId)
            .query(`
                SELECT proyecto_id, nombre
                FROM Proyecto
                WHERE proyecto_id = @proyecto_id
                  AND activo = 1
            `);

        if (!result.recordset.length) {
            throw crearHttpError(`El proyecto ${proyectoId} no existe o está inactivo`, 400);
        }

        proyectos.set(Number(proyectoId), result.recordset[0]);
    }

    return proyectos;
};

const construirLiberacionParcial = (asignaciones, detalleRemito) => {
    if (!Array.isArray(asignaciones) || !asignaciones.length) {
        throw crearHttpError('Debe informar al menos un material para liberar', 400);
    }
    const porDetalle = new Map(detalleRemito.map(item => [Number(item.detalle_remito_id), item]));
    const usados = new Set();
    const distribucion = [];
    for (const asignacion of asignaciones) {
        const detalleId = Number(asignacion?.detalle_remito_id);
        const itemRemito = porDetalle.get(detalleId);
        if (!itemRemito) throw crearHttpError(`El detalle ${detalleId} no pertenece al remito`, 409);
        if (usados.has(detalleId)) throw crearHttpError(`El material ${itemRemito.material} esta repetido`, 400);
        usados.add(detalleId);
        let total = 0;
        const proyectos = new Set();
        for (const destino of Array.isArray(asignacion.destinos) ? asignacion.destinos : []) {
            const proyectoId = Number(destino?.proyecto_id);
            const materialId = Number(destino?.material_id);
            const cantidad = Number(destino?.cantidad);
            if (!Number.isInteger(proyectoId) || proyectoId <= 0) throw crearHttpError(`Proyecto invalido para ${itemRemito.material}`, 400);
            if (!Number.isInteger(materialId) || materialId <= 0) throw crearHttpError(`Seleccione el material BOM para ${itemRemito.material}`, 400);
            if (!Number.isFinite(cantidad) || cantidad <= 0) throw crearHttpError(`La cantidad de ${itemRemito.material} debe ser mayor a cero`, 400);
            if (proyectos.has(proyectoId)) throw crearHttpError(`No puede repetir un proyecto para ${itemRemito.material}`, 400);
            proyectos.add(proyectoId);
            total += cantidad;
            distribucion.push({ itemRemito, proyectoId, materialId, cantidad });
        }
        if (total - Number(itemRemito.cantidad_pendiente) >= 0.005) {
            throw crearHttpError(`La liberacion de ${itemRemito.material} supera el saldo pendiente`, 409);
        }
    }
    if (!distribucion.length) throw crearHttpError('Debe liberar al menos una cantidad', 400);
    return distribucion;
};

const validarDestinoBom = async (transaction, destino) => {
    const result = await new sql.Request(transaction)
        .input('proyecto_id', sql.BigInt, destino.proyectoId)
        .input('material_id', sql.BigInt, destino.materialId)
        .query(`
            SELECT TOP 1 m.id_material,m.nombre,m.uom_id,u.nombre AS uom_nombre
            FROM BomOperacion b
            INNER JOIN Operacion o ON o.operacion_id=b.operacion_id AND ISNULL(o.archivada,0)=0
            INNER JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
            INNER JOIN Materiales m ON m.id_material=b.material_id
            INNER JOIN UoM u ON u.uom_id=m.uom_id
            WHERE b.proyecto_id=@proyecto_id AND b.material_id=@material_id
        `);
    if (!result.recordset.length) throw crearHttpError('El material seleccionado no pertenece a la BOM activa del proyecto', 409);
    const material = result.recordset[0];
    if (normalizarUom(destino.itemRemito.UoM) !== normalizarUom(material.uom_nombre)) {
        throw crearHttpError(`La UOM de ${destino.itemRemito.material} no coincide con ${material.nombre}`, 409);
    }
    return material;
};

const liberarRemito = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;
        const asignacionesSolicitadas = Array.isArray(req.body?.asignaciones)
            ? req.body.asignaciones
            : null;
        const primerProyectoDistribuido = asignacionesSolicitadas?.[0]?.destinos?.[0]?.proyecto_id;
        const proyectoSolicitado = Number(req.body?.proyecto_id || primerProyectoDistribuido || 0);
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
        const proyectoId = Number(
            asignacionesSolicitadas
                ? proyectoSolicitado
                : (registroCompra.proyecto_id || proyectoSolicitado)
        );
        if (!proyectoId) {
            throw crearHttpError('Debe seleccionar el proyecto al que se liberará el stock', 400);
        }
        const proyecto = await new sql.Request(transaction)
            .input('proyecto_id', sql.BigInt, proyectoId)
            .query('SELECT proyecto_id,nombre FROM Proyecto WHERE proyecto_id=@proyecto_id AND activo=1');
        if (!proyecto.recordset.length) {
            throw crearHttpError('El proyecto seleccionado no existe o está inactivo', 400);
        }
        if (!asignacionesSolicitadas && !registroCompra.proyecto_id) {
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
                    COALESCE(dr.Descripcion,m.nombre) AS material,
                    dr.cantidad,
                    dr.UoM,
                    saldo.cantidad_liberada,
                    saldo.cantidad_pendiente
                FROM Detalle_Remito dr
                LEFT JOIN Materiales m
                    ON m.id_material = dr.id_material
                INNER JOIN vw_SaldoLiberacionRemitoDetalle saldo
                    ON saldo.detalle_remito_id=dr.detalle_remito_id
                WHERE dr.remito_id = @remito_id
                  AND saldo.cantidad_pendiente > 0
            `);

        if (detalleRemito.recordset.length === 0) {
            throw crearHttpError('No se puede liberar un Remito sin detalle', 400);
        }

        const distribucion = asignacionesSolicitadas
            ? construirLiberacionParcial(asignacionesSolicitadas, detalleRemito.recordset)
            : detalleRemito.recordset.map(itemRemito => ({
                itemRemito,
                proyectoId,
                materialId: Number(itemRemito.id_material),
                cantidad: Number(itemRemito.cantidad_pendiente)
            }));

        const proyectosDistribucion = await obtenerProyectosActivos(
            transaction,
            distribucion.map(item => item.proyectoId)
        );

        const costoUnitario = Number(registroCompra.precio_unitario || (Number(registroCompra.cantidad_pedida) ? Number(registroCompra.monto_total || 0) / Number(registroCompra.cantidad_pedida) : 0));
        for (const destino of distribucion) {
            const materialDestino = await validarDestinoBom(transaction, destino);
            const containerId = await registrarIngresoEnProyecto(
                transaction,
                {
                    id_material: destino.materialId,
                    material: materialDestino.nombre,
                    UoM: materialDestino.uom_nombre,
                    cantidad: destino.cantidad
                },
                destino.proyectoId,
                remitoActual.fecha,
                costoUnitario,
                remitoActual.numero
            );
            await new sql.Request(transaction)
                .input('detalle_remito_id', sql.BigInt, destino.itemRemito.detalle_remito_id)
                .input('proyecto_id', sql.BigInt, destino.proyectoId)
                .input('material_id', sql.BigInt, destino.materialId)
                .input('container_id', sql.BigInt, containerId)
                .input('cantidad', sql.Decimal(18,2), destino.cantidad)
                .input('registrado_por', sql.BigInt, req.usuario?.usuario_id || null)
                .query(`INSERT INTO LiberacionRemitoDetalle(
                    detalle_remito_id,proyecto_id,material_id,container_id,cantidad,registrado_por,activo
                ) VALUES(
                    @detalle_remito_id,@proyecto_id,@material_id,@container_id,@cantidad,@registrado_por,1
                )`);
        }

        const estadoRemito = await new sql.Request(transaction)
            .input('remito_id', sql.BigInt, id)
            .query(`
                UPDATE r SET liberado=CASE WHEN e.estado_liberacion='LIBERADO' THEN 1 ELSE 0 END
                FROM Remito r INNER JOIN vw_EstadoLiberacionRemito e ON e.remito_id=r.remito_id
                WHERE r.remito_id=@remito_id;
                SELECT estado_liberacion,cantidad_original,cantidad_liberada,cantidad_pendiente
                FROM vw_EstadoLiberacionRemito WHERE remito_id=@remito_id;
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
                    liberado: estadoRemito.recordset[0]?.estado_liberacion === 'LIBERADO',
                    estadoLiberacion: estadoRemito.recordset[0]?.estado_liberacion,
                    cantidadPendiente: Number(estadoRemito.recordset[0]?.cantidad_pendiente || 0)
                },
                registroCompra: {
                    idRegistroCompra: remitoActual.idRegistroDeCompra,
                    numero: registroCompra.numero,
                    estadoAnterior: estado.estadoAnterior,
                    estadoActual: estado.estadoActual
                },
                stockActualizado: distribucion.map(destino => ({
                    idMaterial: destino.materialId,
                    nombreMaterial: destino.itemRemito.material,
                    cantidadIngresada: Number(destino.cantidad),
                    costoUnitario,
                    proyecto: proyectosDistribucion.get(Number(destino.proyectoId))
                })),
                proyectos: [...proyectosDistribucion.values()]
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
    getMaterialesBomProyecto,
    getRemitoById,
    getRemitosByRegistroCompra,
    crearRemito,
    liberarRemito,
    recalcularEstadoRegistroCompra
};
