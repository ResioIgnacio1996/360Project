const { conectarDB, sql } = require('../DB/dbConection');

const getClientes = async (req, res) => {
    try {
        const pool = await conectarDB();

        const result = await pool.request().query(`
            SELECT
                id_cliente,
                nombre,
                apellido,
                cuil
            FROM Cliente
            ORDER BY apellido, nombre
        `);

        res.json(result.recordset);

    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({
            message: 'Error al obtener clientes'
        });
    }
};

const getClienteById = async (req, res) => {
    try {
        const { id } = req.params;

        const pool = await conectarDB();

        const result = await pool.request()
            .input('id_cliente', sql.BigInt, id)
            .query(`
                SELECT
                    id_cliente,
                    nombre,
                    apellido,
                    cuil
                FROM Cliente
                WHERE id_cliente = @id_cliente
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                message: 'Cliente no encontrado'
            });
        }

        res.json(result.recordset[0]);

    } catch (error) {
        console.error('Error al obtener cliente:', error);
        res.status(500).json({
            message: 'Error al obtener cliente'
        });
    }
};

const createCliente = async (req, res) => {
    try {

        const {
            nombre,
            apellido,
            cuil
        } = req.body;

        if (!nombre || !apellido) {
            return res.status(400).json({
                message: 'Nombre y apellido son obligatorios'
            });
        }

        const pool = await conectarDB();

        const result = await pool.request()
            .input('nombre', sql.VarChar(50), nombre)
            .input('apellido', sql.NVarChar(50), apellido)
            .input('cuil', sql.NVarChar(50), cuil || null)
            .query(`
                INSERT INTO Cliente
                (
                    nombre,
                    apellido,
                    cuil
                )
                VALUES
                (
                    @nombre,
                    @apellido,
                    @cuil
                );

                SELECT SCOPE_IDENTITY() AS id_cliente;
            `);

        res.status(201).json({
            message: 'Cliente creado correctamente',
            id_cliente: result.recordset[0].id_cliente
        });

    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({
            message: 'Error al crear cliente'
        });
    }
};

const updateCliente = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            nombre,
            apellido,
            cuil
        } = req.body;

        const pool = await conectarDB();

        const existe = await pool.request()
            .input('id_cliente', sql.BigInt, id)
            .query(`
                SELECT id_cliente
                FROM Cliente
                WHERE id_cliente = @id_cliente
            `);

        if (existe.recordset.length === 0) {
            return res.status(404).json({
                message: 'Cliente no encontrado'
            });
        }

        await pool.request()
            .input('id_cliente', sql.BigInt, id)
            .input('nombre', sql.VarChar(50), nombre)
            .input('apellido', sql.NVarChar(50), apellido)
            .input('cuil', sql.NVarChar(50), cuil || null)
            .query(`
                UPDATE Cliente
                SET
                    nombre = @nombre,
                    apellido = @apellido,
                    cuil = @cuil
                WHERE id_cliente = @id_cliente
            `);

        res.json({
            message: 'Cliente actualizado correctamente'
        });

    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({
            message: 'Error al actualizar cliente'
        });
    }
};

const deleteCliente = async (req, res) => {
    try {

        const { id } = req.params;

        const pool = await conectarDB();

        const existe = await pool.request()
            .input('id_cliente', sql.BigInt, id)
            .query(`
                SELECT id_cliente
                FROM Cliente
                WHERE id_cliente = @id_cliente
            `);

        if (existe.recordset.length === 0) {
            return res.status(404).json({
                message: 'Cliente no encontrado'
            });
        }

        await pool.request()
            .input('id_cliente', sql.BigInt, id)
            .query(`
                DELETE FROM Cliente
                WHERE id_cliente = @id_cliente
            `);

        res.json({
            message: 'Cliente eliminado correctamente'
        });

    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({
            message: 'Error al eliminar cliente'
        });
    }
};

module.exports = {
    getClientes,
    getClienteById,
    createCliente,
    updateCliente,
    deleteCliente
};