import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

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
  ],
  templateUrl: './remito-master.html',
  styleUrl: './remito-master.css',
})
export class RemitoMaster implements OnInit {
  private fb = inject(FormBuilder);

  readonly estadosFiltro = ['TODOS', 'PENDIENTE', 'LIBERADO'];

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
  idRegistroCompra: number | null = null;
  registroCompra: RegistroCompra | null = null;
  filtrosAbiertos = true;

  filtrosForm = this.fb.group({
    busqueda: [''],
    estado: ['TODOS'],
    fechaDesde: [null as Date | null],
    fechaHasta: [null as Date | null]
  });

  @ViewChild(MatPaginator) paginator!: MatPaginator;

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
    this.cargarRegistroCompraSeleccionado();
    this.configurarFiltros();
    this.cargarRemitos();
  }

  configurarFiltros(): void {
    this.filtrosForm.valueChanges.subscribe(() => {
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
    this.cargando = true;

    const request$ = this.idRegistroCompra
      ? this.remitosService.getRemitosByRegistroCompra(this.idRegistroCompra)
      : this.remitosService.getRemitos();

    request$.subscribe({
      next: remitos => {
        this.cargando = false;
        this.remitos = remitos;
        this.dataSource = new MatTableDataSource(remitos);
        this.dataSource.paginator = this.paginator;
        this.aplicarFiltros();
      },
      error: error => {
        this.cargando = false;
        this.snackBar.open(error?.error?.message || 'Error al obtener remitos.', 'Cerrar', {
          duration: 3500
        });
      }
    });
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

  puedeLiberar(remito: Remito): boolean {
    return !remito.liberado && this.liberandoId !== remito.idRemito;
  }

  liberar(remito: Remito): void {
    const confirmado = confirm(
      `Confirmas la liberacion del Remito ${remito.numero}?\n\n` +
      'Esta accion actualizara el Stock General y recalculara el estado del Registro de Compra.\n\n' +
      'Una vez liberado, el Remito no podra volver a liberarse.'
    );

    if (!confirmado) {
      return;
    }

    this.liberandoId = remito.idRemito;

    this.remitosService.liberarRemito(remito.idRemito).subscribe({
      next: response => {
        this.liberandoId = null;
        this.snackBar.open(response?.message || 'Remito liberado correctamente.', 'Cerrar', {
          duration: 3500
        });
        this.cargarRemitos();
      },
      error: error => {
        this.liberandoId = null;
        this.snackBar.open(error?.error?.message || 'Error al liberar remito.', 'Cerrar', {
          duration: 4000
        });
      }
    });
  }

  estadoRemito(remito: Remito): string {
    return remito.liberado ? 'LIBERADO' : 'PENDIENTE';
  }

  aplicarFiltros(): void {
    const filtros = this.filtrosForm.getRawValue();
    const busqueda = this.normalizarTexto(filtros.busqueda ?? '');
    const estado = filtros.estado ?? 'TODOS';
    const fechaDesde = this.normalizarFechaFiltro(filtros.fechaDesde, 'desde');
    const fechaHasta = this.normalizarFechaFiltro(filtros.fechaHasta, 'hasta');

    const filtrados = this.remitos.filter(remito => {
      const textoRemito = this.normalizarTexto([
        remito.numero,
        remito.registroCompraNumero,
        remito.idRegistroCompra,
        remito.proveedor,
        remito.estadoRegistroCompra,
        this.estadoRemito(remito)
      ].join(' '));

      const cumpleBusqueda = !busqueda || textoRemito.includes(busqueda);
      const cumpleEstado = estado === 'TODOS' || this.estadoRemito(remito) === estado;
      const fechaRemito = this.normalizarFechaFiltro(remito.fecha, 'desde');
      const cumpleDesde = !fechaDesde || !!fechaRemito && fechaRemito >= fechaDesde;
      const cumpleHasta = !fechaHasta || !!fechaRemito && fechaRemito <= fechaHasta;

      return cumpleBusqueda && cumpleEstado && cumpleDesde && cumpleHasta;
    });

    this.dataSource.data = filtrados;
    this.dataSource.paginator = this.paginator;
    this.paginator?.firstPage();
  }

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
