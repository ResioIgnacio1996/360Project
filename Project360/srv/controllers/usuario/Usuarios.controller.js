const bcrypt = require('bcrypt');
const { conectarDB, sql } = require('../../DB/dbConection');

const crearUsuarioConRol = async (req, res) => {
  const transaction = new sql.Transaction(await conectarDB());
  console.log(req.body)
  try {
    const {
      empresa_id,
      nombre,
      email,
      usuario,
      password,
      rol_id,
      activo
    } = req.body;

   /* if (!nombre || !email || !usuario || !password || !rol_id) {
      return res.status(400).json({
        message: 'nombre, email, usuario, password y rol_id son obligatorios'
      });
    }*/

    await transaction.begin();

    const requestValidarRol = new sql.Request(transaction);

    const rolExiste = await requestValidarRol
      .input('rol_id', sql.BigInt, rol_id)
      .query(`
        SELECT rol_id
        FROM Rol
        WHERE rol_id = ${req.body.rol_id}
      `);

    if (rolExiste.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Rol no encontrado' });
    }

    const requestValidarUsuario = new sql.Request(transaction);

    const usuarioExiste = await requestValidarUsuario
      .input('usuario', sql.VarChar(100), usuario)
      .input('email', sql.VarChar(150), email)
      .query(`
        SELECT usuario_id
        FROM Usuario
        WHERE usuario = @usuario OR email = @email
      `);

    if (usuarioExiste.recordset.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Ya existe un usuario con ese usuario o email'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const requestInsert = new sql.Request(transaction);

    const result = await requestInsert
      .input('empresa_id', sql.BigInt, empresa_id || null)
      .input('nombre', sql.VarChar(150), nombre)
      .input('email', sql.VarChar(150), email)
      .input('activo', sql.Bit, activo ?? true)
      .input('usuario', sql.VarChar(100), usuario)
      .input('password', sql.VarChar(255), passwordHash)
      .input('rol_id', sql.BigInt, rol_id)
      .query(`
        INSERT INTO Usuario (
          empresa_id,
          nombre,
          email,
          activo,
          usuario,
          password,
          rol_id
        )
        OUTPUT INSERTED.usuario_id,
               INSERTED.empresa_id,
               INSERTED.nombre,
               INSERTED.email,
               INSERTED.activo,
               INSERTED.usuario,
               INSERTED.rol_id
        VALUES (
          @empresa_id,
          @nombre,
          @email,
          @activo,
          @usuario,
          @password,
          @rol_id
        )
      `);

    await transaction.commit();

    res.status(201).json({
      message: 'Usuario creado correctamente con rol asignado',
      data: result.recordset[0]
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al crear usuario con rol:', error);
    res.status(500).json({ message: 'Error al crear usuario con rol' });
  }
};

const cambiarRolUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol_id } = req.body;

    if (!rol_id) {
      return res.status(400).json({
        message: 'rol_id es obligatorio'
      });
    }

    const pool = await conectarDB();

    const usuarioExiste = await pool.request()
      .input('usuario_id', sql.BigInt, id)
      .query(`
        SELECT usuario_id
        FROM Usuario
        WHERE usuario_id = @usuario_id
      `);

    if (usuarioExiste.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const rolExiste = await pool.request()
      .input('rol_id', sql.BigInt, rol_id)
      .query(`
        SELECT rol_id
        FROM Rol
        WHERE rol_id = @rol_id
      `);

    if (rolExiste.recordset.length === 0) {
      return res.status(404).json({ message: 'Rol no encontrado' });
    }

    const result = await pool.request()
      .input('usuario_id', sql.BigInt, id)
      .input('rol_id', sql.BigInt, rol_id)
      .query(`
        UPDATE Usuario
        SET rol_id = @rol_id
        OUTPUT INSERTED.usuario_id,
               INSERTED.nombre,
               INSERTED.email,
               INSERTED.usuario,
               INSERTED.rol_id,
               INSERTED.activo
        WHERE usuario_id = @usuario_id
      `);

    res.json({
      message: 'Rol del usuario actualizado correctamente',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al cambiar rol del usuario:', error);
    res.status(500).json({ message: 'Error al cambiar rol del usuario' });
  }
};

const obtenerPermisosUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await conectarDB();

    const usuarioResult = await pool.request()
      .input('usuario_id', sql.BigInt, id)
      .query(`
        SELECT 
          u.usuario_id,
          u.usuario,
          u.nombre,
          u.email,
          u.rol_id,
          r.nombre AS rol_nombre
        FROM Usuario u
        INNER JOIN Rol r ON u.rol_id = r.rol_id
        WHERE u.usuario_id = @usuario_id
      `);

    if (usuarioResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const permisosResult = await pool.request()
      .input('rol_id', sql.BigInt, usuarioResult.recordset[0].rol_id)
      .query(`
        SELECT
          ar.accion_rol_id,
          e.entidad_id,
          e.codigo AS entidad_codigo,
          e.nombre AS entidad_nombre,
          a.accion_id,
          a.codigo AS accion_codigo,
          a.nombre AS accion_nombre,
          ar.permitido
        FROM Accion_Rol ar
        INNER JOIN Entidad e ON ar.entidad_id = e.entidad_id
        INNER JOIN Accion a ON ar.accion_id = a.accion_id
        WHERE ar.rol_id = @rol_id
        ORDER BY e.codigo, a.codigo
      `);

    res.json({
      usuario: usuarioResult.recordset[0],
      permisos: permisosResult.recordset
    });

  } catch (error) {
    console.error('Error al obtener permisos del usuario:', error);
    res.status(500).json({ message: 'Error al obtener permisos del usuario' });
  }
};

const asignarPermisosRol = async (req, res) => {
  const transaction = new sql.Transaction(await conectarDB());

  try {
    const { rol_id } = req.params;
    const { permisos } = req.body;

    if (!Array.isArray(permisos) || permisos.length === 0) {
      return res.status(400).json({
        message: 'Debe enviar un arreglo de permisos'
      });
    }

    await transaction.begin();

    const requestRol = new sql.Request(transaction);

    const rolExiste = await requestRol
      .input('rol_id', sql.BigInt, rol_id)
      .query(`
        SELECT rol_id
        FROM Rol
        WHERE rol_id = @rol_id
      `);

    if (rolExiste.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Rol no encontrado' });
    }

    for (const permiso of permisos) {
      const requestInsert = new sql.Request(transaction);

      await requestInsert
        .input('rol_id', sql.BigInt, rol_id)
        .input('accion_id', sql.BigInt, permiso.accion_id)
        .input('entidad_id', sql.BigInt, permiso.entidad_id)
        .input('permitido', sql.Bit, permiso.permitido ?? true)
        .query(`
          IF NOT EXISTS (
            SELECT 1
            FROM Accion_Rol
            WHERE rol_id = @rol_id
            AND accion_id = @accion_id
            AND entidad_id = @entidad_id
          )
          BEGIN
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
          END
        `);
    }

    await transaction.commit();

    res.status(201).json({
      message: 'Permisos asignados correctamente al rol'
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al asignar permisos al rol:', error);
    res.status(500).json({ message: 'Error al asignar permisos al rol' });
  }
};

const reemplazarPermisosRol = async (req, res) => {
  const transaction = new sql.Transaction(await conectarDB());

  try {
    const { rol_id } = req.params;
    const { permisos } = req.body;

    if (!Array.isArray(permisos)) {
      return res.status(400).json({
        message: 'permisos debe ser un arreglo'
      });
    }

    await transaction.begin();

    const requestDelete = new sql.Request(transaction);

    await requestDelete
      .input('rol_id', sql.BigInt, rol_id)
      .query(`
        DELETE FROM Accion_Rol
        WHERE rol_id = @rol_id
      `);

    for (const permiso of permisos) {
      const requestInsert = new sql.Request(transaction);

      await requestInsert
        .input('rol_id', sql.BigInt, rol_id)
        .input('accion_id', sql.BigInt, permiso.accion_id)
        .input('entidad_id', sql.BigInt, permiso.entidad_id)
        .input('permitido', sql.Bit, permiso.permitido ?? true)
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

    await transaction.commit();

    res.json({
      message: 'Permisos del rol reemplazados correctamente'
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al reemplazar permisos del rol:', error);
    res.status(500).json({ message: 'Error al reemplazar permisos del rol' });
  }
};

const getUsuarios = async (req, res) => {
  try {

    const pool = await conectarDB();

    const result = await pool.request().query(`
      SELECT
        u.usuario_id,
        u.nombre,
        u.email,
        u.usuario,
        u.activo,
        u.rol_id,
        r.nombre AS rol
      FROM Usuario u
      INNER JOIN Rol r
        ON u.rol_id = r.rol_id
      ORDER BY u.usuario_id
    `);

    res.json(result.recordset);

  } catch (error) {

    console.error('Error al obtener usuarios:', error);

    res.status(500).json({
      message: 'Error al obtener usuarios'
    });
  }
};

const getUsuarioById = async (req, res) => {

  try {

    const { id } = req.params;

    const pool = await conectarDB();

    const result = await pool.request()
      .input('usuario_id', sql.BigInt, id)
      .query(`
        SELECT
          usuario_id,
          nombre,
          email,
          usuario,
          activo,
          rol_id
        FROM Usuario
        WHERE usuario_id = @usuario_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        message: 'Usuario no encontrado'
      });
    }

    res.json(result.recordset[0]);

  } catch (error) {

    console.error('Error al obtener usuario:', error);

    res.status(500).json({
      message: 'Error al obtener usuario'
    });
  }
};
const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nombre,
      email,
      usuario,
      rol_id,
    
    } = req.body;

    const pool = await conectarDB();

    const usuarioExiste = await pool.request()
      .input('usuario_id', sql.BigInt, id)
      .query(`
        SELECT usuario_id
        FROM Usuario
        WHERE usuario_id = @usuario_id
      `);

    if (usuarioExiste.recordset.length === 0) {
      return res.status(404).json({
        message: 'Usuario no encontrado'
      });
    }

    const rolExiste = await pool.request()
      .input('rol_id', sql.BigInt, rol_id)
      .query(`
        SELECT rol_id
        FROM Rol
        WHERE rol_id = @rol_id
      `);

    if (rolExiste.recordset.length === 0) {
      return res.status(404).json({
        message: 'Rol no encontrado'
      });
    }

    const result = await pool.request()
      .input('usuario_id', sql.BigInt, id)
      .input('nombre', sql.VarChar(150), nombre)
      .input('email', sql.VarChar(150), email)
      .input('usuario', sql.VarChar(100), usuario)
      .input('rol_id', sql.BigInt, rol_id)
     // .input('activo', sql.Bit, activo)
      .query(`
        UPDATE Usuario
        SET
          nombre = @nombre,
          email = @email,
          usuario = @usuario,
          rol_id = @rol_id
  
        OUTPUT INSERTED.usuario_id,
               INSERTED.nombre,
               INSERTED.email,
               INSERTED.usuario,
               INSERTED.rol_id
             
        WHERE usuario_id = @usuario_id
      `);

    res.json({
      message: 'Usuario actualizado correctamente',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      message: 'Error al actualizar usuario'
    });
  }
};

const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await conectarDB();

    const result = await pool.request()
      .input('usuario_id', sql.BigInt, id)
      .query(`
        UPDATE Usuario
        SET activo = 0
        OUTPUT INSERTED.usuario_id,
               INSERTED.nombre,
               INSERTED.email,
               INSERTED.usuario,
               INSERTED.rol_id
             
        WHERE usuario_id = @usuario_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      message: 'Usuario desactivado correctamente',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({
      message: 'Error al desactivar usuario'
    });
  }
};
const cambiarEstadoUsuario = async (req, res) => {
  try {

    const { id } = req.params;
    const { activo } = req.body;

    const pool = await conectarDB();

    const result = await pool.request()
      .input('usuario_id', sql.BigInt, id)
      .input('activo', sql.Bit, activo)
      .query(`
        UPDATE Usuario
        SET activo = @activo
        OUTPUT
          INSERTED.usuario_id,
          INSERTED.nombre,
          INSERTED.email,
          INSERTED.usuario,
          INSERTED.activo
        WHERE usuario_id = @usuario_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      message: activo
        ? 'Usuario activado correctamente'
        : 'Usuario desactivado correctamente',
      data: result.recordset[0]
    });

  } catch (error) {

    console.error('Error al cambiar estado:', error);

    res.status(500).json({
      message: 'Error al cambiar estado del usuario'
    });
  }
};
module.exports = {
  getUsuarios,
  getUsuarioById,
  crearUsuarioConRol,
  updateUsuario,
  deleteUsuario,
  cambiarRolUsuario,
  obtenerPermisosUsuario,
  asignarPermisosRol,
  reemplazarPermisosRol,
  cambiarEstadoUsuario 
};