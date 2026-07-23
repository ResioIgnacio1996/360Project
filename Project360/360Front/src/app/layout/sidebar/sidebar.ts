import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Auth, UsuarioSesion } from '../../core/services/auth/auth';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar {

  @Input() visible = false;
  @Input() usuario: UsuarioSesion | null = null;

  @Output() closeSidebar = new EventEmitter<void>();

  constructor(
    private auth: Auth,
    private router: Router,
    private location: Location
  ) {}

  get inicialUsuario(): string {
    return this.usuario?.usuario
      ? this.usuario.usuario.charAt(0).toUpperCase()
      : '';
  }

  cerrar(): void {
    this.closeSidebar.emit();
  }

  volverAtras(): void {
    this.closeSidebar.emit();
    this.location.back();
  }

  navegar(): void {
    this.closeSidebar.emit();
  }

  logout(): void {
    this.auth.logout();
    this.closeSidebar.emit();
    this.router.navigate(['/login']);
  }
}
