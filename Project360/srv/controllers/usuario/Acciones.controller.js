const { conectarDB, sql } = require('../../DB/dbConection')


  /*try {
    const pool = await conectarDB();

    const result = await pool.request().query(`
      SELECT accion_id, codigo, nombre, descripcion, modulo, activo
      FROM Accion
      ORDER BY accion_id DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener acciones:', error);
    res.status(500).json({ message: 'Error al obtener acciones' });
  }*/

const getAcciones = async (req, res) => {
  try {
    const pool = await conectarDB();

    const result = await pool.request().query(`
      SELECT 
        accion_id,
        codigo,
        nombre,
        descripcion,
        modulo,
        activo
      FROM Accion
      ORDER BY accion_id DESC
    `);

    res.json(result.recordset);

  } catch (error) {
    console.error('Error al obtener acciones:', error);
    res.status(500).json({
      message: 'Error al obtener acciones'
    });
  }
};
const getAccionById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await conectarDB();

    const result = await pool.request()
      .input('accion_id', sql.BigInt, id)
      .query(`
        SELECT accion_id, codigo, nombre, descripcion, modulo, activo
        FROM Accion
        WHERE accion_id = @accion_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Acción no encontrada' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error al obtener acción:', error);
    res.status(500).json({ message: 'Error al obtener acción' });
  }
};

const createAccion = async (req, res) => {
  try {
    const { codigo, nombre, descripcion, modulo, activo } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({
        message: 'codigo y nombre son obligatorios'
      });
    }

    const pool = await conectarDB();

    const existe = await pool.request()
      .input('codigo', sql.VarChar(100), codigo)
      .query(`
        SELECT TOP 1 accion_id
        FROM Accion
        WHERE codigo = @codigo
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        message: 'Ya existe una acción con ese código'
      });
    }

    const result = await pool.request()
      .input('codigo', sql.VarChar(100), codigo)
      .input('nombre', sql.VarChar(150), nombre)
      .input('descripcion', sql.VarChar(255), descripcion || null)
      .input('modulo', sql.VarChar(100), modulo || null)
      .input('activo', sql.Bit, activo ?? true)
      .query(`
        INSERT INTO Accion (
          codigo,
          nombre,
          descripcion,
          modulo,
          activo
        )
        OUTPUT INSERTED.*
        VALUES (
          @codigo,
          @nombre,
          @descripcion,
          @modulo,
          @activo
        )
      `);

    res.status(201).json({
      message: 'Acción creada correctamente',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al crear acción:', error);
    res.status(500).json({ message: 'Error al crear acción' });
  }
};

const updateAccion = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, descripcion, modulo, activo } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({
        message: 'codigo y nombre son obligatorios'
      });
    }

    const pool = await conectarDB();

    const result = await pool.request()
      .input('accion_id', sql.BigInt, id)
      .input('codigo', sql.VarChar(100), codigo)
      .input('nombre', sql.VarChar(150), nombre)
      .input('descripcion', sql.VarChar(255), descripcion || null)
      .input('modulo', sql.VarChar(100), modulo || null)
      .input('activo', sql.Bit, activo ?? true)
      .query(`
        UPDATE Accion
        SET
          codigo = @codigo,
          nombre = @nombre,
          descripcion = @descripcion,
          modulo = @modulo,
          activo = @activo
        OUTPUT INSERTED.*
        WHERE accion_id = @accion_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Acción no encontrada' });
    }

    res.json({
      message: 'Acción actualizada correctamente',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al actualizar acción:', error);
    res.status(500).json({ message: 'Error al actualizar acción' });
  }
};

const deleteAccion = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await conectarDB();

    const result = await pool.request()
      .input('accion_id', sql.BigInt, id)
      .query(`
        DELETE FROM Accion
        WHERE accion_id = @accion_id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Acción no encontrada' });
    }

    res.json({ message: 'Acción eliminada correctamente' });

  } catch (error) {
    console.error('Error al eliminar acción:', error);
    res.status(500).json({
      message: 'No se puede eliminar la acción. Puede estar asociada a permisos.'
    });
  }
};

module.exports = {

  getAccionById,
  createAccion,
  updateAccion,
  deleteAccion,
  getAcciones
};