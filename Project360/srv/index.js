require('dotenv').config();

const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./routes/Auth.routes'));
app.use('/api/acciones', require('./routes/Acciones.routes'));
app.use('/api/roles', require('./routes/Rolusuario.routes'));
app.use('/api/usuarios', require('./routes/Usuario.routes'));
app.use('/api/usuario-proyecto',require('./routes/UsuarioProyecto.routes'));

app.use('/api/entidades', require('./routes/Entidad.routes'));

app.use('/api/clientes', require('./routes/Cliente.routes'));
app.use('/api/proyectos',require('./routes/Proyecto.routes')); 

app.use('/api/proveedores', require('./routes/Proveedor.routes')); 

app.use('/api/materiales', require('./routes/materiales.routes'));
app.use( '/api/registro-compra',require('./routes/RegistroCompra.routes'));
app.use('/api/remitos', require('./routes/Remito.routes'));
app.use('/api/stock-general', require('./routes/StockGeneral.routes'));
//app.use('/api/Acciones-Rol',require('./routes/AccionesRol.routes'));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
