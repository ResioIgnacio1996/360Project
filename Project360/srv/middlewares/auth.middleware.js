
const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      return res.status(401).json({
        message: 'Token no enviado'
      });
    }

    const token = authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        message: 'Token inválido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = decoded;

    next();

  } catch (error) {
    return res.status(401).json({
      message: 'Token inválido o expirado'
    });
  }
};

module.exports = {
  verificarToken
};