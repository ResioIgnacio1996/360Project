const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { conectarDB } = require('../../DB/dbConection');

const login = async (req, res) => {
  try {
    const { usuario, password } = req.body;

    if (!usuario || !password) {
      return res.status(400).json({
        message: 'Usuario y password son obligatorios'
      });
    }

    const pool = await conectarDB();

    const result = await pool.request()
      .input('usuario', usuario)
      .query(`
        SELECT 
          u.usuario_id,
          u.empresa_id,
          u.nombre,
          u.email,
          u.usuario,
          u.password,
          u.activo,
          u.rol_id,
          r.nombre AS rol_nombre
       
    
        FROM Usuario u
        INNER JOIN Rol r ON u.rol_id = r.rol_id
        WHERE u.usuario = @usuario
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({
        message: 'Credenciales inválidas'
      });
    }

    const user = result.recordset[0];

    if (!user.activo) {
      return res.status(403).json({
        message: 'Usuario inactivo'
      });
    }

    // ⚠️ Si usás bcrypt (recomendado)
    const passwordValida = await bcrypt.compare(password, user.password);

    // ⚠️ Si estás usando password en texto plano (NO recomendado)
    // const passwordValida = password === user.password;

    if (!passwordValida) {
      return res.status(401).json({
        message: 'Credenciales inválidas'
      });
    }

    const token = jwt.sign(
      {
        usuario_id: user.usuario_id,
        empresa_id: user.empresa_id,
        usuario: user.usuario,
        rol_id: user.rol_id,
        rol_nombre: user.rol_nombre
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '8h'
      }
    );

    res.json({
      message: 'Login correcto',
      token,
      usuario: {
        usuario_id: user.usuario_id,
        empresa_id: user.empresa_id,
        nombre: user.nombre,
        usuario: user.usuario,
        rol_id: user.rol_id,
        rol_nombre: user.rol_nombre
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  login
};
