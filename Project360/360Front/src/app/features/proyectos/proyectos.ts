import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ProyectoService } from '../../core/services/proyecto/proyecto';

@Component({
  selector: 'app-proyectos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './proyectos.html',
  styleUrl: './proyectos.css'
})
export class Proyectos implements OnInit {
  vista: 'tarjetas' | 'lista' = 'tarjetas';
  proyectos: any[] = [];
  filtrados: any[] = [];
  cargando = false;
  error = '';
  clientes: any[] = [];
  paises: string[] = [];
  provincias: string[] = [];
  localidades: string[] = [];
  filtro = '';
  clienteId: number | string = 'TODOS';
  clienteNombre = '';
  clienteFijo = false;
  estado = 'TODOS';
  pais = 'TODOS';
  provincia = 'TODOS';
  localidad = 'TODOS';
  fechaCreacionDesde: Date | null = null;
  fechaCreacionHasta: Date | null = null;
  entregaDesde: Date | null = null;
  entregaHasta: Date | null = null;

  constructor(
    private service: ProyectoService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.queryParamMap.get('clienteId'));
    if (id) {
      this.clienteId = id;
      this.clienteNombre = this.route.snapshot.queryParamMap.get('clienteNombre') || '';
      this.clienteFijo = true;
    }
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.service.getProyectos().subscribe({
      next: r => {
        this.proyectos = Array.isArray(r) ? r : [];
        this.prepararOpciones();
        this.filtrar();
        this.cargando = false;
      },
      error: e => {
        this.error = e?.error?.message || 'Error al cargar proyectos';
        this.cargando = false;
      }
    });
  }

  prepararOpciones(): void {
    const mapa = new Map<number, string>();
    this.proyectos.forEach(p => mapa.set(Number(p.cliente_id), p.cliente_nombre || p.cliente || 'Sin nombre'));
    this.clientes = [...mapa].map(([id, nombre]) => ({ id, nombre }));
    this.paises = this.opcionesUbicacion(0);
    this.actualizarProvincias();
  }

  opcionesUbicacion(indice: number, pais = 'TODOS', provincia = 'TODOS'): string[] {
    const valores = this.proyectos
      .filter(p => {
        const ubicacion = this.ubicacion(p.direccion);
        return (pais === 'TODOS' || ubicacion[0] === pais)
          && (provincia === 'TODOS' || ubicacion[1] === provincia);
      })
      .map(p => this.ubicacion(p.direccion)[indice])
      .filter(Boolean);
    return [...new Set(valores)].sort((a, b) => a.localeCompare(b));
  }

  ubicacion(direccion: any): string[] {
    const partes = String(direccion || '').split(' | ').map(v => v.trim());
    if (partes.length === 5) return partes;
    if (partes.length === 4) return [partes[0], partes[1], partes[2], '', partes[3]];
    return ['', '', '', '', String(direccion || '')];
  }

  actualizarProvincias(): void {
    this.provincias = this.opcionesUbicacion(1, this.pais);
    this.actualizarLocalidades();
  }

  actualizarLocalidades(): void {
    this.localidades = this.opcionesUbicacion(2, this.pais, this.provincia);
  }

  cambioPais(): void {
    this.provincia = 'TODOS';
    this.localidad = 'TODOS';
    this.actualizarProvincias();
    this.filtrar();
  }

  cambioProvincia(): void {
    this.localidad = 'TODOS';
    this.actualizarLocalidades();
    this.filtrar();
  }

  filtrar(): void {
    const consulta = this.filtro.toLowerCase().trim();
    this.filtrados = this.proyectos.filter(proyecto => {
      const texto = `${proyecto.nombre} ${proyecto.cliente_nombre || proyecto.cliente || ''} ${proyecto.direccion || ''} ${proyecto.estado || ''}`.toLowerCase();
      const ubicacion = this.ubicacion(proyecto.direccion);
      return (!consulta || texto.includes(consulta))
        && (this.clienteId === 'TODOS' || Number(proyecto.cliente_id) === Number(this.clienteId))
        && (this.estado === 'TODOS' || proyecto.estado === this.estado)
        && (this.pais === 'TODOS' || ubicacion[0] === this.pais)
        && (this.provincia === 'TODOS' || ubicacion[1] === this.provincia)
        && (this.localidad === 'TODOS' || ubicacion[2] === this.localidad)
        && this.enRango(proyecto.fecha_inicio, this.fechaCreacionDesde, this.fechaCreacionHasta)
        && this.enRango(proyecto.fecha_fin_estimada, this.entregaDesde, this.entregaHasta);
    });
  }

  enRango(valor: any, desde: Date | null, hasta: Date | null): boolean {
    if (!valor) return !desde && !hasta;
    const partes = String(valor).substring(0, 10).split('-').map(Number);
    const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
    const inicio = desde ? new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()) : null;
    const fin = hasta ? new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), 23, 59, 59, 999) : null;
    return (!inicio || fecha >= inicio) && (!fin || fecha <= fin);
  }

  limpiar(): void {
    this.filtro = '';
    if (!this.clienteFijo) this.clienteId = 'TODOS';
    this.estado = 'TODOS';
    this.pais = 'TODOS';
    this.provincia = 'TODOS';
    this.localidad = 'TODOS';
    this.fechaCreacionDesde = null;
    this.fechaCreacionHasta = null;
    this.entregaDesde = null;
    this.entregaHasta = null;
    this.actualizarProvincias();
    this.filtrar();
  }

  nuevo(): void {
    this.router.navigate(['/proyectos/nuevo'], {
      queryParams: this.clienteFijo ? { clienteId: this.clienteId, clienteNombre: this.clienteNombre } : undefined
    });
  }

  editar(id: number): void {
    this.router.navigate(['/proyectos/editar', id]);
  }

  stock(id: number): void {
    this.router.navigate(['/proyectos', id, 'stock']);
  }

  programacion(id: number): void {
    this.router.navigate(['/proyectos', id, 'programacion']);
  }

  abrirProyecto(id: number): void {
    this.router.navigate(['/proyectos', id]);
  }

  volverAClientes(): void {
    this.router.navigate(['/clientes']);
  }

  cambiarVista(vista: 'tarjetas' | 'lista'): void {
    this.vista = vista;
  }

  codigoProyecto(proyecto: any): string {
    const codigo = proyecto.codigo || proyecto.codigo_proyecto;
    return codigo ? String(codigo) : `PRJ-${String(proyecto.proyecto_id || '').padStart(4, '0')}`;
  }

  claseEstado(estado: any): string {
    switch (String(estado || '').toUpperCase()) {
      case 'ACTIVO': return 'estado-activo';
      case 'PAUSADO': return 'estado-pausado';
      case 'FINALIZADO': return 'estado-finalizado';
      case 'CANCELADO': return 'estado-cancelado';
      default: return 'estado-default';
    }
  }

  eliminar(proyecto: any): void {
    if (!confirm(`¿Eliminar el proyecto ${proyecto.nombre}?`)) return;
    this.service.eliminarProyecto(proyecto.proyecto_id).subscribe({
      next: () => this.cargar(),
      error: error => this.error = error?.error?.message || 'No se pudo eliminar'
    });
  }
}
