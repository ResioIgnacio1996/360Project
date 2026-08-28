import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, switchMap, tap } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSort, MatSortModule } from '@angular/material/sort';

import { Remito, Remitos } from '../../../../../core/services/remitos';
import { RegistroCompraService } from '../../../../../core/services/registro-compra/registro-compra';
import { RegistroCompra } from '../../../../../shared/interfaces/RegistroDeCompra.interface';

@Component({
  selector: 'app-remito-master',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    MatPaginatorModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatExpansionModule
    ,MatSortModule
  ],
  templateUrl: './remito-master.html',
  styleUrls: [
    './remito-master.css',
    '../../../registro-compra/pages/registro-compra-master/registro-compra-master.css'
  ],
  encapsulation: ViewEncapsulation.None
})
export class RemitoMaster implements OnInit {
  private fb = inject(FormBuilder);

  readonly estadosFiltro = ['TODOS', 'PENDIENTE', 'PARCIAL', 'LIBERADO'];

  displayedColumns = [
    'numero',
    'fecha',
    'registroCompra',
    'proveedor',
    'estado',
    'acciones'
  ];

  dataSource = new MatTableDataSource<Remito>([]);
  remitos: Remito[] = [];
  cargando = false;
  liberandoId: number | null = null;
  cancelandoId: number | null = null;
  idRegistroCompra: number | null = null;
  registroCompra: RegistroCompra | null = null;
  filtrosAbiertos = true;

  filtrosForm = this.fb.group({
    busqueda: [''],
    estado: ['TODOS'],
    fechaDesde: [null as Date | null],
    fechaHasta: [null as Date | null]
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  totalRemitos = 0;
  pageIndex = 0;
  pageSize = 10;
  sortActive = 'fecha';
  sortDirection: 'asc'|'desc' = 'desc';
  private recargar$ = new Subject<void>();

  constructor(
    private remitosService: Remitos,
    private registroCompraService: RegistroCompraService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const idRegistro = this.route.snapshot.paramMap.get('id');
    this.idRegistroCompra = idRegistro ? Number(idRegistro) : null;
    this.recargar$.pipe(switchMap(()=>{
      this.cargando=true;
      const query=this.construirQuery();
      const request$=this.idRegistroCompra
        ? this.remitosService.getRemitosRegistroCompraPaginados(this.idRegistroCompra,query)
        : this.remitosService.getRemitosPaginados(query);
      return request$.pipe(
        tap(response=>{this.remitos=response.data;this.dataSource.data=response.data;this.totalRemitos=response.page.total;this.pageIndex=response.page.index;this.cargando=false;}),
        catchError(error=>{this.cargando=false;this.snackBar.open(error?.error?.message||'Error al obtener remitos.','Cerrar',{duration:3500});return EMPTY;})
      );
    })).subscribe();
    this.cargarRegistroCompraSeleccionado();
    this.configurarFiltros();
    this.cargarRemitos();
  }

  configurarFiltros(): void {
    this.filtrosForm.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      this.aplicarFiltros();
    });
  }

  cargarRegistroCompraSeleccionado(): void {
    if (!this.idRegistroCompra) {
      this.registroCompra = null;
      return;
    }

    this.registroCompraService.getRegistroById(this.idRegistroCompra).subscribe({
      next: registro => {
        this.registroCompra = registro;
      },
      error: () => {
        this.registroCompra = null;
      }
    });
  }

  cargarRemitos(): void {
    this.recargar$.next();
  }

  nuevoRemito(): void {
    if (this.idRegistroCompra) {
      this.router.navigate(['/ingreso-materiales/registros', this.idRegistroCompra, 'remitos', 'nuevo']);
      return;
    }

    this.router.navigate(['/ingreso-materiales/remitos/nuevo']);
  }

  verDetalle(remito: Remito): void {
    if (this.idRegistroCompra) {
      this.router.navigate(['/ingreso-materiales/registros', this.idRegistroCompra, 'remitos', remito.idRemito]);
      return;
    }

    this.router.navigate(['/ingreso-materiales/remitos/detalle', remito.idRemito]);
  }

  puedeEditar(remito: Remito): boolean {
    return this.estadoRemito(remito) === 'PENDIENTE'
      && this.liberandoId !== remito.idRemito
      && this.cancelandoId !== remito.idRemito;
  }

  editarRemito(remito: Remito): void {
    if (!this.puedeEditar(remito)) return;
    if (this.idRegistroCompra) {
      this.router.navigate([
        '/ingreso-materiales/registros', this.idRegistroCompra, 'remitos', remito.idRemito, 'editar'
      ]);
      return;
    }
    this.router.navigate(['/ingreso-materiales/remitos/editar', remito.idRemito]);
  }

  puedeLiberar(remito: Remito): boolean {
    return !remito.liberado && this.liberandoId !== remito.idRemito && this.cancelandoId !== remito.idRemito;
  }

  puedeCancelar(remito: Remito): boolean {
    return this.estadoRemito(remito) === 'PENDIENTE'
      && this.liberandoId !== remito.idRemito
      && this.cancelandoId !== remito.idRemito;
  }

  cancelarRemito(remito: Remito): void {
    if (!this.puedeCancelar(remito) || !confirm(
      `¿Cancelar el Remito ${remito.numero}?\n\nDejará de verse en el sistema y permitirá editar la OC/FAC cuando no queden otros remitos activos.`
    )) return;

    this.cancelandoId = remito.idRemito;
    this.remitosService.cancelarRemito(remito.idRemito).subscribe({
      next: response => {
        this.cancelandoId = null;
        this.snackBar.open(response?.message || 'Remito cancelado correctamente.', 'Cerrar', { duration: 4500 });
        this.cargarRemitos();
      },
      error: error => {
        this.cancelandoId = null;
        this.snackBar.open(error?.error?.message || 'No se pudo cancelar el remito.', 'Cerrar', { duration: 4500 });
      }
    });
  }

  liberar(remito: Remito): void {
    this.verDetalle(remito);
  }

  estadoRemito(remito: Remito): string {
    return remito.estadoLiberacion || (remito.liberado ? 'LIBERADO' : 'PENDIENTE');
  }

  aplicarFiltros(): void {
    this.pageIndex=0;
    this.cargarRemitos();
  }

  cambiarPagina(event:{pageIndex:number;pageSize:number}):void{this.pageIndex=event.pageIndex;this.pageSize=event.pageSize;this.cargarRemitos();}
  cambiarOrden(event:{active:string;direction:string}):void{this.sortActive=event.active;this.sortDirection=(event.direction||'desc') as 'asc'|'desc';this.pageIndex=0;this.cargarRemitos();}

  private construirQuery():Record<string,string|number|null|undefined>{const f=this.filtrosForm.getRawValue();return{page:this.pageIndex,pageSize:this.pageSize,search:f.busqueda?.trim(),estado:f.estado==='TODOS'?null:f.estado,fechaDesde:this.fechaQuery(f.fechaDesde),fechaHasta:this.fechaQuery(f.fechaHasta),sort:this.sortActive,direction:this.sortDirection};}
  private fechaQuery(fecha:Date|null):string|null{if(!fecha)return null;return`${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`;}

  limpiarFiltros(): void {
    this.filtrosForm.reset({
      busqueda: '',
      estado: 'TODOS',
      fechaDesde: null,
      fechaHasta: null
    });
  }

  formatearFecha(fecha?: string | null): string {
    return fecha ? fecha.substring(0, 10) : '-';
  }

  private normalizarTexto(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private normalizarFechaFiltro(value: Date | string | null | undefined, modo: 'desde' | 'hasta'): Date | null {
    if (!value) {
      return null;
    }

    const fecha = value instanceof Date ? new Date(value) : new Date(String(value).substring(0, 10));

    if (Number.isNaN(fecha.getTime())) {
      return null;
    }

    fecha.setHours(modo === 'desde' ? 0 : 23, modo === 'desde' ? 0 : 59, modo === 'desde' ? 0 : 59, modo === 'desde' ? 0 : 999);
    return fecha;
  }

  volver(): void {
    if (this.idRegistroCompra) {
      this.router.navigate(['/ingreso-materiales/registros']);
      return;
    }

    this.router.navigate(['/ingreso-materiales']);
  }

}
