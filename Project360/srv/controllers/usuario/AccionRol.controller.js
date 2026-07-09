const { conectarDB, sql } = require('../../DB/dbConection');

// GET TODOS
const getAccionesRol = async (req, res) => {
  try {
    const pool = await conectarDB();

    const result = await pool.request().query(`
      SELECT 
        ar.accion_rol_id,
        ar.rol_id,
        r.nombre AS rol_nombre,
        ar.accion_id,
        a.nombre AS accion_nombre,
        ar.permitido
      FROM Accion_Rol ar
      INNER JOIN Rol r ON ar.rol_id = r.rol_id
      INNER JOIN Accion a ON ar.accion_id = a.accion_id
      ORDER BY ar.accion_rol_id DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener acciones por rol:', error);
    res.status(500).json({ message: 'Error al obtener acciones por rol' });
  }
};

// GET POR ID
const getAccionRolById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await conectarDB();

    const result = await pool.request()
      .input('accion_rol_id', sql.BigInt, id)
      .query(`
        SELECT 
          ar.accion_rol_id,
          ar.rol_id,
          r.nombre AS rol_nombre,
          ar.accion_id,
          a.nombre AS accion_nombre,
          ar.permitido
        FROM Accion_Rol ar
        INNER JOIN Rol r ON ar.rol_id = r.rol_id
        INNER JOIN Accion a ON ar.accion_id = a.accion_id
        WHERE ar.accion_rol_id = @accion_rol_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Relación acción-rol no encontrada' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error al obtener acción por rol:', error);
    res.status(500).json({ message: 'Error al obtener acción por rol' });
  }
};

// CREATE
const createAccionRol = async (req, res) => {
  try {
    const { rol_id, accion_id, permitido } = req.body;

    if (!rol_id || !accion_id) {
      return res.status(400).json({
        message: 'rol_id y accion_id son obligatorios'
      });
    }

    const pool = await conectarDB();

    const existe = await pool.request()
      .input('rol_id', sql.BigInt, rol_id)
      .input('accion_id', sql.BigInt, accion_id)
      .query(`
        SELECT TOP 1 accion_rol_id
        FROM Accion_Rol
        WHERE rol_id = @rol_id
        AND accion_id = @accion_id
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        message: 'Esta acción ya está asignada a este rol'
      });
    }

    const result = await pool.request()
      .input('rol_id', sql.BigInt, rol_id)
      .input('accion_id', sql.BigInt, accion_id)
      .input('permitido', sql.Bit, permitido ?? true)
      .query(`
        INSERT INTO Accion_Rol (
          rol_id,
          accion_id,
          permitido
        )
        OUTPUT INSERTED.*
        VALUES (
          @rol_id,
          @accion_id,
          @permitido
        )
      `);

    res.status(201).json({
      message: 'Acción asignada al rol correctamente',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al crear acción-rol:', error);
    res.status(500).json({
      message: 'Error al crear acción-rol'
    });
  }
};

// UPDATE
const updateAccionRol = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol_id, accion_id, permitido } = req.body;

    if (!rol_id || !accion_id) {
      return res.status(400).json({
        message: 'rol_id y accion_id son obligatorios'
      });
    }

    const pool = await conectarDB();

    const result = await pool.request()
      .input('accion_rol_id', sql.BigInt, id)
      .input('rol_id', sql.BigInt, rol_id)
      .input('accion_id', sql.BigInt, accion_id)
      .input('permitido', sql.Bit, permitido ?? true)
      .query(`
        UPDATE Accion_Rol
        SET
          rol_id = @rol_id,
          accion_id = @accion_id,
          permitido = @permitido
        OUTPUT INSERTED.*
        WHERE accion_rol_id = @accion_rol_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Relación acción-rol no encontrada' });
    }

    res.json({
      message: 'Acción-rol actualizada correctamente',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al actualizar acción-rol:', error);
    res.status(500).json({
      message: 'Error al actualizar acción-rol'
    });
  }
};

// DELETE
const deleteAccionRol = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await conectarDB();

    const result = await pool.request()
      .input('accion_rol_id', sql.BigInt, id)
      .query(`
        DELETE FROM Accion_Rol
        WHERE accion_rol_id = @accion_rol_id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        message: 'Relación acción-rol no encontrada'
      });
    }

    res.json({
      message: 'Acción-rol eliminada correctamente'
    });

  } catch (error) {
    console.error('Error al eliminar acción-rol:', error);
    res.status(500).json({
      message: 'Error al eliminar acción-rol'
    });
  }
};

module.exports = {
  getAccionesRol,
  getAccionRolById,
  createAccionRol,
  updateAccionRol,
  deleteAccionRol
};