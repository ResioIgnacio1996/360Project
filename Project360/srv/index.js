require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();

const {
  observabilidadRequest
} = require('./middlewares/request-observability.middleware');


// ======================================================
// MIDDLEWARES
// ======================================================

app.use(observabilidadRequest);

app.use(cors());

app.use(express.json());


// ======================================================
// API - SEGURIDAD
// ======================================================

app.use('/api/auth', require('./routes/Auth.routes'));

app.use('/api/acciones', require('./routes/Acciones.routes'));

app.use('/api/roles', require('./routes/Rolusuario.routes'));

app.use('/api/usuarios', require('./routes/Usuario.routes'));

app.use(
  '/api/usuario-proyecto',
  require('./routes/UsuarioProyecto.routes')
);

app.use(
  '/api/entidades',
  require('./routes/Entidad.routes')
);


// ======================================================
// API - CLIENTES / PROYECTOS
// ======================================================

app.use(
  '/api/clientes',
  require('./routes/Cliente.routes')
);

app.use(
  '/api/proyectos',
  require('./routes/Proyecto.routes')
);


// ======================================================
// API - PROVEEDORES
// ======================================================

app.use(
  '/api/proveedores',
  require('./routes/Proveedor.routes')
);

app.use(
  '/api/responsables-cuadrillas',
  require('./routes/ResponsableOperacion.routes')
);


// ======================================================
// API - MATERIALES / COMPRAS / REMITOS
// ======================================================

app.use(
  '/api/materiales',
  require('./routes/materiales.routes')
);

app.use(
  '/api/registro-compra',
  require('./routes/RegistroCompra.routes')
);

app.use(
  '/api/remitos',
  require('./routes/Remito.routes')
);

app.use(
  '/api/stock-general',
  require('./routes/StockGeneral.routes')
);


// ======================================================
// API - PROGRAMACIÓN
// ======================================================

app.use(
  '/api/programacion',
  require('./routes/Programacion.routes')
);

app.use(
  '/api/importacion-programacion',
  require('./routes/ImportacionProgramacion.routes')
);


// ======================================================
// API - OPERACIONES
// ======================================================

app.use(
  '/api/avance-operaciones',
  require('./routes/AvanceOperacion.routes')
);

app.use(
  '/api/economia-operaciones',
  require('./routes/EconomiaOperacion.routes')
);


// ======================================================
// API - CERTIFICADOS
// ======================================================

app.use(
  '/api/certificados-cliente',
  require('./routes/CertificadoCliente.routes')
);

app.use(
  '/api/certificados-responsable',
  require('./routes/CertificadoResponsable.routes')
);


// ======================================================
// API - FINANZAS
// ======================================================

app.use(
  '/api/movimientos-financieros',
  require('./routes/MovimientoFinanciero.routes')
);


// ======================================================
// API - BOM
// ======================================================

app.use(
  '/api/bom',
  require('./routes/BomImportacion.routes')
);


// ======================================================
// API - SISTEMA
// ======================================================

app.use(
  '/api/sistema',
  require('./routes/Sistema.routes')
);


// ======================================================
// FRONTEND ANGULAR
// ======================================================

// Ruta al build de Angular:
//
// Project360/
// ├── srv/
// │   └── index.js
// └── 360Front/
//     └── dist/
//         └── 360Front/
//             └── browser/
//                 └── index.html

const frontendPath = path.join(
  __dirname,
  '..',
  '360Front',
  'dist',
  '360Front',
  'browser'
);


// Servir archivos estáticos de Angular:
// JS, CSS, imágenes, fuentes, etc.

app.use(express.static(frontendPath));


// ======================================================
// ANGULAR ROUTING
// ======================================================

// Si la URL NO empieza con /api,
// dejamos que Angular maneje la ruta.
//
// Ejemplos:
//
// /login
// /dashboard
// /proveedores
// /proyectos
//
// devolverán index.html y Angular resolverá la pantalla.

app.use((req, res, next) => {

  // Si es una llamada a la API y ninguna ruta anterior
  // la encontró, dejamos que Express continúe y responda 404.
  if (
    req.path === '/api' ||
    req.path.startsWith('/api/')
  ) {
    return next();
  }

  res.sendFile(
    path.join(frontendPath, 'index.html'),
    (error) => {

      if (error) {
        next(error);
      }

    }
  );

});


// ======================================================
// PUERTO
// ======================================================

const PORT = process.env.PORT || 3000;


// ======================================================
// INICIAR SERVIDOR
// ======================================================

app.listen(PORT, () => {

  console.log(`Servidor corriendo en puerto ${PORT}`);

  console.log(`Frontend Angular: ${frontendPath}`);

});