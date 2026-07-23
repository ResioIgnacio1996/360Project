import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';

import { RegistroCompraService } from '../../../../../core/services/registro-compra/registro-compra';
import { Remito, Remitos } from '../../../../../core/services/remitos';
import { DetalleRegistroCompra, RegistroCompra } from '../../../../../shared/interfaces/RegistroDeCompra.interface';

interface StockLiberadoLinea {
  idMaterial?: number | null;
  material: string;
  unidad: string;
  esperado: number;
  liberado: number;
  pendiente: number;
  estado: 'PENDIENTE' | 'PARCIAL' | 'COMPLETO';
}

@Component({
  selector: 'app-registro-compra-detalle',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
    MatExpansionModule
  ],
  templateUrl: './registro-compra-detalle.html',
  styleUrl: './registro-compra-detalle.css',
})
export class RegistroCompraDetalle implements OnInit {
  readonly idRegistro: string | null;
  registro: RegistroCompra | null = null;
  remitos: Remito[] = [];
  stockLiberado: StockLiberadoLinea[] = [];
  detalleColumns = ['material', 'descripcion', 'cantidad', 'unidad'];
  remitosColumns = ['numero', 'fecha', 'estado', 'acciones'];
  cargando = false;
  cargandoRemitos = false;
  cargandoStock = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private registroCompraService: RegistroCompraService,
    private remitosService: Remitos,
    private snackBar: MatSnackBar
  ) {
    this.idRegistro = this.route.snapshot.paramMap.get('id');
  }

  ngOnInit(): void {
    if (!this.idRegistro) {
      return;
    }

    this.cargarRegistro(Number(this.idRegistro));
  }

  cargarRegistro(id: number): void {
    this.cargando = true;

    this.registroCompraService.getRegistroById(id).subscribe({
      next: registro => {
        this.cargando = false;
        this.registro = registro;
        this.cargarRemitos(id);
        this.cargarStockLiberado(id, registro.detalle ?? []);
      },
      error: error => {
        this.cargando = false;
        this.snackBar.open(error?.error?.message || 'Error al obtener el registro de compra.', 'Cerrar', {
          duration: 3500
        });
      }
    });
  }

  cargarRemitos(idRegistro: number): void {
    this.cargandoRemitos = true;

    this.remitosService.getRemitosByRegistroCompra(idRegistro).subscribe({
      next: remitos => {
        this.cargandoRemitos = false;
        this.remitos = remitos;
      },
      error: error => {
        this.cargandoRemitos = false;
        this.snackBar.open(error?.error?.message || 'Error al cargar remitos del registro.', 'Cerrar', {
          duration: 3500
        });
      }
    });
  }

  cargarStockLiberado(idRegistro: number, detalleRegistro: DetalleRegistroCompra[]): void {
    this.stockLiberado = this.crearStockEsperado(detalleRegistro, new Map());
    this.cargandoStock = true;

    this.remitosService.getRemitosByRegistroCompra(idRegistro).subscribe({
      next: remitos => {
        const remitosLiberados = remitos.filter(remito => remito.liberado);

        if (remitosLiberados.length === 0) {
          this.cargandoStock = false;
          return;
        }

        forkJoin(remitosLiberados.map(remito => this.remitosService.getRemitoById(remito.idRemito))).subscribe({
          next: remitosDetalle => {
            const liberadoPorMaterial = new Map<number, number>();

            remitosDetalle.flatMap(remito => remito.detalle ?? []).forEach(item => {
              const idMaterial = Number(item.idMaterial);

              if (!idMaterial) {
                return;
              }

              liberadoPorMaterial.set(
                idMaterial,
                (liberadoPorMaterial.get(idMaterial) ?? 0) + Number(item.cantidad ?? 0)
              );
            });

            this.stockLiberado = this.crearStockEsperado(detalleRegistro, liberadoPorMaterial);
            this.cargandoStock = false;
          },
          error: () => {
            this.cargandoStock = false;
            this.snackBar.open('Error al calcular stock liberado del registro.', 'Cerrar', {
              duration: 3500
            });
          }
        });
      },
      error: () => {
        this.cargandoStock = false;
        this.snackBar.open('Error al cargar remitos del registro.', 'Cerrar', {
          duration: 3500
        });
      }
    });
  }

  crearStockEsperado(detalleRegistro: DetalleRegistroCompra[], liberadoPorMaterial: Map<number, number>): StockLiberadoLinea[] {
    return detalleRegistro.map(item => {
      const idMaterial = Number(item.idMaterial);
      const esperado = Number(item.cantidadSolicitada ?? item.cantidad ?? 0);
      const liberado = idMaterial ? Number(liberadoPorMaterial.get(idMaterial) ?? 0) : 0;
      const pendiente = Math.max(esperado - liberado, 0);

      return {
        idMaterial: item.idMaterial,
        material: item.nombreMaterial,
        unidad: item.unidad,
        esperado,
        liberado,
        pendiente,
        estado: this.getEstadoLineaStock(esperado, liberado)
      };
    });
  }

  getEstadoLineaStock(esperado: number, liberado: number): StockLiberadoLinea['estado'] {
    if (liberado >= esperado && esperado > 0) {
      return 'COMPLETO';
    }

    if (liberado > 0) {
      return 'PARCIAL';
    }

    return 'PENDIENTE';
  }

  nuevoRemito(): void {
    if (!this.idRegistro) {
      return;
    }

    this.router.navigate(['/ingreso-materiales/registros', this.idRegistro, 'remitos', 'nuevo']);
  }

  verRemito(remito: Remito): void {
    if (!this.idRegistro) {
      return;
    }

    this.router.navigate(['/ingreso-materiales/registros', this.idRegistro, 'remitos', remito.idRemito]);
  }

  estadoRemito(remito: Remito): string {
    return remito.liberado ? 'LIBERADO' : 'PENDIENTE';
  }

  formatearFecha(fecha?: string | null): string {
    return fecha ? fecha.substring(0, 10) : '-';
  }

  volver(): void {
    this.router.navigate(['/ingreso-materiales/registros']);
  }
}
