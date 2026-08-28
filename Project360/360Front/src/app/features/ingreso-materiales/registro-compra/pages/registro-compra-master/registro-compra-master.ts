import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, Observable, Subject, catchError, debounceTime, map, startWith, switchMap, tap } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
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
    MatSortModule,
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

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  totalRegistros = 0;
  pageIndex = 0;
  pageSize = 10;
  sortActive = 'fecha';
  sortDirection: 'asc' | 'desc' = 'desc';
  private recargar$ = new Subject<void>();

  constructor(
    private registroCompraService: RegistroCompraService,
    private proveedorService: ProveedorService,
    private proyectoService: ProyectoService,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.recargar$.pipe(
      switchMap(() => {
        this.cargando = true;
        return this.registroCompraService.getRegistrosPaginados(this.construirQuery()).pipe(
          tap(response => {
            this.registros = response.data;
            this.dataSource.data = response.data;
            this.totalRegistros = response.page.total;
            this.pageIndex = response.page.index;
            this.cargando = false;
          }),
          catchError(() => {
            this.cargando = false;
            this.snackBar.open('Error al obtener registros de compra.', 'Cerrar', { duration: 3500 });
            return EMPTY;
          })
        );
      })
    ).subscribe();
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

    this.filtrosForm.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      this.aplicarFiltros();
    });
  }

  cargarRegistros(): void {
    this.recargar$.next();
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
    if (resetPage) this.pageIndex = 0;
    this.cargarRegistros();
  }

  cambiarPagina(event: {pageIndex:number;pageSize:number}): void { this.pageIndex=event.pageIndex;this.pageSize=event.pageSize;this.cargarRegistros(); }
  cambiarOrden(event: {active:string;direction:string}): void { this.sortActive=event.active;this.sortDirection=(event.direction||'desc') as 'asc'|'desc';this.pageIndex=0;this.cargarRegistros(); }

  private construirQuery(): Record<string,string|number|null|undefined> {
    const f=this.filtrosForm.getRawValue() as FiltrosRegistroCompra;
    const proveedorId=typeof f.proveedor==='object' ? f.proveedor?.idProveedor : null;
    const proveedorTexto=typeof f.proveedor==='string' ? f.proveedor.trim() : null;
    return {page:this.pageIndex,pageSize:this.pageSize,search:f.busqueda?.trim(),tipo:f.tipo==='TODOS'?null:f.tipo,estado:f.estado==='TODOS'?null:f.estado,proveedorId:proveedorId||null,proveedorTexto:proveedorTexto||null,proyectoId:f.idProyecto==='TODOS'?null:f.idProyecto,fechaDesde:this.fechaQuery(f.fechaDesde),fechaHasta:this.fechaQuery(f.fechaHasta),sort:this.sortActive,direction:this.sortDirection};
  }

  private fechaQuery(fecha:Date|null):string|null { if(!fecha)return null;return `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`; }

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
    if (!this.puedeCancelar(registro)) {
      this.snackBar.open('Solo se pueden cancelar registros de compra en estado CREADA.', 'Cerrar', {
        duration: 3500
      });
      return;
    }
    this.registroCompraService.obtenerImpactoCancelacion(registro.idRegistroCompra).subscribe({
      next: impacto => {
        const pendientes = Number(impacto?.remitos_a_desactivar || 0);
        const liberados = Number(impacto?.remitos_con_liberaciones || 0);
        const remitos = Array.isArray(impacto?.remitos) ? impacto.remitos : [];
        let aviso = `¿Seguro que querés cancelar el registro ${registro.numero}?`;
        if (pendientes > 0) aviso += `\n\n${pendientes} remito(s) pendiente(s) se cancelarán y dejarán de verse en el sistema.`;
        if (liberados > 0) aviso += `\n\n${liberados} remito(s) con liberaciones permanecerán visibles por trazabilidad.`;
        if (remitos.length) {
          aviso += '\n\nRemitos vinculados:';
          for (const remito of remitos) {
            aviso += `\n- ${remito.numero} (${remito.estado_liberacion || 'PENDIENTE'})`;
          }
        } else {
          aviso += '\n\nNo tiene remitos activos vinculados.';
        }
        if (confirm(aviso)) this.confirmarCancelacion(registro);
      },
      error: error => this.snackBar.open(
        error?.error?.error
          || error?.error?.message
          || `No se pudo verificar el impacto de la cancelación (HTTP ${error?.status || 'desconocido'}).`,
        'Cerrar',
        { duration: 4000 }
      )
    });
  }

  private confirmarCancelacion(registro: RegistroCompra): void {
    this.registroCompraService.cancelarRegistro(registro.idRegistroCompra).subscribe({
      next: () => {
        this.snackBar.open('Registro de compra cancelado correctamente.', 'Cerrar', {
          duration: 3000
        });
        this.cargarRegistros();
      },
      error: error => {
        this.snackBar.open(error?.error?.message || error?.error?.error || 'Error al cancelar el registro de compra.', 'Cerrar', {
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
    return this.getEstadoCodigo(registro) === 'CREADA';
  }

  tooltipEditar(registro: RegistroCompra): string {
    return this.puedeEditar(registro)
      ? 'Editar OC creada'
      : 'Solo se puede editar cuando el estado es CREADA';
  }

  puedeCancelar(registro: RegistroCompra): boolean {
    return this.getEstadoCodigo(registro) === 'CREADA';
  }

  tooltipCancelar(registro: RegistroCompra): string {
    return this.puedeCancelar(registro)
      ? 'Cancelar registro de compra'
      : 'Solo se puede cancelar cuando el estado es CREADA';
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
    if (Number(registro.cantidadTotal || 0) > 0) {
      return Math.min(100, Math.round(
        (Number(registro.cantidadLiberada || 0) / Number(registro.cantidadTotal)) * 100
      ));
    }
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
    if (registro.cantidadRemitosActivos !== undefined) return Number(registro.cantidadRemitosActivos || 0);
    const anyRegistro = registro as any;
    const remitos = anyRegistro.remitos ?? anyRegistro.remitosAsociados ?? [];

    if (Array.isArray(remitos)) {
      return remitos.length;
    }

    return Number(anyRegistro.cantidadRemitos ?? 0);
  }

  getEstadoLiberacion(registro: RegistroCompra): string {
    return registro.estadoLiberacion || 'PENDIENTE';
  }

  getResumenMaterialesLiberados(registro: RegistroCompra): string {
    return `${Number(registro.materialesLiberados || 0)}/${Number(registro.cantidadMateriales || 0)}`;
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
