import { Routes } from '@angular/router';

import { Login } from './features/login/login';
import { Layout } from './layout/layout/layout';

import { Dashboard } from './features/dashboard/dashboard';

import { SeguridadHome } from './features/seguridad/seguridad-home/seguridad-home';
import { UsuariosMaster } from './features/seguridad/usuarios/usuarios-master/usuarios-master';
import { UsuarioForm } from './features/seguridad/usuarios/usuario-form/usuario-form';
import { UsuarioPermisos } from './features/seguridad/usuarios/usuario-permisos/usuario-permisos';
import { RolesMasterComponent } from './features/seguridad/roles/roles-master/roles-master';
import { EntidadesMaster } from './features/seguridad/entidades/entidades-master/entidades-master';
import { AccionesMaster } from './features/seguridad/acciones/acciones-master/acciones-master';
import { RolFormComponent } from './features/seguridad/roles/rol-form/rol-form';
//port { RolPermisos } from './features/seguridad/roles/rol-permisos/rol-permisos';


import { Proyectos } from './features/proyectos/proyectos';
import { ProyectoForm } from './features/proyectos/proyecto-form';

import { Configuracion } from './features/configuracion/configuracion';

import { ProveedoresMaster } from './features/proveedores/proveedores-master/proveedores-master';
import { ProveedorForm } from './features/proveedores/proveedor-form/proveedor-form';

import { authGuard } from './core/guards/auth-guard';

import { ClientesMaster } from './features/clientes/clientes-master/clientes-master';
import { ClienteForm } from './features/clientes/cliente-form/cliente-form';

import { OrdenCompraUpload } from './features/materiales/orden-compra-upload/orden-compra-upload';


import { IngresoMaterialesHome } from './features/ingreso-materiales/ingreso-materiales-home/ingreso-materiales-home';

import { RegistroCompraMaster } from './features/ingreso-materiales/registro-compra/pages/registro-compra-master/registro-compra-master';
import { RegistroCompraForm } from './features/ingreso-materiales/registro-compra/pages/registro-compra-form/registro-compra-form';
import { RegistroCompraDetalle } from './features/ingreso-materiales/registro-compra/pages/registro-compra-detalle/registro-compra-detalle';

import { RemitoMaster } from './features/ingreso-materiales/remito/pages/remito-master/remito-master';
import { RemitoForm } from './features/ingreso-materiales/remito/pages/remito-form/remito-form';
import { RemitoDetalle } from './features/ingreso-materiales/remito/pages/remito-detalle/remito-detalle';

import { StockGeneralMaster } from './features/ingreso-materiales/stock-general/pages/stock-general-master/stock-general-master';

import { containerMaster } from './features/ingreso-materiales/container/pages/conteiner-master/conteiner-master';
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: Login },

  {
    path: '', component: Layout, canActivate: [authGuard], children: [{ path: 'dashboard', component: Dashboard },

    { path: 'seguridad', component: SeguridadHome },
    { path: 'seguridad/usuarios', component: UsuariosMaster },
    { path: 'seguridad/usuarios/nuevo', component: UsuarioForm },
    { path: 'seguridad/usuarios/editar/:id', component: UsuarioForm },
    { path: 'seguridad/usuarios/:id/permisos', component: UsuarioPermisos },
    { path: 'seguridad/roles', component: RolesMasterComponent },
    { path: 'seguridad/roles/nuevo', component: RolFormComponent },
    { path: 'seguridad/roles/editar/:id', component: RolFormComponent },
    { path: 'seguridad/entidades', component: EntidadesMaster },
    { path: 'seguridad/acciones', component: AccionesMaster },


    { path: 'proyectos', component: Proyectos },
    { path: 'proyectos/nuevo', component: ProyectoForm },
    { path: 'proyectos/editar/:id', component: ProyectoForm },
    { path: 'proyectos/:id/stock', component: containerMaster },

    { path: 'configuracion', component: Configuracion },

    { path: 'clientes', component: ClientesMaster, canActivate: [authGuard] },
    { path: 'clientes/nuevo', component: ClienteForm, canActivate: [authGuard] },
    { path: 'clientes/editar/:id', component: ClienteForm, canActivate: [authGuard] },

    { path: 'proveedores', component: ProveedoresMaster, canActivate: [authGuard] },
    { path: 'proveedores/nuevo', component: ProveedorForm, canActivate: [authGuard] },
    { path: 'proveedores/editar/:id', component: ProveedorForm, canActivate: [authGuard] },

    { path: 'orden-compra', component: OrdenCompraUpload, canActivate: [authGuard] },
   

{path: 'ingreso-materiales',component: IngresoMaterialesHome},
{path: 'ingreso-materiales/registros',component: RegistroCompraMaster},
{path: 'ingreso-materiales/registros/nuevo',component: RegistroCompraForm},
{path: 'ingreso-materiales/registros/:id',component: RegistroCompraDetalle},
{path: 'ingreso-materiales/registros/editar/:id',component: RegistroCompraForm},
{path: 'ingreso-materiales/registros/:id/validacion-documento',component: RegistroCompraDetalle},
{path: 'ingreso-materiales/registros/:id/remitos',component: RemitoMaster},
{path: 'ingreso-materiales/registros/:id/remitos/nuevo',component: RemitoForm},
{path: 'ingreso-materiales/registros/:id/remitos/:remitoId',component: RemitoDetalle},
{path: 'ingreso-materiales/registros/:id/remitos/:remitoId/validar',component: RemitoDetalle},
{path: 'ingreso-materiales/registros/:id/remitos/:remitoId/liberar-stock',component: RemitoDetalle},
{path: 'ingreso-materiales/registro-compra',component: RegistroCompraMaster},
{
    path: 'ingreso-materiales/registro-compra/nuevo',
    component: RegistroCompraForm
},
{
    path: 'ingreso-materiales/registro-compra/editar/:id',
    component: RegistroCompraForm
},
{
    path: 'ingreso-materiales/registro-compra/detalle/:id',
    component: RegistroCompraDetalle
},
{
    path: 'ingreso-materiales/remitos',
    component: RemitoMaster
},
{
    path: 'ingreso-materiales/remitos/nuevo',
    component: RemitoForm
},
{
    path: 'ingreso-materiales/remitos/detalle/:id',
    component: RemitoDetalle
},
{
    path: 'ingreso-materiales/stock-general',
    component: StockGeneralMaster
}, 
{
    path: 'ingreso-materiales/container',
    component: containerMaster
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
