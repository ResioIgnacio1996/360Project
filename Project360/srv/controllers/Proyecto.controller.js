const { conectarDB, sql } = require('../DB/dbConection');

// GET TODOS
const getProyectos = async (req, res) => {
  try {
    const pool = await conectarDB();

    const result = await pool.request().query(`
      SELECT
        proyecto_id,
        cliente_id,
        nombre,
        cliente,
        direccion,
        fecha_inicio,
        fecha_fin_estimada,
        estado,
        version_plan_actual
      FROM Proyecto
      ORDER BY proyecto_id DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener proyectos:', error);
    res.status(500).json({ message: 'Error al obtener proyectos' });
  }
};

// GET POR ID
const getProyectoById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await conectarDB();

    const result = await pool.request()
      .input('proyecto_id', sql.BigInt, id)
      .query(`
        SELECT
          proyecto_id,
          cliente_id,
          nombre,
          cliente,
          direccion,
          fecha_inicio,
          fecha_fin_estimada,
          estado,
          version_plan_actual
        FROM Proyecto
        WHERE proyecto_id = @proyecto_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error al obtener proyecto:', error);
    res.status(500).json({ message: 'Error al obtener proyecto' });
  }
};

// CREATE
const createProyecto = async (req, res) => {
  try {
    const {
      cliente_id,
      nombre,
      cliente,
      direccion,
      fecha_inicio,
      fecha_fin_estimada,
      estado,
      version_plan_actual
    } = req.body;

    if (!nombre || !cliente_id) {
      return res.status(400).json({
        message: 'cliente_id y nombre son obligatorios'
      });
    }

    const pool = await conectarDB();

    const result = await pool.request()
      .input('cliente_id', sql.BigInt, cliente_id)
      .input('nombre', sql.VarChar(150), nombre)
      .input('cliente', sql.VarChar(150), cliente || null)
      .input('direccion', sql.VarChar(250), direccion || null)
      .input('fecha_inicio', sql.Date, fecha_inicio || null)
      .input('fecha_fin_estimada', sql.Date, fecha_fin_estimada || null)
      .input('estado', sql.VarChar(50), estado || 'ACTIVO')
      .input('version_plan_actual', sql.Int, version_plan_actual || 1)
      .query(`
        INSERT INTO Proyecto (
          cliente_id,
          nombre,
          cliente,
          direccion,
          fecha_inicio,
          fecha_fin_estimada,
          estado,
          version_plan_actual
        )
        OUTPUT INSERTED.*
        VALUES (
          @cliente_id,
          @nombre,
          @cliente,
          @direccion,
          @fecha_inicio,
          @fecha_fin_estimada,
          @estado,
          @version_plan_actual
        )
      `);

    res.status(201).json({
      message: 'Proyecto creado correctamente',
      proyecto: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al crear proyecto:', error);
    res.status(500).json({ message: 'Error al crear proyecto' });
  }
};

// UPDATE
const updateProyecto = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      cliente_id,
      nombre,
      cliente,
      direccion,
      fecha_inicio,
      fecha_fin_estimada,
      estado,
      version_plan_actual
    } = req.body;

    if (!nombre || !cliente_id) {
      return res.status(400).json({
        message: 'cliente_id y nombre son obligatorios'
      });
    }

    const pool = await conectarDB();

    const result = await pool.request()
      .input('proyecto_id', sql.BigInt, id)
      .input('cliente_id', sql.BigInt, cliente_id)
      .input('nombre', sql.VarChar(150), nombre)
      .input('cliente', sql.VarChar(150), cliente || null)
      .input('direccion', sql.VarChar(250), direccion || null)
      .input('fecha_inicio', sql.Date, fecha_inicio || null)
      .input('fecha_fin_estimada', sql.Date, fecha_fin_estimada || null)
      .input('estado', sql.VarChar(50), estado || 'ACTIVO')
      .input('version_plan_actual', sql.Int, version_plan_actual || 1)
      .query(`
        UPDATE Proyecto
        SET
          cliente_id = @cliente_id,
          nombre = @nombre,
          cliente = @cliente,
          direccion = @direccion,
          fecha_inicio = @fecha_inicio,
          fecha_fin_estimada = @fecha_fin_estimada,
          estado = @estado,
          version_plan_actual = @version_plan_actual
        OUTPUT INSERTED.*
        WHERE proyecto_id = @proyecto_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    res.json({
      message: 'Proyecto actualizado correctamente',
      proyecto: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al actualizar proyecto:', error);
    res.status(500).json({ message: 'Error al actualizar proyecto' });
  }
};

// DELETE
const deleteProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await conectarDB();

    const result = await pool.request()
      .input('proyecto_id', sql.BigInt, id)
      .query(`
        DELETE FROM Proyecto
        WHERE proyecto_id = @proyecto_id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    res.json({ message: 'Proyecto eliminado correctamente' });

  } catch (error) {
    console.error('Error al eliminar proyecto:', error);
    res.status(500).json({
      message: 'No se puede eliminar el proyecto. Puede estar relacionado con otras tablas.'
    });
  }
};

module.exports = {
  getProyectos,
  getProyectoById,
  createProyecto,
  updateProyecto,
  deleteProyecto
};