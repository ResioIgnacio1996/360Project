import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

import { DetalleRemito, Remito, Remitos } from '../../../../../core/services/remitos';
import { ProyectoService } from '../../../../../core/services/proyecto/proyecto';

@Component({
  selector: 'app-remito-detalle',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTableModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule
  ],
  templateUrl: './remito-detalle.html',
  styleUrl: './remito-detalle.css',
})
export class RemitoDetalle implements OnInit {
  remito: Remito | null = null;
  idRegistroCompra: number | null = null;
  displayedColumns = ['material', 'cantidad', 'unidad'];
  cargando = false;
  liberando = false;
  proyectos: any[] = [];
  proyectoSeleccionado: number | null = null;

  get detalleRemito(): DetalleRemito[] {
    return (this.remito?.detalle ?? []).filter(item =>
      !!item.material && Number(item.cantidad) > 0
    );
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private remitosService: Remitos,
    private proyectoService: ProyectoService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const remitoId = this.route.snapshot.paramMap.get('remitoId');
    const id = Number(remitoId || this.route.snapshot.paramMap.get('id'));
    const idRegistro = this.route.snapshot.paramMap.get('id');
    this.idRegistroCompra = remitoId && idRegistro ? Number(idRegistro) : null;

    if (id) {
      this.cargarRemito(id);
    }
    this.proyectoService.getProyectos().subscribe({next:r=>this.proyectos=(Array.isArray(r)?r:[]).filter(p=>p.activo!==false&&p.estado!=='CANCELADO'),error:()=>this.proyectos=[]});
  }

  cargarRemito(id: number): void {
    this.cargando = true;

    this.remitosService.getRemitoById(id).subscribe({
      next: remito => {
        this.cargando = false;
        this.remito = remito;
        this.proyectoSeleccionado = remito.idProyecto ?? null;
      },
      error: error => {
        this.cargando = false;
        this.snackBar.open(error?.error?.message || 'Error al obtener remito.', 'Cerrar', {
          duration: 3500
        });
      }
    });
  }

  liberar(): void {
    if (!this.remito || this.remito.liberado) {
      return;
    }
    if (!this.remito.idProyecto && !this.proyectoSeleccionado) {
      this.snackBar.open('Seleccione el proyecto al que se liberará el stock.', 'Cerrar', {duration:3500});
      return;
    }

    const confirmado = confirm(
      `Confirmas la liberacion del Remito ${this.remito.numero}?\n\n` +
      'Los materiales ingresarán al proyecto y se generarán sus lotes de costo.'
    );

    if (!confirmado) {
      return;
    }

    this.liberando = true;

    this.remitosService.liberarRemito(this.remito.idRemito, this.proyectoSeleccionado).subscribe({
      next: response => {
        this.liberando = false;
        this.snackBar.open(response?.message || 'Remito liberado correctamente.', 'Cerrar', {
          duration: 3500
        });
        this.cargarRemito(this.remito!.idRemito);
      },
      error: error => {
        this.liberando = false;
        this.snackBar.open(error?.error?.message || 'Error al liberar remito.', 'Cerrar', {
          duration: 4000
        });
      }
    });
  }

  volver(): void {
    if (this.idRegistroCompra) {
      this.router.navigate(['/ingreso-materiales/registros', this.idRegistroCompra, 'remitos']);
      return;
    }

    this.router.navigate(['/ingreso-materiales/remitos']);
  }

  formatearFecha(fecha?: string | null): string {
    return fecha ? fecha.substring(0, 10) : '-';
  }
}
