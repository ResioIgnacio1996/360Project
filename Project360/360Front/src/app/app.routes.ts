import { Routes } from '@angular/router';

import { Login } from './features/login/login';
import { Layout } from './layout/layout/layout';

import { Dashboard } from './features/dashboard/dashboard';

import { authGuard, guestGuard } from './core/guards/auth-guard';
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: Login, canActivate: [guestGuard] },

  {
    path: '', component: Layout, canActivate: [authGuard], children: [{ path: 'dashboard', component: Dashboard },

    { path: 'seguridad', loadComponent: () => import('./features/seguridad/seguridad-home/seguridad-home').then(m => m.SeguridadHome) },
    { path: 'seguridad/usuarios', loadComponent: () => import('./features/seguridad/usuarios/usuarios-master/usuarios-master').then(m => m.UsuariosMaster) },
    { path: 'seguridad/usuarios/nuevo', loadComponent: () => import('./features/seguridad/usuarios/usuario-form/usuario-form').then(m => m.UsuarioForm) },
    { path: 'seguridad/usuarios/editar/:id', loadComponent: () => import('./features/seguridad/usuarios/usuario-form/usuario-form').then(m => m.UsuarioForm) },
    { path: 'seguridad/usuarios/:id/permisos', loadComponent: () => import('./features/seguridad/usuarios/usuario-permisos/usuario-permisos').then(m => m.UsuarioPermisos) },
    { path: 'seguridad/roles', loadComponent: () => import('./features/seguridad/roles/roles-master/roles-master').then(m => m.RolesMasterComponent) },
    { path: 'seguridad/roles/nuevo', loadComponent: () => import('./features/seguridad/roles/rol-form/rol-form').then(m => m.RolFormComponent) },
    { path: 'seguridad/roles/editar/:id', loadComponent: () => import('./features/seguridad/roles/rol-form/rol-form').then(m => m.RolFormComponent) },
    { path: 'seguridad/entidades', loadComponent: () => import('./features/seguridad/entidades/entidades-master/entidades-master').then(m => m.EntidadesMaster) },
    { path: 'seguridad/acciones', loadComponent: () => import('./features/seguridad/acciones/acciones-master/acciones-master').then(m => m.AccionesMaster) },


    { path: 'proyectos', loadComponent: () => import('./features/proyectos/proyectos').then(m => m.Proyectos) },
    { path: 'proyectos/nuevo', loadComponent: () => import('./features/proyectos/proyecto-form').then(m => m.ProyectoForm) },
    { path: 'proyectos/editar/:id', loadComponent: () => import('./features/proyectos/proyecto-form').then(m => m.ProyectoForm) },
    { path: 'proyectos/:id', loadComponent: () => import('./features/proyectos/proyecto-home').then(m => m.ProyectoHome) },
    { path: 'proyectos/:id/stock', loadComponent: () => import('./features/ingreso-materiales/container/pages/conteiner-master/conteiner-master').then(m => m.containerMaster) },
    {
      path: 'proyectos/:id/stock/:materialId/movimientos',
      loadComponent: () => import('./features/ingreso-materiales/container/pages/conteiner-movimientos/conteiner-movimientos')
        .then(m => m.ContainerMovimientos)
    },
    { path: 'proyectos/:id/programacion', loadComponent: () => import('./features/programacion/programacion').then(m => m.Programacion) },
    { path: 'proyectos/:id/programacion/gantt', loadComponent: () => import('./features/programacion/programacion').then(m => m.Programacion) },
    { path: 'proyectos/:id/programacion/importar', loadComponent: () => import('./features/programacion/importacion-programacion/importacion-programacion').then(m => m.ImportacionProgramacion) },
    {
      path: 'proyectos/:id/bom',
      loadComponent: () => import('./features/bom/bom-proyecto').then(m => m.BomProyecto)
    },
    { path: 'proyectos/:id/avances', loadComponent: () => import('./features/avance-operaciones/avance-operaciones').then(m => m.AvanceOperaciones) },
    { path: 'proyectos/:id/costos', loadComponent: () => import('./features/costos/costos-certificaciones').then(m => m.CostosCertificaciones) },
    { path: 'proyectos/:id/panel-general', loadComponent: () => import('./features/panel-general/panel-general').then(m => m.PanelGeneral) },
    { path: 'proyectos/:id/alarmas', loadComponent: () => import('./features/alarmas/alarmas-proyecto').then(m => m.AlarmasProyecto) },
    {
      path: 'proyectos/:id/dependencias',
      loadComponent: () => import('./features/dependencias-operaciones/dependencias-operaciones')
        .then(m => m.DependenciasOperaciones)
    },
    { path: 'system-tools', loadComponent: () => import('./features/system-tools/system-tools').then(m => m.SystemTools) },
    { path: 'system-tools/materiales', loadComponent: () => import('./features/system-tools/materiales-master/materiales-master').then(m => m.MaterialesMaster) },
    { path: 'system-tools/responsables-cuadrillas', loadComponent: () => import('./features/responsables-cuadrillas/responsables-cuadrillas-master/responsables-cuadrillas-master').then(m => m.ResponsablesCuadrillasMaster) },
    { path: 'system-tools/responsables-cuadrillas/:id', loadComponent: () => import('./features/responsables-cuadrillas/responsable-detalle/responsable-detalle').then(m => m.ResponsableDetalle) },

    { path: 'configuracion', loadComponent: () => import('./features/configuracion/configuracion').then(m => m.Configuracion) },

    { path: 'clientes', loadComponent: () => import('./features/clientes/clientes-master/clientes-master').then(m => m.ClientesMaster), canActivate: [authGuard] },
    { path: 'clientes/nuevo', loadComponent: () => import('./features/clientes/cliente-form/cliente-form').then(m => m.ClienteForm), canActivate: [authGuard] },
    { path: 'clientes/editar/:id', loadComponent: () => import('./features/clientes/cliente-form/cliente-form').then(m => m.ClienteForm), canActivate: [authGuard] },

    { path: 'proveedores', loadComponent: () => import('./features/proveedores/proveedores-master/proveedores-master').then(m => m.ProveedoresMaster), canActivate: [authGuard] },
    { path: 'proveedores/nuevo', loadComponent: () => import('./features/proveedores/proveedor-form/proveedor-form').then(m => m.ProveedorForm), canActivate: [authGuard] },
    { path: 'proveedores/editar/:id', loadComponent: () => import('./features/proveedores/proveedor-form/proveedor-form').then(m => m.ProveedorForm), canActivate: [authGuard] },

    { path: 'orden-compra', loadComponent: () => import('./features/materiales/orden-compra-upload/orden-compra-upload').then(m => m.OrdenCompraUpload), canActivate: [authGuard] },
   

{path: 'ingreso-materiales',loadComponent: () => import('./features/ingreso-materiales/ingreso-materiales-home/ingreso-materiales-home').then(m => m.IngresoMaterialesHome)},
{path: 'ingreso-materiales/registros',loadComponent: () => import('./features/ingreso-materiales/registro-compra/pages/registro-compra-master/registro-compra-master').then(m => m.RegistroCompraMaster)},
{path: 'ingreso-materiales/registros/nuevo',loadComponent: () => import('./features/ingreso-materiales/registro-compra/pages/registro-compra-form/registro-compra-form').then(m => m.RegistroCompraForm)},
{path: 'ingreso-materiales/registros/:id',loadComponent: () => import('./features/ingreso-materiales/registro-compra/pages/registro-compra-detalle/registro-compra-detalle').then(m => m.RegistroCompraDetalle)},
{path: 'ingreso-materiales/registros/editar/:id',loadComponent: () => import('./features/ingreso-materiales/registro-compra/pages/registro-compra-form/registro-compra-form').then(m => m.RegistroCompraForm)},
{path: 'ingreso-materiales/registros/:id/validacion-documento',loadComponent: () => import('./features/ingreso-materiales/registro-compra/pages/registro-compra-detalle/registro-compra-detalle').then(m => m.RegistroCompraDetalle)},
{path: 'ingreso-materiales/registros/:id/remitos',loadComponent: () => import('./features/ingreso-materiales/remito/pages/remito-master/remito-master').then(m => m.RemitoMaster)},
{path: 'ingreso-materiales/registros/:id/remitos/nuevo',loadComponent: () => import('./features/ingreso-materiales/remito/pages/remito-form/remito-form').then(m => m.RemitoForm)},
{path: 'ingreso-materiales/registros/:id/remitos/:remitoId/editar',loadComponent: () => import('./features/ingreso-materiales/remito/pages/remito-form/remito-form').then(m => m.RemitoForm)},
{path: 'ingreso-materiales/registros/:id/remitos/:remitoId',loadComponent: () => import('./features/ingreso-materiales/remito/pages/remito-detalle/remito-detalle').then(m => m.RemitoDetalle)},
{path: 'ingreso-materiales/registros/:id/remitos/:remitoId/validar',loadComponent: () => import('./features/ingreso-materiales/remito/pages/remito-detalle/remito-detalle').then(m => m.RemitoDetalle)},
{path: 'ingreso-materiales/registros/:id/remitos/:remitoId/liberar-stock',loadComponent: () => import('./features/ingreso-materiales/remito/pages/remito-detalle/remito-detalle').then(m => m.RemitoDetalle)},
{path: 'ingreso-materiales/registro-compra',loadComponent: () => import('./features/ingreso-materiales/registro-compra/pages/registro-compra-master/registro-compra-master').then(m => m.RegistroCompraMaster)},
{
    path: 'ingreso-materiales/registro-compra/nuevo',
    loadComponent: () => import('./features/ingreso-materiales/registro-compra/pages/registro-compra-form/registro-compra-form').then(m => m.RegistroCompraForm)
},
{
    path: 'ingreso-materiales/registro-compra/editar/:id',
    loadComponent: () => import('./features/ingreso-materiales/registro-compra/pages/registro-compra-form/registro-compra-form').then(m => m.RegistroCompraForm)
},
{
    path: 'ingreso-materiales/registro-compra/detalle/:id',
    loadComponent: () => import('./features/ingreso-materiales/registro-compra/pages/registro-compra-detalle/registro-compra-detalle').then(m => m.RegistroCompraDetalle)
},
{
    path: 'ingreso-materiales/remitos',
    loadComponent: () => import('./features/ingreso-materiales/remito/pages/remito-master/remito-master').then(m => m.RemitoMaster)
},
{
    path: 'ingreso-materiales/remitos/nuevo',
    loadComponent: () => import('./features/ingreso-materiales/remito/pages/remito-form/remito-form').then(m => m.RemitoForm)
},
{
    path: 'ingreso-materiales/remitos/editar/:id',
    loadComponent: () => import('./features/ingreso-materiales/remito/pages/remito-form/remito-form').then(m => m.RemitoForm)
},
{
    path: 'ingreso-materiales/remitos/detalle/:id',
    loadComponent: () => import('./features/ingreso-materiales/remito/pages/remito-detalle/remito-detalle').then(m => m.RemitoDetalle)
},
{
    path: 'ingreso-materiales/stock-general',
    loadComponent: () => import('./features/ingreso-materiales/stock-general/pages/stock-general-master/stock-general-master').then(m => m.StockGeneralMaster)
}, 
{
    path: 'ingreso-materiales/container',
    loadComponent: () => import('./features/ingreso-materiales/container/pages/conteiner-master/conteiner-master').then(m => m.containerMaster)
},
{
    path: 'ingreso-materiales/container',
    redirectTo: 'ingreso-materiales/container',
    pathMatch: 'full'
},


    ]
  },

  { path: '**', redirectTo: 'login' }
];
