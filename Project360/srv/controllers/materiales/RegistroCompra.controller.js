// controllers/materiales/RegistroCompra.controller.js

const { conectarDB, sql } = require('../../DB/dbConection');
const { parsePagedQuery, pagedResponse, parseOptionalDate, parseOptionalId } = require('../../utils/list-pagination');

const limpiarRazonSocial = value => String(value || '').trim().replace(/\s+/g, ' ');
const expresionRazonNormalizada = `UPPER(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(razon_social)), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')) COLLATE Latin1_General_CI_AI`;


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

    const razonSocial = limpiarRazonSocial(body.proveedor.razon_social);
    if (!razonSocial) {
        throw new Error('La razón social del proveedor es obligatoria para crearlo');
    }

    const proveedorMismaRazon = await new sql.Request(transaction)
        .input('razon_social_normalizada', sql.NVarChar(150), razonSocial.toUpperCase())
        .query(`
            SELECT TOP 1 proveedor_id, razon_social
            FROM Proveedor WITH (UPDLOCK, HOLDLOCK)
            WHERE ${expresionRazonNormalizada} = @razon_social_normalizada COLLATE Latin1_General_CI_AI
        `);

    if (proveedorMismaRazon.recordset.length > 0) {
        const error = new Error(`Ya existe un proveedor con la razon social ${proveedorMismaRazon.recordset[0].razon_social}`);
        error.statusCode = 409;
        throw error;
    }

    const proveedorNuevo = await new sql.Request(transaction)
        .input('razon_social', sql.NVarChar(150), razonSocial)
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

const normalizarFechaSql = (value, campo, obligatorio = false) => {
    const crearErrorFecha = (message) => {
        const error = new Error(message);
        error.statusCode = 400;
        return error;
    };

    if (!value) {
        if (obligatorio) {
            throw crearErrorFecha(`El campo ${campo} es obligatorio`);
        }

        return null;
    }

    const texto = String(value).substring(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);

    if (!match) {
        throw crearErrorFecha(`El campo ${campo} debe tener formato YYYY-MM-DD`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const fecha = new Date(Date.UTC(year, month - 1, day));

    if (
        year < 1753 ||
        year > 9999 ||
        fecha.getUTCFullYear() !== year ||
        fecha.getUTCMonth() !== month - 1 ||
        fecha.getUTCDate() !== day
    ) {
        throw crearErrorFecha(`El campo ${campo} contiene una fecha invalida`);
    }

    return texto;
};

const normalizarTipoRegistroCompra = (tipo) => {
    const value = (tipo || '').trim().toUpperCase();

    if (['FAC', 'FACTURA', 'FC', 'FRA'].includes(value)) {
        return 'FAC';
    }

    return 'OC';
};

const normalizarUom = (uom) => (uom || '').trim().toUpperCase();
const errorValidacionMaterial = (message) => {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
};
const normalizarNombreMaterial = (nombre) => String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

const obtenerUomId = async (transaction, uom) => {
    const nombreUom = normalizarUom(uom);

    if (!nombreUom) {
        throw new Error('La unidad de medida del material es obligatoria');
    }

    const uomResult = await new sql.Request(transaction)
        .input('nombre', sql.NVarChar(50), nombreUom)
        .query(`
            SELECT uom_id
            FROM UOM WITH (UPDLOCK, HOLDLOCK)
            WHERE UPPER(LTRIM(RTRIM(nombre))) COLLATE Latin1_General_CI_AI
                = @nombre COLLATE Latin1_General_CI_AI
        `);

    if (uomResult.recordset.length > 0) {
        return uomResult.recordset[0].uom_id;
    }

    throw errorValidacionMaterial(`La unidad de medida ${nombreUom} no existe en el catálogo de UOM`);
};

// ======================================================
// GET - LISTAR REGISTROS DE COMPRA
// ======================================================

const getRegistrosCompra = async (req, res) => {
    try {
        const pagination = parsePagedQuery(req.query, {
            tipo: 'tipo', numero: 'numero', proveedor: 'razon_social', fecha: 'fecha',
            fechaEntrega: 'fecha_entrega', proyecto: 'proyecto_nombre', estado: 'estado',
            avance: 'porcentaje_recibido', remitos: 'cantidad_remitos_activos'
        }, 'estado');
        const proveedorId = pagination.paged ? parseOptionalId(req.query.proveedorId, 'proveedorId') : null;
        const proyectoId = pagination.paged ? parseOptionalId(req.query.proyectoId, 'proyectoId') : null;
        const fechaDesde = pagination.paged ? parseOptionalDate(req.query.fechaDesde, 'fechaDesde') : null;
        const fechaHasta = pagination.paged ? parseOptionalDate(req.query.fechaHasta, 'fechaHasta') : null;
        const pool = await conectarDB();
        if (pagination.paged) {
            const request = pool.request()
                .input('offset', sql.Int, pagination.offset)
                .input('pageSize', sql.Int, pagination.pageSize)
                .input('search', sql.NVarChar(200), String(req.query.search || '').trim() || null)
                .input('tipo', sql.VarChar(10), req.query.tipo && req.query.tipo !== 'TODOS' ? req.query.tipo : null)
                .input('estado', sql.NVarChar(80), req.query.estado && req.query.estado !== 'TODOS' ? req.query.estado : null)
                .input('proveedorId', sql.BigInt, proveedorId)
                .input('proveedorTexto', sql.NVarChar(150), String(req.query.proveedorTexto || '').trim() || null)
                .input('proyectoId', sql.BigInt, proyectoId)
                .input('fechaDesde', sql.Date, fechaDesde)
                .input('fechaHasta', sql.Date, fechaHasta);
            const result = await request.query(`
                WITH LiberacionDetalle AS (
                    SELECT detalle_remito_id, SUM(cantidad) cantidad_liberada
                    FROM LiberacionRemitoDetalle WHERE ISNULL(activo,1)=1 GROUP BY detalle_remito_id
                ), LiberadoPorLinea AS (
                    SELECT drc.id_oc,drc.id_detalle_oc,CAST(drc.cantidad AS DECIMAL(18,2)) cantidad_solicitada,
                        CAST(ISNULL(SUM(CASE WHEN ld.cantidad_liberada IS NOT NULL THEN ld.cantidad_liberada
                            WHEN ISNULL(r.liberado,0)=1 THEN dr.cantidad ELSE 0 END),0) AS DECIMAL(18,2)) cantidad_liberada
                    FROM Detalle_RegistroDeCompra drc
                    LEFT JOIN Materiales m ON m.id_material=drc.id_material
                    LEFT JOIN Remito r ON r.idRegistroDeCompra=drc.id_oc AND ISNULL(r.activo,1)=1
                    LEFT JOIN Detalle_Remito dr ON dr.remito_id=r.remito_id
                        AND dbo.fn_NormalizarClave(dr.Descripcion)=dbo.fn_NormalizarClave(COALESCE(drc.Descripcion,m.nombre))
                        AND dbo.fn_NormalizarClave(dr.UoM)=dbo.fn_NormalizarClave(drc.UoM)
                    LEFT JOIN LiberacionDetalle ld ON ld.detalle_remito_id=dr.detalle_remito_id
                    GROUP BY drc.id_oc,drc.id_detalle_oc,drc.cantidad
                ), Resumen AS (
                    SELECT id_oc,COUNT(*) cantidad_materiales,
                        SUM(CASE WHEN cantidad_liberada>=cantidad_solicitada AND cantidad_solicitada>0 THEN 1 ELSE 0 END) materiales_liberados,
                        SUM(cantidad_solicitada) cantidad_total,SUM(cantidad_liberada) cantidad_liberada
                    FROM LiberadoPorLinea GROUP BY id_oc
                ), Remitos AS (
                    SELECT idRegistroDeCompra,COUNT_BIG(*) cantidad_remitos_activos
                    FROM Remito WHERE ISNULL(activo,1)=1 GROUP BY idRegistroDeCompra
                ), Datos AS (
                    SELECT rc.registro_compra_id,rc.estado_registroDecompra_id AS estado_registroDeCompra_id,
                        rc.numero,rc.tipo,rc.fecha,rc.fecha_entrega,rc.observaciones,rc.activo,
                        ISNULL(x.cantidad_materiales,0) cantidad_materiales,ISNULL(x.materiales_liberados,0) materiales_liberados,
                        ISNULL(x.cantidad_total,0) cantidad_total,ISNULL(x.cantidad_liberada,0) cantidad_liberada,
                        CAST(CASE WHEN ISNULL(x.cantidad_total,0)>0 THEN x.cantidad_liberada*100.0/x.cantidad_total ELSE 0 END AS DECIMAL(18,4)) porcentaje_recibido,
                        CASE WHEN ISNULL(x.cantidad_liberada,0)<=0 THEN 'PENDIENTE' WHEN x.materiales_liberados=x.cantidad_materiales THEN 'LIBERADO' ELSE 'PARCIAL' END estado_liberacion,
                        ISNULL(rr.cantidad_remitos_activos,0) cantidad_remitos_activos,p.proveedor_id,p.razon_social,p.cuit,
                        e.nombre estado,rc.proyecto_id,pr.nombre proyecto_nombre
                    FROM registroDecompra rc
                    LEFT JOIN Proveedor p ON p.proveedor_id=rc.proveedor_id
                    LEFT JOIN Proyecto pr ON pr.proyecto_id=rc.proyecto_id
                    LEFT JOIN estado_registroDecompra e ON e.estado_registroDecompra_id=rc.estado_registroDecompra_id
                    LEFT JOIN Resumen x ON x.id_oc=rc.registro_compra_id LEFT JOIN Remitos rr ON rr.idRegistroDeCompra=rc.registro_compra_id
                    WHERE (@tipo IS NULL OR rc.tipo=@tipo) AND (@estado IS NULL OR e.nombre=@estado)
                      AND (@proveedorId IS NULL OR rc.proveedor_id=@proveedorId) AND (@proyectoId IS NULL OR rc.proyecto_id=@proyectoId)
                      AND (@fechaDesde IS NULL OR rc.fecha>=@fechaDesde) AND (@fechaHasta IS NULL OR rc.fecha<=@fechaHasta)
                      AND (@proveedorTexto IS NULL OR p.razon_social LIKE '%'+@proveedorTexto+'%' OR p.cuit LIKE '%'+@proveedorTexto+'%')
                      AND (@search IS NULL OR rc.numero LIKE '%'+@search+'%' OR rc.tipo LIKE '%'+@search+'%'
                           OR p.razon_social LIKE '%'+@search+'%' OR p.cuit LIKE '%'+@search+'%'
                           OR pr.nombre LIKE '%'+@search+'%' OR rc.observaciones LIKE '%'+@search+'%'
                           OR EXISTS (SELECT 1 FROM Detalle_RegistroDeCompra ds
                               LEFT JOIN Materiales ms ON ms.id_material=ds.id_material
                               WHERE ds.id_oc=rc.registro_compra_id
                                 AND (ds.Descripcion LIKE '%'+@search+'%' OR ms.nombre LIKE '%'+@search+'%')))
                )
                SELECT * INTO #Datos FROM Datos;
                SELECT COUNT_BIG(*) total FROM #Datos;
                SELECT * FROM #Datos
                ORDER BY ${pagination.orderBy} ${pagination.direction},registro_compra_id DESC
                OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
            `);
            return res.json(pagedResponse(result.recordsets[1], pagination.page, pagination.pageSize, result.recordsets[0][0].total));
        }
        const result = await pool.request().query(`
            WITH LiberadoPorLinea AS (
                SELECT
                    drc.id_oc,
                    drc.id_detalle_oc,
                    CAST(drc.cantidad AS DECIMAL(18,2)) AS cantidad_solicitada,
                    CAST(ISNULL(SUM(CASE
                        WHEN liberacion.cantidad_liberada IS NOT NULL THEN liberacion.cantidad_liberada
                        WHEN ISNULL(r.liberado,0)=1 THEN dr.cantidad
                        ELSE 0
                    END),0) AS DECIMAL(18,2)) AS cantidad_liberada
                FROM Detalle_RegistroDeCompra drc
                LEFT JOIN Materiales material_oc
                    ON material_oc.id_material=drc.id_material
                LEFT JOIN Remito r
                    ON r.idRegistroDeCompra=drc.id_oc
                   AND ISNULL(r.activo,1)=1
                LEFT JOIN Detalle_Remito dr
                    ON dr.remito_id=r.remito_id
                   AND dbo.fn_NormalizarClave(dr.Descripcion)=dbo.fn_NormalizarClave(COALESCE(drc.Descripcion,material_oc.nombre))
                   AND dbo.fn_NormalizarClave(dr.UoM)=dbo.fn_NormalizarClave(drc.UoM)
                OUTER APPLY (
                    SELECT SUM(l.cantidad) AS cantidad_liberada
                    FROM LiberacionRemitoDetalle l
                    WHERE l.detalle_remito_id=dr.detalle_remito_id
                      AND ISNULL(l.activo,1)=1
                ) liberacion
                GROUP BY drc.id_oc,drc.id_detalle_oc,drc.cantidad
            ), ResumenLiberacion AS (
                SELECT
                    id_oc,
                    COUNT(*) AS cantidad_materiales,
                    SUM(CASE WHEN cantidad_liberada >= cantidad_solicitada AND cantidad_solicitada > 0 THEN 1 ELSE 0 END) AS materiales_liberados,
                    SUM(cantidad_solicitada) AS cantidad_total,
                    SUM(cantidad_liberada) AS cantidad_liberada
                FROM LiberadoPorLinea
                GROUP BY id_oc
            )
            SELECT
                rc.registro_compra_id,
                rc.estado_registroDecompra_id AS estado_registroDeCompra_id,
                rc.numero,
                rc.tipo,
                rc.fecha,
                rc.fecha_entrega,
                rc.observaciones,
                rc.activo,
                ISNULL(rl.cantidad_materiales,0) AS cantidad_materiales,
                ISNULL(rl.materiales_liberados,0) AS materiales_liberados,
                ISNULL(rl.cantidad_total,0) AS cantidad_total,
                ISNULL(rl.cantidad_liberada,0) AS cantidad_liberada,
                CASE
                    WHEN ISNULL(rl.cantidad_liberada,0)<=0 THEN 'PENDIENTE'
                    WHEN rl.materiales_liberados=rl.cantidad_materiales THEN 'LIBERADO'
                    ELSE 'PARCIAL'
                END AS estado_liberacion,
                (SELECT COUNT(*) FROM Remito r
                 WHERE r.idRegistroDeCompra=rc.registro_compra_id
                   AND ISNULL(r.activo,1)=1) AS cantidad_remitos_activos,

                p.proveedor_id,
                p.razon_social,
                p.cuit,

                e.nombre AS estado
            FROM registroDecompra rc
            LEFT JOIN Proveedor p
                ON p.proveedor_id = rc.proveedor_id
            LEFT JOIN estado_registroDecompra e
                ON e.estado_registroDecompra_id = rc.estado_registroDecompra_id
            LEFT JOIN ResumenLiberacion rl
                ON rl.id_oc=rc.registro_compra_id
            ORDER BY rc.estado_registroDecompra_id DESC
        `);

        res.json(result.recordset);

    } catch (error) {
        console.error('Error al obtener registros de compra:', error);

        res.status(error.statusCode || 500).json({
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
            rc.estado_registroDecompra_id AS estado_registroDeCompra_id,
            e.nombre AS estado,
            e.nombre AS estado_nombre
        FROM registroDecompra rc
        LEFT JOIN Proveedor p
            ON p.proveedor_id = rc.proveedor_id
        LEFT JOIN estado_registroDecompra e
            ON e.estado_registroDecompra_id = rc.estado_registroDecompra_id
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
        WITH RemitadoPorLinea AS (
            SELECT
                drc.id_detalle_oc,
                CAST(ISNULL(SUM(dr.cantidad),0) AS DECIMAL(18,2)) AS cantidad_en_remitos
            FROM Detalle_RegistroDeCompra drc
            LEFT JOIN Materiales material_oc
                ON material_oc.id_material=drc.id_material
            LEFT JOIN Remito r
                ON r.idRegistroDeCompra=drc.id_oc
               AND ISNULL(r.activo,1)=1
            LEFT JOIN Detalle_Remito dr
                ON dr.remito_id=r.remito_id
               AND dbo.fn_NormalizarClave(dr.Descripcion)=dbo.fn_NormalizarClave(COALESCE(drc.Descripcion,material_oc.nombre))
               AND dbo.fn_NormalizarClave(dr.UoM)=dbo.fn_NormalizarClave(drc.UoM)
            WHERE drc.id_oc=@id_oc
            GROUP BY drc.id_detalle_oc
        ), LiberadoPorLinea AS (
            SELECT
                drc.id_detalle_oc,
                CAST(ISNULL(SUM(CASE
                    WHEN liberacion.cantidad_liberada IS NOT NULL THEN liberacion.cantidad_liberada
                    WHEN ISNULL(r.liberado,0)=1 THEN dr.cantidad
                    ELSE 0
                END),0) AS DECIMAL(18,2)) AS cantidad_liberada
            FROM Detalle_RegistroDeCompra drc
            LEFT JOIN Materiales material_oc
                ON material_oc.id_material=drc.id_material
            LEFT JOIN Remito r
                ON r.idRegistroDeCompra=drc.id_oc
               AND ISNULL(r.activo,1)=1
            LEFT JOIN Detalle_Remito dr
                ON dr.remito_id=r.remito_id
               AND dbo.fn_NormalizarClave(dr.Descripcion)=dbo.fn_NormalizarClave(COALESCE(drc.Descripcion,material_oc.nombre))
               AND dbo.fn_NormalizarClave(dr.UoM)=dbo.fn_NormalizarClave(drc.UoM)
            OUTER APPLY (
                SELECT SUM(l.cantidad) AS cantidad_liberada
                FROM LiberacionRemitoDetalle l
                WHERE l.detalle_remito_id=dr.detalle_remito_id
                  AND ISNULL(l.activo,1)=1
            ) liberacion
            WHERE drc.id_oc=@id_oc
            GROUP BY drc.id_detalle_oc
        )
        SELECT
            drc.id_detalle_oc,
            drc.id_oc,
            drc.id_material,
            COALESCE(drc.Descripcion,m.nombre) AS material,
            drc.cantidad,
            drc.UoM,
            ISNULL(rem.cantidad_en_remitos,0) AS cantidad_en_remitos,
            ISNULL(lib.cantidad_liberada,0) AS cantidad_liberada,
            CASE
                WHEN ISNULL(rem.cantidad_en_remitos,0)>ISNULL(lib.cantidad_liberada,0)
                    THEN rem.cantidad_en_remitos-lib.cantidad_liberada
                ELSE 0
            END AS cantidad_pendiente_liberar,
            CASE
                WHEN ISNULL(lib.cantidad_liberada,0)<=0 THEN 'PENDIENTE'
                WHEN lib.cantidad_liberada>=drc.cantidad THEN 'LIBERADO'
                ELSE 'PARCIAL'
            END AS estado_liberacion
        FROM Detalle_RegistroDeCompra drc
        LEFT JOIN Materiales m
            ON m.id_material = drc.id_material
        LEFT JOIN RemitadoPorLinea rem
            ON rem.id_detalle_oc=drc.id_detalle_oc
        LEFT JOIN LiberadoPorLinea lib
            ON lib.id_detalle_oc=drc.id_detalle_oc
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
            tipo,
            fecha,
            fecha_entrega,
            proyecto_id,
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

        const numeroSql = String(numero).trim();
        const fechaSql = normalizarFechaSql(fecha, 'fecha', true);
        const fechaEntregaSql = normalizarFechaSql(fecha_entrega, 'fecha_entrega');
        const tipoSql = normalizarTipoRegistroCompra(tipo);

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

        const numeroDuplicado = await pool.request()
            .input('numero', sql.NVarChar(100), numeroSql)
            .query(`
                SELECT TOP 1 registro_compra_id
                FROM registroDecompra
                WHERE UPPER(LTRIM(RTRIM(numero))) = UPPER(@numero)
            `);

        if (numeroDuplicado.recordset.length > 0) {
            return res.status(409).json({
                message: `Ya existe un documento con el número ${numeroSql}`
            });
        }

        const estadoCreada = await pool.request()
            .input('nombre', sql.VarChar, 'CREADA')
            .query(`
                SELECT estado_registroDecompra_id AS estado_registroDeCompra_id
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
            .input('numero', sql.VarChar, numeroSql)
            .input('tipo', sql.VarChar(10), tipoSql)
            .input('fecha', sql.VarChar(10), fechaSql)
            .input('fecha_entrega', sql.VarChar(10), fechaEntregaSql)
            .input('proveedor_id', sql.BigInt, proveedorId)
            .input('observaciones', sql.VarChar, observaciones || null)
            .input('proyecto_id', sql.BigInt, proyecto_id || null)
            .input(
                'estado_registroDeCompra_id',
                sql.Int,
                estadoCreada.recordset[0].estado_registroDeCompra_id
            )
            .query(`
        INSERT INTO registroDecompra (
            numero,
            tipo,
            fecha,
            fecha_entrega,
            proveedor_id,
            observaciones,
            estado_registroDecompra_id,
            cantidad_pedida,
            proyecto_id
        )
        OUTPUT INSERTED.registro_compra_id
        VALUES (
            @numero,
            @tipo,
            CONVERT(date, @fecha, 23),
            CASE WHEN @fecha_entrega IS NULL THEN NULL ELSE CONVERT(date, @fecha_entrega, 23) END,
            @proveedor_id,
            @observaciones,
            @estado_registroDeCompra_id,
            0,
            @proyecto_id
        )
    `);

        const registroCompraId = insertCabecera.recordset[0].registro_compra_id;

        

        for (const item of detalle) {
            await obtenerUomId(transaction, item.UoM);
            const descripcion = String(item.nombre || item.descripcion || item.nombreMaterial || '').trim().replace(/\s+/g, ' ');
            if (!descripcion) throw errorValidacionMaterial('La descripciÃ³n del material es obligatoria');

            await new sql.Request(transaction)
                .input('id_oc', sql.BigInt, registroCompraId)
                .input('id_material', sql.BigInt, null)
                .input('descripcion', sql.NVarChar(255), descripcion)
                .input('cantidad', sql.Decimal(18, 2), item.cantidad)
                .input('UoM', sql.VarChar, item.UoM || null)
                .query(`
        INSERT INTO Detalle_RegistroDeCompra (
            id_oc,
            id_material,
            Descripcion,
            cantidad,
            UoM
        )
        VALUES (
            @id_oc,
            @id_material,
            @descripcion,
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

        res.status(error.statusCode || 500).json({
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
            tipo,
            fecha,
            fecha_entrega,
            proyecto_id,
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

        const numeroSql = String(numero).trim();
        const fechaSql = normalizarFechaSql(fecha, 'fecha', true);
        const fechaEntregaSql = normalizarFechaSql(fecha_entrega, 'fecha_entrega');
        const tipoSql = normalizarTipoRegistroCompra(tipo);

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

        const numeroDuplicado = await pool.request()
            .input('numero', sql.NVarChar(100), numeroSql)
            .input('registro_compra_id', sql.BigInt, id)
            .query(`
                SELECT TOP 1 registro_compra_id
                FROM registroDecompra
                WHERE UPPER(LTRIM(RTRIM(numero))) = UPPER(@numero)
                  AND registro_compra_id <> @registro_compra_id
            `);

        if (numeroDuplicado.recordset.length > 0) {
            return res.status(409).json({
                message: `Ya existe otro documento con el número ${numeroSql}`
            });
        }

        const registro = await pool.request()
            .input('registro_compra_id', sql.BigInt, id)
            .query(`
                SELECT
                    rc.registro_compra_id,
                    rc.estado_registroDecompra_id AS estado_registroDeCompra_id,
                    e.nombre AS estado
                FROM registroDecompra rc
                LEFT JOIN estado_registroDecompra e
                    ON e.estado_registroDecompra_id = rc.estado_registroDecompra_id
                WHERE rc.registro_compra_id = @registro_compra_id
            `);

        if (registro.recordset.length === 0) {
            return res.status(404).json({
                message: 'Registro de compra no encontrado'
            });
        }

        const estadoActual = String(registro.recordset[0].estado || '').trim().toUpperCase();
        if (estadoActual !== 'CREADA') {
            return res.status(409).json({
                message: `Solo se pueden editar registros de compra en estado CREADA. Estado actual: ${estadoActual || 'SIN ESTADO'}`
            });
        }

        const remitosConLiberaciones = await pool.request()
            .input('idRegistroDeCompra', sql.BigInt, id)
            .query(`
                SELECT COUNT(*) AS cantidad
                FROM Remito r
                WHERE r.idRegistroDeCompra=@idRegistroDeCompra
                  AND ISNULL(r.activo,1)=1
                  AND (ISNULL(r.liberado,0)=1 OR EXISTS(
                    SELECT 1 FROM Detalle_Remito dr
                    INNER JOIN LiberacionRemitoDetalle l
                        ON l.detalle_remito_id=dr.detalle_remito_id
                    WHERE dr.remito_id=r.remito_id AND ISNULL(l.activo,1)=1
                  ))
            `);

        if (Number(remitosConLiberaciones.recordset[0]?.cantidad || 0) > 0) {
            return res.status(409).json({
                message: 'No se puede editar la OC porque tiene uno o más remitos con liberaciones.'
            });
        }

        const cantidadesEnRemitos = await pool.request()
            .input('idRegistroDeCompra', sql.BigInt, id)
            .query(`
                SELECT
                    COALESCE(dr.Descripcion,m.nombre) AS material,
                    dr.UoM,
                    SUM(dr.cantidad) AS cantidad
                FROM Remito r
                INNER JOIN Detalle_Remito dr ON dr.remito_id=r.remito_id
                LEFT JOIN Materiales m ON m.id_material=dr.id_material
                WHERE r.idRegistroDeCompra=@idRegistroDeCompra
                  AND ISNULL(r.activo,1)=1
                GROUP BY COALESCE(dr.Descripcion,m.nombre),dr.UoM
            `);

        const detalleNuevo = new Map();
        for (const item of detalle) {
            const nombre = item.nombre || item.descripcion;
            const clave = `${normalizarNombreMaterial(nombre)}|${normalizarUom(item.UoM)}`;
            detalleNuevo.set(clave, Number(detalleNuevo.get(clave) || 0) + Number(item.cantidad || 0));
        }
        for (const item of cantidadesEnRemitos.recordset) {
            const clave = `${normalizarNombreMaterial(item.material)}|${normalizarUom(item.UoM)}`;
            const cantidadOcNueva = Number(detalleNuevo.get(clave) || 0);
            const cantidadRemitada = Number(item.cantidad || 0);
            if (cantidadOcNueva < cantidadRemitada) {
                return res.status(409).json({
                    message: `No se puede reducir o quitar ${item.material}: hay ${cantidadRemitada} ${normalizarUom(item.UoM)} cargados en remitos pendientes.`
                });
            }
        }

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const proveedorId = await obtenerProveedorId(transaction, req.body);

        await new sql.Request(transaction)
            .input('registro_compra_id', sql.BigInt, id)
            .input('numero', sql.VarChar, numeroSql)
            .input('tipo', sql.VarChar(10), tipoSql)
            .input('fecha', sql.VarChar(10), fechaSql)
            .input('fecha_entrega', sql.VarChar(10), fechaEntregaSql)
            .input('proveedor_id', sql.BigInt, proveedorId)
            .input('observaciones', sql.VarChar, observaciones || null)
            .input('proyecto_id', sql.BigInt, proyecto_id || null)
            .query(`
                UPDATE registroDecompra
                SET
                    numero = @numero,
                    tipo = @tipo,
                    fecha = CONVERT(date, @fecha, 23),
                    fecha_entrega = CASE WHEN @fecha_entrega IS NULL THEN NULL ELSE CONVERT(date, @fecha_entrega, 23) END,
                    proveedor_id = @proveedor_id,
                    observaciones = @observaciones,
                    proyecto_id = @proyecto_id
                WHERE registro_compra_id = @registro_compra_id
            `);

        await new sql.Request(transaction)
            .input('id_oc', sql.BigInt, id)
            .query(`
                DELETE FROM Detalle_RegistroDeCompra
                WHERE id_oc = @id_oc
            `);

        for (const item of detalle) {
            await obtenerUomId(transaction, item.UoM);
            const descripcion = String(item.nombre || item.descripcion || item.nombreMaterial || '').trim().replace(/\s+/g, ' ');
            if (!descripcion) throw errorValidacionMaterial('La descripciÃ³n del material es obligatoria');

            await new sql.Request(transaction)
                .input('id_oc', sql.BigInt, id)
                .input('id_material', sql.BigInt, null)
                .input('descripcion', sql.NVarChar(255), descripcion)
                .input('cantidad', sql.Decimal(18, 2), item.cantidad)
                .input('UoM', sql.VarChar, item.UoM || null)
                .query(`
                    INSERT INTO Detalle_RegistroDeCompra (
                        id_oc,
                        id_material,
                        Descripcion,
                        cantidad,
                        UoM
                    )
                    VALUES (
                        @id_oc,
                        @id_material,
                        @descripcion,
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

        res.status(error.statusCode || 500).json({
            message: 'Error al actualizar registro de compra',
            error: error.message
        });
    }
};


// ======================================================
// PUT - CANCELAR REGISTRO DE COMPRA
// ======================================================

const obtenerImpactoCancelacion = async (req, res) => {
    const registroCompraId = Number(req.params.id);
    if (!Number.isInteger(registroCompraId) || registroCompraId <= 0) {
        return res.status(400).json({ message: 'Registro de compra invalido' });
    }
    try {
        const pool = await conectarDB();
        const result = await pool.request()
            .input('registro_compra_id', sql.BigInt, registroCompraId)
            .query(`
                SELECT rc.registro_compra_id,rc.numero,rc.tipo,e.nombre AS estado,
                    (SELECT COUNT(*) FROM Remito r
                     WHERE r.idRegistroDeCompra=rc.registro_compra_id
                       AND ISNULL(r.activo,1)=1) AS remitos_activos,
                    (SELECT COUNT(*) FROM Remito r
                     WHERE r.idRegistroDeCompra=rc.registro_compra_id
                       AND ISNULL(r.activo,1)=1
                       AND (ISNULL(r.liberado,0)=1 OR EXISTS(
                           SELECT 1 FROM Detalle_Remito dr
                           INNER JOIN LiberacionRemitoDetalle l
                               ON l.detalle_remito_id=dr.detalle_remito_id
                           WHERE dr.remito_id=r.remito_id AND ISNULL(l.activo,1)=1
                       ))) AS remitos_con_liberaciones,
                    (SELECT COUNT(*) FROM Remito r
                     WHERE r.idRegistroDeCompra=rc.registro_compra_id
                       AND ISNULL(r.activo,1)=1 AND ISNULL(r.liberado,0)=0
                       AND NOT EXISTS(
                           SELECT 1 FROM Detalle_Remito dr
                           INNER JOIN LiberacionRemitoDetalle l
                               ON l.detalle_remito_id=dr.detalle_remito_id
                           WHERE dr.remito_id=r.remito_id AND ISNULL(l.activo,1)=1
                       )) AS remitos_a_desactivar
                FROM registroDecompra rc
                LEFT JOIN estado_registroDecompra e ON e.estado_registroDecompra_id=rc.estado_registroDecompra_id
                WHERE rc.registro_compra_id=@registro_compra_id
            `);
        if (!result.recordset.length) return res.status(404).json({ message: 'Registro de compra no encontrado' });
        const remitos = await pool.request()
            .input('registro_compra_id', sql.BigInt, registroCompraId)
            .query(`
                SELECT
                    r.remito_id,
                    r.numero,
                    CASE WHEN ISNULL(r.liberado,0)=1 OR EXISTS(
                        SELECT 1
                        FROM Detalle_Remito dr
                        INNER JOIN LiberacionRemitoDetalle l
                            ON l.detalle_remito_id=dr.detalle_remito_id
                        WHERE dr.remito_id=r.remito_id AND ISNULL(l.activo,1)=1
                    ) THEN 'LIBERADO' ELSE 'PENDIENTE' END AS estado_liberacion
                FROM Remito r
                WHERE r.idRegistroDeCompra=@registro_compra_id
                  AND ISNULL(r.activo,1)=1
                ORDER BY r.remito_id
            `);
        res.json({ ...result.recordset[0], remitos: remitos.recordset });
    } catch (error) {
        console.error('Error al calcular impacto de cancelacion:', error);
        res.status(500).json({ message: 'No se pudo calcular el impacto de la cancelacion', error: error.message });
    }
};

const cancelarRegistroCompra = async (req, res) => {
    let transaction;
    try {
        const { id } = req.params;

        const pool = await conectarDB();
        transaction = new sql.Transaction(pool);
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const registro = await new sql.Request(transaction)
            .input('registro_compra_id', sql.BigInt, id)
            .query(`
                SELECT
                    rc.registro_compra_id,
                    rc.estado_registroDecompra_id AS estado_registroDeCompra_id,
                    e.nombre AS estado
                FROM registroDecompra rc
                LEFT JOIN estado_registroDecompra e
                    ON e.estado_registroDecompra_id = rc.estado_registroDecompra_id
                WHERE rc.registro_compra_id = @registro_compra_id
            `);

        if (registro.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({
                message: 'Registro de compra no encontrado'
            });
        }

        const estadoActual = String(registro.recordset[0].estado || '').trim().toUpperCase();
        if (estadoActual !== 'CREADA') {
            await transaction.rollback();
            return res.status(409).json({
                message: `Solo se pueden cancelar registros de compra en estado CREADA. Estado actual: ${estadoActual || 'SIN ESTADO'}`
            });
        }

        const estadoCancelada = await new sql.Request(transaction)
            .input('nombre', sql.VarChar, 'CANCELADA')
            .query(`
                SELECT estado_registroDecompra_id AS estado_registroDeCompra_id
                FROM estado_registroDecompra
                WHERE nombre = @nombre
            `);

        if (!estadoCancelada.recordset.length) throw new Error('No existe el estado CANCELADA');

        await new sql.Request(transaction)
            .input('registro_compra_id', sql.BigInt, id)
            .input('estado_cancelada_id', sql.Int, estadoCancelada.recordset[0].estado_registroDeCompra_id)
            .query(`
                UPDATE registroDecompra
                SET estado_registroDecompra_id = @estado_cancelada_id
                WHERE registro_compra_id = @registro_compra_id
            `);

        const remitos = await new sql.Request(transaction)
            .input('registro_compra_id', sql.BigInt, id)
            .query(`
                UPDATE r SET activo=0
                FROM Remito r
                WHERE r.idRegistroDeCompra=@registro_compra_id
                  AND ISNULL(r.activo,1)=1
                  AND ISNULL(r.liberado,0)=0
                  AND NOT EXISTS(
                    SELECT 1 FROM LiberacionRemitoDetalle l
                    INNER JOIN Detalle_Remito dl ON dl.detalle_remito_id=l.detalle_remito_id
                    WHERE dl.remito_id=r.remito_id AND ISNULL(l.activo,1)=1
                  )
            `);

        await transaction.commit();

        res.json({
            message: 'Registro de compra cancelado correctamente',
            remitos_desactivados: remitos.rowsAffected[0] || 0
        });

    } catch (error) {
        if (transaction) try { await transaction.rollback(); } catch {}
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
    obtenerImpactoCancelacion,
    cancelarRegistroCompra
};
