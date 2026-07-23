import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Auth, UsuarioSesion } from '../../core/services/auth/auth';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    Sidebar
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class Layout {

  sidebarVisible = false;
  tema: 'dark' | 'light' = 'dark';

  usuario: UsuarioSesion | null = null;

  constructor(
    private authService: Auth,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.inicializarTema();

    this.authService.usuarioActual$.subscribe(usuario => {
      this.usuario = usuario;
    });
  }

  get inicialUsuario(): string {
    if (this.usuario?.usuario) {
      return this.usuario.usuario.charAt(0).toUpperCase();
    }

    if (this.usuario?.nombre) {
      return this.usuario.nombre.charAt(0).toUpperCase();
    }

    return '';
  }

  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
  }

  toggleTema(): void {
    this.tema = this.tema === 'dark' ? 'light' : 'dark';
    this.aplicarTema(this.tema);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private inicializarTema(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const preferencia = localStorage.getItem('db360-theme');
    this.tema = preferencia === 'light' ? 'light' : 'dark';
    this.aplicarTema(this.tema);
  }

  private aplicarTema(tema: 'dark' | 'light'): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    document.documentElement.setAttribute('data-theme', tema);
    localStorage.setItem('db360-theme', tema);
  }
}
