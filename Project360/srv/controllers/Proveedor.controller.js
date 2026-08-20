const { conectarDB, sql } = require('../DB/dbConection');

const limpiarRazonSocial = value => String(value || '').trim().replace(/\s+/g, ' ');
const expresionRazonNormalizada = `UPPER(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(razon_social)), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')) COLLATE Latin1_General_CI_AI`;

const buscarRazonSocialDuplicada = async (pool, razonSocial, proveedorId = null) => {
    const request = pool.request()
        .input('razon_social_normalizada', sql.NVarChar(150), limpiarRazonSocial(razonSocial).toUpperCase());
    if (proveedorId !== null) request.input('proveedor_id', sql.BigInt, proveedorId);
    return request.query(`
        SELECT TOP 1 proveedor_id, razon_social
        FROM Proveedor
        WHERE ${expresionRazonNormalizada} = @razon_social_normalizada COLLATE Latin1_General_CI_AI
          ${proveedorId !== null ? 'AND proveedor_id <> @proveedor_id' : ''}
    `);
};

const getProveedores = async (req, res) => {
    try {
        const pool = await conectarDB();

        const result = await pool.request().query(`
            SELECT
                p.proveedor_id,
                p.razon_social,
                p.cuit,
                p.telefono,
                p.email,
                p.direccion,
                p.ubicacion,
                p.rubro_id,
                r.nombre AS rubro,
                p.activo
            FROM Proveedor p
            INNER JOIN Rubro r ON r.rubro_id = p.rubro_id
            ORDER BY p.razon_social
        `);

        res.json(result.recordset);

    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        res.status(500).json({ message: 'Error al obtener proveedores' });
    }
};

const getProveedorById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await conectarDB();

        const result = await pool.request()
            .input('proveedor_id', sql.BigInt, id)
            .query(`
                SELECT
                    p.proveedor_id,
                    p.razon_social,
                    p.cuit,
                    p.telefono,
                    p.email,
                    p.direccion,
                    p.ubicacion,
                    p.rubro_id,
                    r.nombre AS rubro,
                    p.activo
                FROM Proveedor p
                INNER JOIN Rubro r ON r.rubro_id = p.rubro_id
                WHERE p.proveedor_id = @proveedor_id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Proveedor no encontrado' });
        }

        res.json(result.recordset[0]);

    } catch (error) {
        console.error('Error al obtener proveedor:', error);
        res.status(500).json({ message: 'Error al obtener proveedor' });
    }
};

const getRubrosProveedor = async (req, res) => {
    try {
        const pool = await conectarDB();

        const result = await pool.request().query(`
            SELECT
                rubro_id,
                nombre
            FROM Rubro
            ORDER BY nombre
        `);

        res.json(result.recordset);

    } catch (error) {
        console.error('Error al obtener rubros:', error);
        res.status(500).json({ message: 'Error al obtener rubros' });
    }
};

const createRubroProveedor = async (req, res) => {
    const nombre = req.body.nombre?.trim();

    if (!nombre) {
        return res.status(400).json({ message: 'El nombre del rubro es obligatorio' });
    }

    if (nombre.length > 100) {
        return res.status(400).json({ message: 'El nombre del rubro no puede superar los 100 caracteres' });
    }

    try {
        const pool = await conectarDB();
        const existente = await pool.request()
            .input('nombre', sql.NVarChar(100), nombre)
            .query(`
                SELECT TOP 1 rubro_id, nombre
                FROM Rubro
                WHERE LOWER(LTRIM(RTRIM(nombre))) = LOWER(@nombre)
            `);

        if (existente.recordset.length) {
            return res.json({ rubro: existente.recordset[0], existente: true });
        }

        const result = await pool.request()
            .input('nombre', sql.NVarChar(100), nombre)
            .query(`
                INSERT INTO Rubro (nombre)
                OUTPUT INSERTED.rubro_id, INSERTED.nombre
                VALUES (@nombre)
            `);

        res.status(201).json({ rubro: result.recordset[0], existente: false });
    } catch (error) {
        console.error('Error al crear rubro:', error);
        res.status(500).json({ message: 'Error al crear rubro' });
    }
};

const createProveedor = async (req, res) => {
    try {
        const {
            razon_social,
            cuit,
            telefono,
            email,
            direccion,
            ubicacion,
            rubro_id,
            activo
        } = req.body;

        const razonSocialLimpia = limpiarRazonSocial(razon_social);
        if (!razonSocialLimpia) {
            return res.status(400).json({
                message: 'La razón social es obligatoria'
            });
        }

        if (!rubro_id) {
            return res.status(400).json({
                message: 'El rubro es obligatorio'
            });
        }

        const pool = await conectarDB();

        const duplicado = await buscarRazonSocialDuplicada(pool, razonSocialLimpia);
        if (duplicado.recordset.length > 0) {
            return res.status(409).json({
                message: `Ya existe un proveedor con la razon social ${duplicado.recordset[0].razon_social}`
            });
        }

        const rubroExiste = await pool.request()
            .input('rubro_id', sql.BigInt, rubro_id)
            .query(`
                SELECT rubro_id
                FROM Rubro
                WHERE rubro_id = @rubro_id
            `);

        if (rubroExiste.recordset.length === 0) {
            return res.status(400).json({
                message: 'El rubro informado no existe'
            });
        }

        const result = await pool.request()
            .input('razon_social', sql.NVarChar(150), razonSocialLimpia)
            .input('cuit', sql.NVarChar(50), cuit || null)
            .input('telefono', sql.NVarChar(50), telefono || null)
            .input('email', sql.NVarChar(100), email || null)
            .input('direccion', sql.NVarChar(150), direccion || null)
            .input('ubicacion', sql.NVarChar(150), ubicacion || null)
            .input('rubro_id', sql.BigInt, rubro_id)
            .input('activo', sql.Bit, activo !== undefined ? activo : true)
            .query(`
                INSERT INTO Proveedor
                (
                    razon_social,
                    cuit,
                    telefono,
                    email,
                    direccion,
                    ubicacion,
                    rubro_id,
                    activo
                )
                VALUES
                (
                    @razon_social,
                    @cuit,
                    @telefono,
                    @email,
                    @direccion,
                    @ubicacion,
                    @rubro_id,
                    @activo
                );

                SELECT SCOPE_IDENTITY() AS proveedor_id;
            `);

        res.status(201).json({
            message: 'Proveedor creado correctamente',
            proveedor_id: result.recordset[0].proveedor_id
        });

    } catch (error) {
        console.error('Error al crear proveedor:', error);
        res.status(500).json({
            message: 'Error al crear proveedor'
        });
    }
};

const updateProveedor = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            razon_social,
            cuit,
            telefono,
            email,
            direccion,
            ubicacion,
            rubro_id,
            activo
        } = req.body;

        const razonSocialLimpia = limpiarRazonSocial(razon_social);
        if (!razonSocialLimpia) {
            return res.status(400).json({
                message: 'La razón social es obligatoria'
            });
        }

        if (!rubro_id) {
            return res.status(400).json({
                message: 'El rubro es obligatorio'
            });
        }

        const pool = await conectarDB();

        const proveedorExiste = await pool.request()
            .input('proveedor_id', sql.BigInt, id)
            .query(`
                SELECT proveedor_id
                FROM Proveedor
                WHERE proveedor_id = @proveedor_id
            `);

        if (proveedorExiste.recordset.length === 0) {
            return res.status(404).json({
                message: 'Proveedor no encontrado'
            });
        }

        const duplicado = await buscarRazonSocialDuplicada(pool, razonSocialLimpia, id);
        if (duplicado.recordset.length > 0) {
            return res.status(409).json({
                message: `Ya existe un proveedor con la razon social ${duplicado.recordset[0].razon_social}`
            });
        }

        const rubroExiste = await pool.request()
            .input('rubro_id', sql.BigInt, rubro_id)
            .query(`
                SELECT rubro_id
                FROM Rubro
                WHERE rubro_id = @rubro_id
            `);

        if (rubroExiste.recordset.length === 0) {
            return res.status(400).json({
                message: 'El rubro informado no existe'
            });
        }

        await pool.request()
            .input('proveedor_id', sql.BigInt, id)
            .input('razon_social', sql.NVarChar(150), razonSocialLimpia)
            .input('cuit', sql.NVarChar(50), cuit || null)
            .input('telefono', sql.NVarChar(50), telefono || null)
            .input('email', sql.NVarChar(100), email || null)
            .input('direccion', sql.NVarChar(150), direccion || null)
            .input('ubicacion', sql.NVarChar(150), ubicacion || null)
            .input('rubro_id', sql.BigInt, rubro_id)
            .input('activo', sql.Bit, activo !== undefined ? activo : true)
            .query(`
                UPDATE Proveedor
                SET
                    razon_social = @razon_social,
                    cuit = @cuit,
                    telefono = @telefono,
                    email = @email,
                    direccion = @direccion,
                    ubicacion = @ubicacion,
                    rubro_id = @rubro_id,
                    activo = @activo
                WHERE proveedor_id = @proveedor_id
            `);

        res.json({
            message: 'Proveedor actualizado correctamente'
        });

    } catch (error) {
        console.error('Error al actualizar proveedor:', error);
        res.status(500).json({ message: 'Error al actualizar proveedor' });
    }
};

const deleteProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await conectarDB();

        const proveedorExiste = await pool.request()
            .input('proveedor_id', sql.BigInt, id)
            .query(`
                SELECT proveedor_id
                FROM Proveedor
                WHERE proveedor_id = @proveedor_id
            `);

        if (proveedorExiste.recordset.length === 0) {
            return res.status(404).json({
                message: 'Proveedor no encontrado'
            });
        }

        await pool.request()
            .input('proveedor_id', sql.BigInt, id)
            .query(`
                DELETE FROM Proveedor
                WHERE proveedor_id = @proveedor_id
            `);

        res.json({
            message: 'Proveedor eliminado correctamente'
        });

    } catch (error) {
        console.error('Error al eliminar proveedor:', error);
        res.status(500).json({ message: 'Error al eliminar proveedor' });
    }
};

module.exports = {
    getProveedores,
    getProveedorById,
    getRubrosProveedor,
    createRubroProveedor,
    createProveedor,
    updateProveedor,
    deleteProveedor
};
