import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { DetalleRemito, Remito, Remitos } from '../../../../../core/services/remitos';
import { ProyectoService } from '../../../../../core/services/proyecto/proyecto';

interface DestinoLiberacion {
  proyectoId: number | null;
  cantidad: number;
}

interface MaterialLiberacion {
  idMaterial: number;
  material: string;
  unidad: string;
  cantidadTotal: number;
  destinos: DestinoLiberacion[];
}

@Component({
  selector: 'app-remito-detalle',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule
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
  materialesLiberacion: MaterialLiberacion[] = [];

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

    this.proyectoService.getProyectos().subscribe({
      next: response => {
        this.proyectos = (Array.isArray(response) ? response : [])
          .filter(proyecto => proyecto.activo !== false && proyecto.estado !== 'CANCELADO');
      },
      error: () => this.proyectos = []
    });
  }

  cargarRemito(id: number): void {
    this.cargando = true;

    this.remitosService.getRemitoById(id).subscribe({
      next: remito => {
        this.cargando = false;
        this.remito = remito;
        this.inicializarDistribucion(remito);
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

    if (!this.distribucionValida()) {
      this.snackBar.open(
        'Distribuí completamente cada material entre proyectos, sin faltantes ni excesos.',
        'Cerrar',
        { duration: 4000 }
      );
      return;
    }

    const confirmado = confirm(
      `¿Confirmás la liberación del remito ${this.remito.numero}?\n\n` +
      'Los materiales ingresarán a los proyectos seleccionados y se generarán sus lotes de costo.'
    );

    if (!confirmado) {
      return;
    }

    const asignaciones = this.materialesLiberacion.map(material => ({
      id_material: material.idMaterial,
      destinos: material.destinos.map(destino => ({
        proyecto_id: Number(destino.proyectoId),
        cantidad: Number(destino.cantidad)
      }))
    }));

    this.liberando = true;

    this.remitosService.liberarRemito(this.remito.idRemito, asignaciones).subscribe({
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

  inicializarDistribucion(remito: Remito): void {
    this.materialesLiberacion = (remito.detalle ?? []).map(item => ({
      idMaterial: item.idMaterial,
      material: item.material,
      unidad: item.unidad,
      cantidadTotal: Number(item.cantidad),
      destinos: [{
        proyectoId: remito.idProyecto ?? null,
        cantidad: Number(item.cantidad)
      }]
    }));
  }

  agregarDestino(material: MaterialLiberacion): void {
    material.destinos.push({ proyectoId: null, cantidad: 0 });
  }

  quitarDestino(material: MaterialLiberacion, index: number): void {
    if (material.destinos.length === 1) {
      this.snackBar.open('Cada material debe conservar al menos un proyecto destino.', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    material.destinos.splice(index, 1);
  }

  cantidadAsignada(material: MaterialLiberacion): number {
    return this.redondearCantidad(material.destinos.reduce(
      (total, destino) => total + Number(destino.cantidad || 0),
      0
    ));
  }

  cantidadRestante(material: MaterialLiberacion): number {
    return this.redondearCantidad(material.cantidadTotal - this.cantidadAsignada(material));
  }

  proyectoUsadoEnOtroDestino(
    material: MaterialLiberacion,
    proyectoId: number,
    destinoActual: DestinoLiberacion
  ): boolean {
    return material.destinos.some(destino =>
      destino !== destinoActual && Number(destino.proyectoId) === Number(proyectoId)
    );
  }

  distribucionMaterialValida(material: MaterialLiberacion): boolean {
    const proyectos = material.destinos.map(destino => Number(destino.proyectoId));
    const proyectosValidos = proyectos.every(id => id > 0);
    const proyectosUnicos = new Set(proyectos).size === proyectos.length;
    const cantidadesValidas = material.destinos.every(destino => Number(destino.cantidad) > 0);

    return proyectosValidos
      && proyectosUnicos
      && cantidadesValidas
      && Math.abs(this.cantidadRestante(material)) < 0.005;
  }

  distribucionValida(): boolean {
    return this.materialesLiberacion.length > 0
      && this.materialesLiberacion.every(material => this.distribucionMaterialValida(material));
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

  private redondearCantidad(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
