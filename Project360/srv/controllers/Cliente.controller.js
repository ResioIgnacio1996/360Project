const { conectarDB, sql } = require('../DB/dbConection');

const prepararDatosContacto = async (pool) => {
    await pool.request().query(`
        IF COL_LENGTH('Cliente', 'razon_social') IS NULL ALTER TABLE Cliente ADD razon_social NVARCHAR(150) NULL;
        IF COL_LENGTH('Cliente', 'telefono') IS NULL ALTER TABLE Cliente ADD telefono NVARCHAR(50) NULL;
        IF COL_LENGTH('Cliente', 'ubicacion') IS NULL ALTER TABLE Cliente ADD ubicacion NVARCHAR(150) NULL;
        IF COL_LENGTH('Cliente', 'email') IS NULL ALTER TABLE Cliente ADD email NVARCHAR(100) NULL;
    `);
    await pool.request().query(`
        UPDATE Cliente
        SET razon_social = LTRIM(RTRIM(CONCAT(NULLIF(apellido, ''), ' ', nombre)))
        WHERE NULLIF(LTRIM(RTRIM(razon_social)), '') IS NULL;
    `);
};

const camposCliente = 'id_cliente, nombre, apellido, cuil, razon_social, telefono, ubicacion, email';

const getClientes = async (_req, res) => {
    try {
        const pool = await conectarDB();
        await prepararDatosContacto(pool);
        const result = await pool.request().query(`SELECT ${camposCliente} FROM Cliente ORDER BY razon_social`);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ message: 'Error al obtener clientes' });
    }
};

const getClienteById = async (req, res) => {
    try {
        const pool = await conectarDB();
        await prepararDatosContacto(pool);
        const result = await pool.request()
            .input('id_cliente', sql.BigInt, req.params.id)
            .query(`SELECT ${camposCliente} FROM Cliente WHERE id_cliente = @id_cliente`);
        if (!result.recordset.length) return res.status(404).json({ message: 'Cliente no encontrado' });
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error al obtener cliente:', error);
        res.status(500).json({ message: 'Error al obtener cliente' });
    }
};

const soloDigitos = (valor) => String(valor || '').replace(/\D/g, '');
const formatearDocumento = (valor) => {
    const digitos = soloDigitos(valor);
    return digitos.length === 11 ? `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}` : null;
};

const normalizarCliente = (body) => ({
    razonSocial: body.razon_social?.trim() || body.nombre?.trim(),
    cuil: formatearDocumento(body.cuil),
    telefono: body.telefono?.trim() || null,
    ubicacion: body.ubicacion?.trim() || null,
    email: body.email?.trim() || null
});

const emailValido = (email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const buscarClienteConDocumento = async (pool, cuil, idCliente = null) => {
    const result = await pool.request()
        .input('cuil', sql.VarChar(11), soloDigitos(cuil))
        .input('id_cliente', sql.BigInt, idCliente)
        .query(`
            SELECT TOP 1 id_cliente, razon_social
            FROM Cliente
            WHERE REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(cuil)), '-', ''), '.', ''), ' ', '') = @cuil
              AND (@id_cliente IS NULL OR id_cliente <> @id_cliente)
        `);
    return result.recordset[0] || null;
};

const createCliente = async (req, res) => {
    const cliente = normalizarCliente(req.body);
    if (!cliente.razonSocial) return res.status(400).json({ message: 'La razón social o nombre es obligatorio' });
    if (!cliente.cuil) return res.status(400).json({ message: 'El CUIT/CUIL es obligatorio y debe tener 11 dígitos' });
    if (!emailValido(cliente.email)) return res.status(400).json({ message: 'El email no es válido' });
    try {
        const pool = await conectarDB();
        await prepararDatosContacto(pool);
        const duplicado = await buscarClienteConDocumento(pool, cliente.cuil);
        if (duplicado) return res.status(409).json({ message: 'Ya existe un cliente con ese CUIT/CUIL' });
        const result = await pool.request()
            .input('nombre', sql.VarChar(50), cliente.razonSocial.substring(0, 50))
            .input('apellido', sql.NVarChar(50), '')
            .input('razon_social', sql.NVarChar(150), cliente.razonSocial)
            .input('cuil', sql.NVarChar(50), cliente.cuil)
            .input('telefono', sql.NVarChar(50), cliente.telefono)
            .input('ubicacion', sql.NVarChar(150), cliente.ubicacion)
            .input('email', sql.NVarChar(100), cliente.email)
            .query(`
                INSERT INTO Cliente (nombre, apellido, razon_social, cuil, telefono, ubicacion, email)
                VALUES (@nombre, @apellido, @razon_social, @cuil, @telefono, @ubicacion, @email);
                SELECT SCOPE_IDENTITY() AS id_cliente;
            `);
        res.status(201).json({ message: 'Cliente creado correctamente', id_cliente: result.recordset[0].id_cliente });
    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({ message: 'Error al crear cliente' });
    }
};

const updateCliente = async (req, res) => {
    const cliente = normalizarCliente(req.body);
    if (!cliente.razonSocial) return res.status(400).json({ message: 'La razón social o nombre es obligatorio' });
    if (!cliente.cuil) return res.status(400).json({ message: 'El CUIT/CUIL es obligatorio y debe tener 11 dígitos' });
    if (!emailValido(cliente.email)) return res.status(400).json({ message: 'El email no es válido' });
    try {
        const pool = await conectarDB();
        await prepararDatosContacto(pool);
        const duplicado = await buscarClienteConDocumento(pool, cliente.cuil, req.params.id);
        if (duplicado) return res.status(409).json({ message: 'Ya existe otro cliente con ese CUIT/CUIL' });
        const result = await pool.request()
            .input('id_cliente', sql.BigInt, req.params.id)
            .input('nombre', sql.VarChar(50), cliente.razonSocial.substring(0, 50))
            .input('apellido', sql.NVarChar(50), '')
            .input('razon_social', sql.NVarChar(150), cliente.razonSocial)
            .input('cuil', sql.NVarChar(50), cliente.cuil)
            .input('telefono', sql.NVarChar(50), cliente.telefono)
            .input('ubicacion', sql.NVarChar(150), cliente.ubicacion)
            .input('email', sql.NVarChar(100), cliente.email)
            .query(`
                UPDATE Cliente SET nombre=@nombre, apellido=@apellido, razon_social=@razon_social,
                    cuil=@cuil, telefono=@telefono, ubicacion=@ubicacion, email=@email
                WHERE id_cliente=@id_cliente
            `);
        if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Cliente no encontrado' });
        res.json({ message: 'Cliente actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ message: 'Error al actualizar cliente' });
    }
};

const deleteCliente = async (req, res) => {
    try {
        const pool = await conectarDB();
        const result = await pool.request().input('id_cliente', sql.BigInt, req.params.id)
            .query('DELETE FROM Cliente WHERE id_cliente = @id_cliente');
        if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Cliente no encontrado' });
        res.json({ message: 'Cliente eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({ message: 'Error al eliminar cliente' });
    }
};

module.exports = { getClientes, getClienteById, createCliente, updateCliente, deleteCliente };
