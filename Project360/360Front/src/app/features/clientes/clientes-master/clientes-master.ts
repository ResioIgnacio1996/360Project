import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Router } from '@angular/router';
import { ClienteService } from '../../../core/services/Cliente/cliente';
import { Cliente } from '../../../shared/interfaces/cliente.interface';

@Component({ selector: 'app-clientes-master', standalone: true, imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule, MatPaginatorModule], templateUrl: './clientes-master.html', styleUrl: './clientes-master.css' })
export class ClientesMaster implements OnInit {
  clientes: Cliente[] = [];
  clientesFiltrados: Cliente[] = [];
  filtro = '';
  cargando = false;
  error = '';
  mensaje = '';
  pageIndex = 0;
  pageSize = 10;
  readonly pageSizeOptions = [10, 25, 50, 100];

  constructor(private clienteService: ClienteService, private router: Router) {}
  ngOnInit(): void { this.cargarClientes(); }

  cargarClientes(): void {
    this.cargando = true; this.error = '';
    this.clienteService.getClientes().subscribe({
      next: data => { this.clientes = data; this.clientesFiltrados = data; this.pageIndex = 0; this.cargando = false; },
      error: err => { this.error = err?.error?.message || 'Error al cargar clientes'; this.cargando = false; }
    });
  }
  filtrarClientes(): void {
    const q = this.filtro.toLowerCase().trim();
    this.clientesFiltrados = this.clientes.filter(c =>
      c.razon_social?.toLowerCase().includes(q) ||
      c.cuil?.toLowerCase().includes(q) ||
      c.telefono?.toLowerCase().includes(q) ||
      c.ubicacion?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
    this.pageIndex = 0;
  }

  get clientesPagina(): Cliente[] {
    const start = this.pageIndex * this.pageSize;
    return this.clientesFiltrados.slice(start, start + this.pageSize);
  }

  cambiarPagina(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }
  nuevoCliente(): void { this.router.navigate(['/clientes/nuevo']); }
  editarCliente(id: number): void { this.router.navigate(['/clientes/editar', id]); }
  verProyectos(c: Cliente): void { this.router.navigate(['/proyectos'], { queryParams: { clienteId: c.id_cliente, clienteNombre: c.razon_social } }); }
  eliminarCliente(id: number): void {
    if (!confirm('¿Desea eliminar este cliente?')) return;
    this.clienteService.eliminarCliente(id).subscribe({ next: () => { this.mensaje = 'Cliente eliminado correctamente'; this.cargarClientes(); }, error: err => this.error = err?.error?.message || 'Error al eliminar cliente' });
  }
}
