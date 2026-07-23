import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { RolService } from '../../../../core/services/rol/rol';
import { Rol } from '../../../../shared/interfaces/rol.interface';

@Component({
  selector: 'app-roles-master',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule
  ],
  templateUrl: './roles-master.html',
  styleUrl: './roles-master.css'
})
export class RolesMasterComponent implements OnInit {

  roles: Rol[] = [];
  rolesFiltrados: Rol[] = [];

  textoBusqueda = '';
  cargando = false;
  error = '';

  constructor(
    private rolService: RolService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.cargarRoles();
  }

  get rolesParaMostrar(): Rol[] {
    return this.textoBusqueda
      ? this.rolesFiltrados
      : this.roles;
  }

  cargarRoles(): void {
    this.cargando = true;
    this.error = '';

    this.rolService.getRoles().subscribe({
      next: (response: any) => {
        this.roles = Array.isArray(response)
          ? response
          : response.data || response.roles || [];

        this.rolesFiltrados = [...this.roles];

        this.cargando = false;
      },
      error: (err: any) => {
        console.error('Error al obtener roles', err);
        this.error = 'No se pudieron obtener los roles';
        this.cargando = false;
      }
    });
  }

buscar(event: Event): void {
  const texto = (event.target as HTMLInputElement).value
    .trim()
    .toLowerCase();

  if (!texto) {
    this.rolesFiltrados = [...this.roles];
    return;
  }

  this.rolesFiltrados = this.roles.filter((rol: Rol) => {
    const nombre = rol.nombre?.toLowerCase() || '';
    const descripcion = rol.descripcion?.toLowerCase() || '';

    return nombre.includes(texto) || descripcion.includes(texto);
  });
}
  nuevoRol(): void {
    this.router.navigate(['/seguridad/roles/nuevo']);
  }

  editarRol(id: number): void {
    this.router.navigate(['/seguridad/roles/editar', id]);
  }

  configurarPermisos(id: number): void {
    this.router.navigate(['/seguridad/roles', id, 'permisos']);
  }

  cambiarEstado(rol: Rol, activo: boolean): void {
    const estadoAnterior = rol.activo;

    rol.activo = activo;

    this.rolService.activarDesactivarRol(rol.rol_id, activo).subscribe({
      next: (response: any) => {
        rol.activo = response.data?.activo ?? activo;
      },
      error: (err: any) => {
        console.error('Error al cambiar estado del rol', err);
        rol.activo = estadoAnterior;
      }
    });
  }
}
