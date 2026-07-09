const { conectarDB, sql } = require('../../DB/dbConection');

const getEntidades = async (req, res) => {
  try {
    const pool = await conectarDB();

    const result = await pool.request().query(`
      SELECT entidad_id, codigo, nombre, descripcion, modulo, activo
      FROM Entidad
      ORDER BY entidad_id DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener entidades:', error);
    res.status(500).json({ message: 'Error al obtener entidades' });
  }
};

const getEntidadById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await conectarDB();

    const result = await pool.request()
      .input('entidad_id', sql.BigInt, id)
      .query(`
        SELECT entidad_id, codigo, nombre, descripcion, modulo, activo
        FROM Entidad
        WHERE entidad_id = @entidad_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Entidad no encontrada' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error al obtener entidad:', error);
    res.status(500).json({ message: 'Error al obtener entidad' });
  }
};

const createEntidad = async (req, res) => {
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
        SELECT TOP 1 entidad_id
        FROM Entidad
        WHERE codigo = @codigo
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        message: 'Ya existe una entidad con ese código'
      });
    }

    const result = await pool.request()
      .input('codigo', sql.VarChar(100), codigo)
      .input('nombre', sql.VarChar(150), nombre)
      .input('descripcion', sql.VarChar(255), descripcion || null)
      .input('modulo', sql.VarChar(100), modulo || null)
      .input('activo', sql.Bit, activo ?? true)
      .query(`
        INSERT INTO Entidad (
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
      message: 'Entidad creada correctamente',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al crear entidad:', error);
    res.status(500).json({ message: 'Error al crear entidad' });
  }
};

const updateEntidad = async (req, res) => {
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
      .input('entidad_id', sql.BigInt, id)
      .input('codigo', sql.VarChar(100), codigo)
      .input('nombre', sql.VarChar(150), nombre)
      .input('descripcion', sql.VarChar(255), descripcion || null)
      .input('modulo', sql.VarChar(100), modulo || null)
      .input('activo', sql.Bit, activo ?? true)
      .query(`
        UPDATE Entidad
        SET
          codigo = @codigo,
          nombre = @nombre,
          descripcion = @descripcion,
          modulo = @modulo,
          activo = @activo
        OUTPUT INSERTED.*
        WHERE entidad_id = @entidad_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Entidad no encontrada' });
    }

    res.json({
      message: 'Entidad actualizada correctamente',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al actualizar entidad:', error);
    res.status(500).json({ message: 'Error al actualizar entidad' });
  }
};

const deleteEntidad = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await conectarDB();

    const result = await pool.request()
      .input('entidad_id', sql.BigInt, id)
      .query(`
        DELETE FROM Entidad
        WHERE entidad_id = @entidad_id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Entidad no encontrada' });
    }

    res.json({ message: 'Entidad eliminada correctamente' });

  } catch (error) {
    console.error('Error al eliminar entidad:', error);
    res.status(500).json({
      message: 'No se puede eliminar la entidad. Puede estar asociada a permisos.'
    });
  }
};

module.exports = {
  getEntidades,
  getEntidadById,
  createEntidad,
  updateEntidad,
  deleteEntidad
};