const { conectarDB, sql } = require('../DB/dbConection');

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

        if (!razon_social || razon_social.trim() === '') {
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
            .input('razon_social', sql.NVarChar(150), razon_social.trim())
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

        if (!razon_social || razon_social.trim() === '') {
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
            .input('razon_social', sql.NVarChar(150), razon_social.trim())
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
    createProveedor,
    updateProveedor,
    deleteProveedor
};