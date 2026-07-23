import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Auth, UsuarioSesion } from '../../core/services/auth';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    Sidebar
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class Layout {

  sidebarVisible = false;

  usuario: UsuarioSesion | null = null;

  constructor(private authService: Auth) {
    this.authService.usuarioActual$.subscribe(usuario => {
      this.usuario = usuario;
    });
  }

  get inicialUsuario(): string {
    return this.usuario?.usuario
      ? this.usuario.usuario.charAt(0).toUpperCase()
      : '';
  }

  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
  }
}