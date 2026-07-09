README - Módulo de Usuarios (Auth + Roles + Acciones)

Descripción
Este módulo implementa:

* Gestión de usuarios (ABM)
* Sistema de roles
* Sistema de permisos (acciones)
* Autenticación con JWT
* Protección de endpoints mediante middleware

Arquitectura
srv/
├── controllers/
│   └── usuario/
│       ├── Usuarios.controller.js
│       ├── RolUsuario.controller.js
│       ├── AccionRol.controller.js
│       └── Auth.controller.js
│
├── routes/
│   ├── Usuario.routes.js
│   ├── Rolusuario.routes.js
│   ├── AccionesRol.routes.js
│   └── Auth.routes.js
│
├── middlewares/
│   └── auth.middleware.js
│
├── DB/
│   └── dbConection.js
│
├── .env
└── index.js

AUTENTICACIÓN

Login
POST /api/auth/login

Body:
{
"usuario": "admin",
"password": "123456"
}

Response:
{
"message": "Login correcto",
"token": "JWT_TOKEN"
}

USO DEL TOKEN

Header obligatorio:
Authorization: Bearer TOKEN

Ejemplo:
Authorization: Bearer eyJhbGciOiJIUzI1Ni...

MIDDLEWARE

auth.middleware.js:

* Valida JWT
* Inyecta usuario en req.usuario

Errores:

* 401 Token no enviado
* 401 Token inválido

USUARIOS

Endpoints:
GET    /api/usuarios
GET    /api/usuarios/:id
POST   /api/usuarios
PUT    /api/usuarios/:id
DELETE /api/usuarios/:id
POST   /api/usuarios/asignar-rol
POST   /api/usuarios/quitar-rol

Crear usuario:
{
"empresa_id": 1,
"nombre": "Admin",
"email": "[admin@mail.com](mailto:admin@mail.com)",
"usuario": "admin",
"password": "123456",
"activo": true,
"rol_id": 1
}

Notas:

* Password encriptada con bcrypt
* No guardar texto plano

ROLES

Endpoints:
GET    /api/roles
POST   /api/roles
PUT    /api/roles/:id
DELETE /api/roles/:id

Acciones del rol:
POST   /api/roles/asignar-accion
POST   /api/roles/quitar-accion
GET    /api/roles/:id/acciones

ACCIONES

Endpoints:
GET    /api/acciones
POST   /api/acciones
PUT    /api/acciones/:id
DELETE /api/acciones/:id

MODELO DE SEGURIDAD

Usuario → Rol → Accion_Rol → Accion

Conceptos:

* Usuario: tiene un rol
* Rol: conjunto de permisos
* Acción: permiso individual
* Accion_Rol: tabla intermedia

CONFIGURACIÓN

.env:
DB_USER=sa
DB_PASSWORD=xxxx
DB_SERVER=DESKTOP-XXXX
DB_DATABASE=DB360
DB_ENCRYPT=false
DB_TRUST_CERT=true
JWT_SECRET=clave_secreta
JWT_EXPIRES_IN=8h
PORT=3000

CONSIDERACIONES

* SQL Server debe tener TCP/IP habilitado
* Puerto 1433 activo
* Autenticación SQL habilitada
* Usuario "sa" activo

PRÓXIMOS PASOS

Seguridad:

* Middleware de permisos por acción
* Validación contra Accion_Rol

Arquitectura:

* Service layer
* Repository pattern
* Pool de conexiones

Funcionalidad:

* Auditoría
* Multiempresa
* Control de sesiones

CONCLUSIÓN

Este módulo cubre:

* Autenticación
* Autorización básica
* Gestión de usuarios
* Roles
* Permisos

Base lista para escalar a:

* ERP
* MES
* Sistema empresarial completo
