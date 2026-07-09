const { conectarDB, sql } = require('../../DB/dbConection');

const getRoles = async (req, res) => {
  try {
    const pool = await conectarDB();

    const result = await pool.request().query(`
      SELECT rol_id, nombre, descripcion, activo
      FROM Rol
      ORDER BY nombre
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({ message: 'Error al obtener roles' });
  }
};

const getRolById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await conectarDB();

    const result = await pool.request()
      .input('rol_id', sql.Int, id)
      .query(`
        SELECT rol_id, nombre, descripcion, activo
        FROM Rol
        WHERE rol_id = @rol_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Rol no encontrado' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error al obtener rol:', error);
    res.status(500).json({ message: 'Error al obtener rol' });
  }
};

const getPermisosRol = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await conectarDB();

    const result = await pool.request()
      .input('rol_id', sql.Int, id)
      .query(`
        SELECT
          ar.accion_rol_id,
          ar.rol_id,
          ar.accion_id,
          a.codigo AS accion_codigo,
          a.nombre AS accion_nombre,
          ar.entidad_id,
          e.codigo AS entidad_codigo,
          e.nombre AS entidad_nombre,
          ar.permitido
        FROM Accion_Rol ar
        INNER JOIN Accion a ON ar.accion_id = a.accion_id
        INNER JOIN Entidad e ON ar.entidad_id = e.entidad_id
        WHERE ar.rol_id = @rol_id
        ORDER BY e.codigo, a.codigo
      `);

    res.json({
      rol_id: Number(id),
      permisos: result.recordset
    });
  } catch (error) {
    console.error('Error al obtener permisos del rol:', error);
    res.status(500).json({ message: 'Error al obtener permisos del rol' });
  }
};

const validarPermisosDuplicados = (permisos) => {
  const set = new Set();

  for (const permiso of permisos) {
    const key = `${permiso.accion_id}-${permiso.entidad_id}`;

    if (set.has(key)) {
      return true;
    }

    set.add(key);
  }

  return false;
};

const validarAccionesYEntidades = async (transaction, permisos) => {
  for (const permiso of permisos) {
    const accion = await new sql.Request(transaction)
      .input('accion_id', sql.Int, permiso.accion_id)
      .query(`
        SELECT accion_id
        FROM Accion
        WHERE accion_id = @accion_id
      `);

    if (accion.recordset.length === 0) {
      throw new Error(`La acción ${permiso.accion_id} no existe`);
    }

    const entidad = await new sql.Request(transaction)
      .input('entidad_id', sql.Int, permiso.entidad_id)
      .query(`
        SELECT entidad_id
        FROM Entidad
        WHERE entidad_id = @entidad_id
      `);

    if (entidad.recordset.length === 0) {
      throw new Error(`La entidad ${permiso.entidad_id} no existe`);
    }
  }
};

const insertarPermisos = async (transaction, rol_id, permisos) => {
  for (const permiso of permisos) {
    await new sql.Request(transaction)
      .input('rol_id', sql.Int, rol_id)
      .input('accion_id', sql.Int, permiso.accion_id)
      .input('entidad_id', sql.Int, permiso.entidad_id)
      .input('permitido', sql.Bit, permiso.permitido ?? false)
      .query(`
        INSERT INTO Accion_Rol (
          rol_id,
          accion_id,
          entidad_id,
          permitido
        )
        VALUES (
          @rol_id,
          @accion_id,
          @entidad_id,
          @permitido
        )
      `);
  }
};

const createRol = async (req, res) => {
  const pool = await conectarDB();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      nombre,
      descripcion,
      activo,
      permisos = []
    } = req.body;

    if (!nombre || !descripcion) {
      return res.status(400).json({
        message: 'nombre y descripcion son obligatorios'
      });
    }

    if (!Array.isArray(permisos)) {
      return res.status(400).json({
        message: 'permisos debe ser un arreglo'
      });
    }

    if (validarPermisosDuplicados(permisos)) {
      return res.status(400).json({
        message: 'No se permiten permisos duplicados para la misma acción y entidad'
      });
    }

    await transaction.begin();

    const existe = await new sql.Request(transaction)
      .input('nombre', sql.VarChar(100), nombre)
      .query(`
        SELECT rol_id
        FROM Rol
        WHERE nombre = @nombre
      `);

    if (existe.recordset.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Ya existe un rol con ese nombre'
      });
    }

    const rolResult = await new sql.Request(transaction)
      .input('nombre', sql.VarChar(100), nombre)
      .input('descripcion', sql.VarChar(255), descripcion)
      .input('activo', sql.Bit, activo ?? true)
      .query(`
        INSERT INTO Rol (
          nombre,
          descripcion,
          activo
        )
        OUTPUT INSERTED.rol_id
        VALUES (
          @nombre,
          @descripcion,
          @activo
        )
      `);

    const rol_id = rolResult.recordset[0].rol_id;

    if (permisos.length > 0) {
      await validarAccionesYEntidades(transaction, permisos);
      await insertarPermisos(transaction, rol_id, permisos);
    }

    await transaction.commit();

    res.status(201).json({
      message: 'Rol creado correctamente',
      rol_id
    });

  } catch (error) {
    try {
      await transaction.rollback();
    } catch {}

    console.error('Error al crear rol:', error);

    res.status(500).json({
      message: error.message || 'Error al crear rol'
    });
  }
};

const updateRol = async (req, res) => {
  const pool = await conectarDB();
  const transaction = new sql.Transaction(pool);

  try {
    const { id } = req.params;

    const {
      nombre,
      descripcion,
      activo,
      permisos = []
    } = req.body;

    if (!nombre || !descripcion) {
      return res.status(400).json({
        message: 'nombre y descripcion son obligatorios'
      });
    }

    if (!Array.isArray(permisos)) {
      return res.status(400).json({
        message: 'permisos debe ser un arreglo'
      });
    }

    if (validarPermisosDuplicados(permisos)) {
      return res.status(400).json({
        message: 'No se permiten permisos duplicados para la misma acción y entidad'
      });
    }

    await transaction.begin();

    const rolExiste = await new sql.Request(transaction)
      .input('rol_id', sql.Int, id)
      .query(`
        SELECT rol_id
        FROM Rol
        WHERE rol_id = @rol_id
      `);

    if (rolExiste.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Rol no encontrado'
      });
    }

    const nombreDuplicado = await new sql.Request(transaction)
      .input('rol_id', sql.Int, id)
      .input('nombre', sql.VarChar(100), nombre)
      .query(`
        SELECT rol_id
        FROM Rol
        WHERE nombre = @nombre
          AND rol_id <> @rol_id
      `);

    if (nombreDuplicado.recordset.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Ya existe otro rol con ese nombre'
      });
    }

    await new sql.Request(transaction)
      .input('rol_id', sql.Int, id)
      .input('nombre', sql.VarChar(100), nombre)
      .input('descripcion', sql.VarChar(255), descripcion)
      .input('activo', sql.Bit, activo ?? true)
      .query(`
        UPDATE Rol
        SET
          nombre = @nombre,
          descripcion = @descripcion,
          activo = @activo
        WHERE rol_id = @rol_id
      `);

    await new sql.Request(transaction)
      .input('rol_id', sql.Int, id)
      .query(`
        DELETE FROM Accion_Rol
        WHERE rol_id = @rol_id
      `);

    if (permisos.length > 0) {
      await validarAccionesYEntidades(transaction, permisos);
      await insertarPermisos(transaction, Number(id), permisos);
    }

    await transaction.commit();

    res.json({
      message: 'Rol actualizado correctamente',
      rol_id: Number(id)
    });

  } catch (error) {
    try {
      await transaction.rollback();
    } catch {}

    console.error('Error al actualizar rol:', error);

    res.status(500).json({
      message: error.message || 'Error al actualizar rol'
    });
  }
};

const deleteRol = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await conectarDB();

    const result = await pool.request()
      .input('rol_id', sql.Int, id)
      .query(`
        UPDATE Rol
        SET activo = 0
        OUTPUT
          INSERTED.rol_id,
          INSERTED.nombre,
          INSERTED.descripcion,
          INSERTED.activo
        WHERE rol_id = @rol_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        message: 'Rol no encontrado'
      });
    }

    res.json({
      message: 'Rol desactivado correctamente',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al desactivar rol:', error);
    res.status(500).json({
      message: 'Error al desactivar rol'
    });
  }
};
const cambiarEstadoRol = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    if (activo === undefined || activo === null) {
      return res.status(400).json({
        message: 'El campo activo es obligatorio'
      });
    }

    const pool = await conectarDB();

    const result = await pool.request()
      .input('rol_id', sql.Int, id)
      .input('activo', sql.Bit, activo)
      .query(`
        UPDATE Rol
        SET activo = @activo
        OUTPUT
          INSERTED.rol_id,
          INSERTED.nombre,
          INSERTED.descripcion,
          INSERTED.activo
        WHERE rol_id = @rol_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        message: 'Rol no encontrado'
      });
    }

    res.json({
      message: activo
        ? 'Rol activado correctamente'
        : 'Rol desactivado correctamente',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al cambiar estado del rol:', error);
    res.status(500).json({
      message: 'Error al cambiar estado del rol'
    });
  }
};
module.exports = {
  cambiarEstadoRol,
  getRoles,
  getRolById,
  getPermisosRol,
  createRol,
  updateRol,
  deleteRol
};