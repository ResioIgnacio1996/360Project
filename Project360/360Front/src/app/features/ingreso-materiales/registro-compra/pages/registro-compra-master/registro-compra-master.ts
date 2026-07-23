import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, map, startWith } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatExpansionModule } from '@angular/material/expansion';

import { RegistroCompraService } from '../../../../../core/services/registro-compra/registro-compra';
import { ProveedorService } from '../../../../../core/services/proveedor/proveedor';
import { ProyectoService } from '../../../../../core/services/proyecto/proyecto';
import { RegistroCompra } from '../../../../../shared/interfaces/RegistroDeCompra.interface';

interface ProveedorFiltro {
  idProveedor: number | null;
  razonSocial: string;
  cuit: string;
}

interface ProyectoFiltro {
  idProyecto: number | null;
  nombre: string;
}

interface FiltrosRegistroCompra {
  busqueda: string;
  tipo: string;
  estado: string;
  proveedor: ProveedorFiltro | string | null;
  idProyecto: number | 'TODOS';
  fechaDesde: Date | null;
  fechaHasta: Date | null;
}

@Component({
  selector: 'app-registro-compra-master',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatSnackBarModule,
    MatPaginatorModule,
    MatDialogModule,
    MatTooltipModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatExpansionModule
  ],
  templateUrl: './registro-compra-master.html',
  styleUrl: './registro-compra-master.css',
  encapsulation: ViewEncapsulation.None
})
export class RegistroCompraMaster implements OnInit {

  private fb = inject(FormBuilder);

  readonly estados = [
    'TODOS',
    'CREADA',
    'PARCIAL',
    'COMPLETADA',
    'CANCELADA',
    'PARCIAL CON DEMORAS'
  ];

  readonly tiposDocumento = ['TODOS', 'OC', 'FAC'];

  displayedColumns: string[] = [
    'tipo',
    'numero',
    'proveedor',
    'fecha',
    'fechaEntrega',
    'proyecto',
    'estado',
    'avance',
    'remitos',
    'acciones'
  ];

  dataSource = new MatTableDataSource<RegistroCompra>([]);
  registros: RegistroCompra[] = [];
  cargando = false;
  filtrosAbiertos = true;

  proveedores: ProveedorFiltro[] = [];
  proveedoresFiltrados$!: Observable<ProveedorFiltro[]>;

  proyectos: ProyectoFiltro[] = [];

  filtrosForm = this.fb.group({
    busqueda: [''],
    tipo: ['TODOS'],
    estado: ['TODOS'],
    proveedor: [null as ProveedorFiltro | string | null],
    idProyecto: ['TODOS' as number | 'TODOS'],
    fechaDesde: [null as Date | null],
    fechaHasta: [null as Date | null]
  });

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private registroCompraService: RegistroCompraService,
    private proveedorService: ProveedorService,
    private proyectoService: ProyectoService,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.configurarFiltros();
    this.cargarProveedores();
    this.cargarProyectos();
    this.cargarRegistros();
  }

  configurarFiltros(): void {
    this.proveedoresFiltrados$ = this.filtrosForm.controls.proveedor.valueChanges.pipe(
      startWith(''),
      map(value => this.filtrarProveedores(value))
    );

    this.filtrosForm.valueChanges.subscribe(() => {
      this.aplicarFiltros();
    });
  }

  cargarRegistros(): void {
    this.cargando = true;

    this.registroCompraService.getRegistros().subscribe({
      next: (registros: any) => {
        this.cargando = false;

        const data = Array.isArray(registros)
          ? registros
          : registros.data ?? [];

        this.registros = data;
        this.dataSource = new MatTableDataSource<RegistroCompra>([]);
        this.dataSource.paginator = this.paginator;
        this.aplicarFiltros(false);
      },
      error: () => {
        this.cargando = false;
        this.snackBar.open('Error al obtener registros de compra.', 'Cerrar', {
          duration: 3500
        });
      }
    });
  }

  cargarProveedores(): void {
    this.proveedorService.getProveedores().subscribe({
      next: (resp: any) => {
        this.proveedores = (Array.isArray(resp) ? resp : resp?.data ?? []).map((proveedor: any) => ({
          idProveedor: proveedor.proveedor_id ?? proveedor.idProveedor ?? null,
          razonSocial: proveedor.razon_social ?? proveedor.razonSocial ?? proveedor.nombre ?? '',
          cuit: proveedor.cuit ?? ''
        }));
      },
      error: () => {
        this.snackBar.open('Error al cargar proveedores para filtros.', 'Cerrar', {
          duration: 3000
        });
      }
    });
  }

  cargarProyectos(): void {
    this.proyectoService.getProyectos().subscribe({
      next: (resp: any) => {
        this.proyectos = (Array.isArray(resp) ? resp : resp?.data ?? []).map((proyecto: any) => ({
          idProyecto: proyecto.proyecto_id ?? proyecto.idProyecto ?? null,
          nombre: proyecto.nombre ?? proyecto.descripcion ?? ''
        }));
      },
      error: () => {
        this.snackBar.open('Error al cargar proyectos para filtros.', 'Cerrar', {
          duration: 3000
        });
      }
    });
  }

  aplicarFiltros(resetPage: boolean = true): void {
    const filtros = this.filtrosForm.getRawValue() as FiltrosRegistroCompra;
    const filtrados = this.registros.filter(registro => this.cumpleFiltros(registro, filtros));

    this.dataSource.data = filtrados;

    if (resetPage && this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  cumpleFiltros(registro: RegistroCompra, filtros: FiltrosRegistroCompra): boolean {
    return this.coincideBusquedaGeneral(registro, filtros.busqueda)
      && this.coincideTipo(registro, filtros.tipo)
      && this.coincideEstado(registro, filtros.estado)
      && this.coincideProveedor(registro, filtros.proveedor)
      && this.coincideProyecto(registro, filtros.idProyecto)
      && this.coincideRangoFechas(registro, filtros.fechaDesde, filtros.fechaHasta);
  }

  coincideBusquedaGeneral(registro: RegistroCompra, busqueda?: string | null): boolean {
    const filtro = this.normalizarTexto(busqueda);

    if (!filtro) {
      return true;
    }

    const materiales = registro.detalle
      ?.map(item => `${item.nombreMaterial ?? ''} ${item.descripcionOriginal ?? ''}`)
      .join(' ') ?? '';

    const value = `
      ${registro.numero ?? ''}
      ${registro.tipo ?? ''}
      ${registro.proveedor?.razonSocial ?? ''}
      ${registro.proveedor?.cuit ?? ''}
      ${registro.proyecto?.nombre ?? ''}
      ${registro.observaciones ?? ''}
      ${materiales}
    `;

    return this.normalizarTexto(value).includes(filtro);
  }

  coincideEstado(registro: RegistroCompra, estado?: string | null): boolean {
    if (!estado || estado === 'TODOS') {
      return true;
    }

    return this.getEstadoCodigo(registro) === estado || this.getEstadoNombre(registro) === estado;
  }

  coincideTipo(registro: RegistroCompra, tipo?: string | null): boolean {
    if (!tipo || tipo === 'TODOS') {
      return true;
    }

    return this.getTipoDocumento(registro) === tipo;
  }

  coincideProveedor(registro: RegistroCompra, proveedor?: ProveedorFiltro | string | null): boolean {
    if (!proveedor) {
      return true;
    }

    if (typeof proveedor === 'string') {
      const filtro = this.normalizarTexto(proveedor);
      const value = `${registro.proveedor?.razonSocial ?? ''} ${registro.proveedor?.cuit ?? ''}`;
      return !filtro || this.normalizarTexto(value).includes(filtro);
    }

    return !proveedor.idProveedor || registro.proveedor?.idProveedor === proveedor.idProveedor;
  }

  coincideProyecto(registro: RegistroCompra, idProyecto?: number | 'TODOS' | null): boolean {
    if (!idProyecto || idProyecto === 'TODOS') {
      return true;
    }

    return registro.proyecto?.idProyecto === idProyecto;
  }

  coincideRangoFechas(registro: RegistroCompra, desde?: Date | null, hasta?: Date | null): boolean {
    const fechaRegistro = this.crearFechaLocal(registro.fecha);

    if (!fechaRegistro) {
      return !desde && !hasta;
    }

    if (desde && fechaRegistro < this.inicioDelDia(desde)) {
      return false;
    }

    if (hasta && fechaRegistro > this.finDelDia(hasta)) {
      return false;
    }

    return true;
  }

  filtrarProveedores(value: ProveedorFiltro | string | null): ProveedorFiltro[] {
    const filtro = this.normalizarTexto(
      typeof value === 'string' ? value : value?.razonSocial ?? ''
    );

    if (!filtro) {
      return this.proveedores;
    }

    return this.proveedores.filter(proveedor =>
      this.normalizarTexto(`${proveedor.razonSocial} ${proveedor.cuit}`).includes(filtro)
    );
  }

  displayProveedor(proveedor: ProveedorFiltro | string | null): string {
    return typeof proveedor === 'string'
      ? proveedor
      : proveedor?.razonSocial ?? '';
  }

  limpiarFiltros(): void {
    this.filtrosForm.reset({
      busqueda: '',
      tipo: 'TODOS',
      estado: 'TODOS',
      proveedor: null,
      idProyecto: 'TODOS',
      fechaDesde: null,
      fechaHasta: null
    });

    this.cargarRegistros();
  }

  nuevoRegistro(): void {
    this.router.navigate(['/ingreso-materiales/registros/nuevo']);
  }

  verDetalle(registro: RegistroCompra): void {
    this.router.navigate([
      '/ingreso-materiales/registros',
      registro.idRegistroCompra
    ]);
  }

  editar(registro: RegistroCompra): void {
    this.router.navigate([
      '/ingreso-materiales/registros/editar',
      registro.idRegistroCompra
    ]);
  }

  verRemitos(registro: RegistroCompra): void {
    this.router.navigate([
      '/ingreso-materiales/registros',
      registro.idRegistroCompra,
      'remitos'
    ]);
  }

  cancelar(registro: RegistroCompra): void {
    const confirmado = confirm(`¿Seguro que querés cancelar el registro ${registro.numero}?`);

    if (!confirmado) {
      return;
    }

    this.registroCompraService.cancelarRegistro(registro.idRegistroCompra).subscribe({
      next: () => {
        this.snackBar.open('Registro de compra cancelado correctamente.', 'Cerrar', {
          duration: 3000
        });
        this.cargarRegistros();
      },
      error: () => {
        this.snackBar.open('Error al cancelar el registro de compra.', 'Cerrar', {
          duration: 3500
        });
      }
    });
  }

  getEstadoCodigo(registro: RegistroCompra): string {
    return registro.estado?.codigo ?? '';
  }

  getEstadoNombre(registro: RegistroCompra): string {
    return registro.estado?.nombre ?? '-';
  }

  getEstadoClass(registro: RegistroCompra): string {
    const codigo = this.getEstadoCodigo(registro);

    switch (codigo) {
      case 'CREADA':
        return 'estado-creada';
      case 'PARCIAL':
        return 'estado-parcial';
      case 'COMPLETADA':
        return 'estado-completada';
      case 'CANCELADA':
        return 'estado-cancelada';
      case 'PARCIAL CON DEMORAS':
        return 'estado-demora';
      default:
        return 'estado-default';
    }
  }

  puedeEditar(registro: RegistroCompra): boolean {
    const estado = this.getEstadoCodigo(registro);
    return estado === 'CREADA';
  }

  puedeCancelar(registro: RegistroCompra): boolean {
    const estado = this.getEstadoCodigo(registro);
    return estado !== 'COMPLETADA' && estado !== 'CANCELADA';
  }

  formatearFecha(fecha?: string | null): string {
    if (!fecha) {
      return '-';
    }

    return fecha.substring(0, 10);
  }

  getTipoDocumento(registro: RegistroCompra): string {
    const tipo = String(registro.tipo ?? '').trim().toUpperCase();
    return tipo === 'FAC' || tipo === 'FACTURA' ? 'FAC' : 'OC';
  }

  getPorcentajeRecibido(registro: RegistroCompra): number {
    const detalle = registro.detalle ?? [];

    const solicitado = detalle.reduce((total, item) =>
      total + Number(item.cantidadSolicitada ?? item.cantidad ?? 0), 0);

    const recibido = detalle.reduce((total, item) =>
      total + Number(item.cantidadRecibida ?? 0), 0);

    if (!solicitado) {
      return 0;
    }

    return Math.min(100, Math.round((recibido / solicitado) * 100));
  }

  getCantidadRemitos(registro: RegistroCompra): number {
    const anyRegistro = registro as any;
    const remitos = anyRegistro.remitos ?? anyRegistro.remitosAsociados ?? [];

    if (Array.isArray(remitos)) {
      return remitos.length;
    }

    return Number(anyRegistro.cantidadRemitos ?? 0);
  }

  private normalizarTexto(value?: string | null): string {
    return (value ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private crearFechaLocal(fecha?: string | null): Date | null {
    if (!fecha) {
      return null;
    }

    const [year, month, day] = fecha.substring(0, 10).split('-').map(Number);

    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  private inicioDelDia(fecha: Date): Date {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  }

  private finDelDia(fecha: Date): Date {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999);
  }
}
