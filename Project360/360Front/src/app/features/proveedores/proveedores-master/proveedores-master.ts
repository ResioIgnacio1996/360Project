import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ProveedorService } from '../../../core/services/proveedor/proveedor';
import { Proveedor } from '../../../shared/interfaces/proveedor.interface';

@Component({
  selector: 'app-proveedores-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proveedores-master.html',
  styleUrl: './proveedores-master.css'
})
export class ProveedoresMaster implements OnInit {

  proveedores: Proveedor[] = [];
  proveedoresFiltrados: Proveedor[] = [];

  filtro = '';
  cargando = false;
  eliminando = false;
  error = '';
  mensaje = '';

  constructor(
    private proveedorService: ProveedorService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarProveedores();
  }

  cargarProveedores(): void {
    this.cargando = true;
    this.error = '';
    this.mensaje = '';

    this.proveedorService.getProveedores().subscribe({
      next: (data) => {
        this.proveedores = data;
        this.proveedoresFiltrados = data;
        this.cargando = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al cargar proveedores';
        this.cargando = false;
      }
    });
  }

  filtrarProveedores(): void {
    const texto = this.filtro.toLowerCase().trim();

    this.proveedoresFiltrados = this.proveedores.filter(proveedor =>
      proveedor.razon_social?.toLowerCase().includes(texto) ||
      proveedor.cuit?.toLowerCase().includes(texto) ||
      proveedor.telefono?.toLowerCase().includes(texto) ||
      proveedor.email?.toLowerCase().includes(texto) ||
      proveedor.rubro?.toLowerCase().includes(texto) ||
      proveedor.ubicacion?.toLowerCase().includes(texto)
    );
  }

  nuevoProveedor(): void {
    this.router.navigate(['/proveedores/nuevo']);
  }

  editarProveedor(id: number): void {
    this.router.navigate(['/proveedores/editar', id]);
  }

  eliminarProveedor(id: number): void {
    const confirma = confirm('¿Desea eliminar este proveedor?');

    if (!confirma) return;

    this.eliminando = true;
    this.error = '';
    this.mensaje = '';

    this.proveedorService.eliminarProveedor(id).subscribe({
      next: () => {
        this.mensaje = 'Proveedor eliminado correctamente';
        this.eliminando = false;
        this.cargarProveedores();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al eliminar proveedor';
        this.eliminando = false;
      }
    });
  }
}