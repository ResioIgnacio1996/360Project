import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { UsuarioService } from '../../../../core/services/usuario/usuario';
import { Usuario } from '../../../../shared/interfaces/usuario.interface';

@Component({
  selector: 'app-usuarios-master',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule
  ],
  templateUrl: './usuarios-master.html',
  styleUrl: './usuarios-master.css'
})
export class UsuariosMaster implements OnInit {

  private fb = inject(FormBuilder);

  usuarios: Usuario[] = [];
  usuariosFiltrados: Usuario[] = [];
  rolesDisponibles: string[] = [];

  cargando = false;
  error = '';

  filtrosForm = this.fb.group({
    usuario: [''],
    nombre: [''],
    activo: ['TODOS'],
    rol: ['TODOS']
  });

  constructor(
    private usuarioService: UsuarioService
  ) {}

  ngOnInit(): void {
    this.filtrosForm.valueChanges.subscribe(() => {
      this.aplicarFiltros();
    });

    this.obtenerUsuarios();
  }

  obtenerUsuarios(): void {
    this.cargando = true;
    this.error = '';

    this.usuarioService.obtenerUsuarios().subscribe({
      next: (response) => {
        this.usuarios = Array.isArray(response) ? response : [];
        this.rolesDisponibles = this.obtenerRolesDisponibles(this.usuarios);
        this.aplicarFiltros();
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al obtener usuarios:', err);
        this.error = 'No se pudieron obtener los usuarios';
        this.cargando = false;
      }
    });
  }

  aplicarFiltros(): void {
    const filtros = this.filtrosForm.getRawValue();
    const usuarioFiltro = this.normalizarTexto(filtros.usuario);
    const nombreFiltro = this.normalizarTexto(filtros.nombre);
    const activoFiltro = filtros.activo ?? 'TODOS';
    const rolFiltro = filtros.rol ?? 'TODOS';

    this.usuariosFiltrados = this.usuarios.filter(usuario => {
      const usuarioTexto = this.normalizarTexto(usuario.usuario);
      const nombreTexto = this.normalizarTexto(usuario.nombre);
      const rolTexto = usuario.rol ?? 'Sin rol';

      const coincideUsuario = !usuarioFiltro || usuarioTexto.includes(usuarioFiltro);
      const coincideNombre = !nombreFiltro || nombreTexto.includes(nombreFiltro);
      const coincideActivo = activoFiltro === 'TODOS'
        || (activoFiltro === 'ACTIVOS' && usuario.activo)
        || (activoFiltro === 'INACTIVOS' && !usuario.activo);
      const coincideRol = rolFiltro === 'TODOS' || rolTexto === rolFiltro;

      return coincideUsuario && coincideNombre && coincideActivo && coincideRol;
    });
  }

  limpiarFiltros(): void {
    this.filtrosForm.reset({
      usuario: '',
      nombre: '',
      activo: 'TODOS',
      rol: 'TODOS'
    });
  }

  cambiarEstado(usuario: Usuario, activo: boolean): void {
    const estadoAnterior = usuario.activo;
    usuario.activo = activo;

    this.usuarioService.cambiarEstadoUsuario(usuario.usuario_id, activo)
      .subscribe({
        next: () => {
          this.aplicarFiltros();
        },
        error: (err: any) => {
          console.error('Error al cambiar estado del usuario', err);
          usuario.activo = estadoAnterior;
        }
      });
  }

  private obtenerRolesDisponibles(usuarios: Usuario[]): string[] {
    return Array.from(new Set(
      usuarios.map(usuario => usuario.rol ?? 'Sin rol')
    )).sort((a, b) => a.localeCompare(b));
  }

  private normalizarTexto(value?: string | null): string {
    return (value ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
