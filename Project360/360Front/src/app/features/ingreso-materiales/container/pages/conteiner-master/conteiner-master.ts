import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { StockGeneral } from '../../../../../core/services/stock-general';
import { ProyectoService } from '../../../../../core/services/proyecto/proyecto';

@Component({
  selector: 'app-container-master',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './conteiner-master.html',
  styleUrl: './conteiner-master.css'
})
export class containerMaster implements OnInit {
  proyectoId = 0;
  proyecto: any;
  materiales: any[] = [];
  busqueda = '';
  cargando = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockService: StockGeneral,
    private proyectos: ProyectoService
  ) {}

  ngOnInit(): void {
    this.proyectoId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.proyectoId) {
      this.cargando = false;
      this.error = 'Seleccione un proyecto desde el maestro de proyectos.';
      return;
    }

    this.proyectos.getProyecto(this.proyectoId).subscribe({
      next: proyecto => this.proyecto = proyecto,
      error: () => this.error = 'No se pudieron cargar los datos del proyecto.'
    });
    this.cargarStock();
  }

  get materialesFiltrados(): any[] {
    const termino = this.normalizar(this.busqueda);
    if (!termino) return this.materiales;
    return this.materiales.filter(item =>
      this.normalizar(`${item.material} ${item.id_material} ${item.uom_nombre}`).includes(termino)
    );
  }

  get materialesConStock(): number {
    return this.materiales.filter(item => Number(item.cantidad_disponible) > 0).length;
  }

  get materialesSinStock(): number {
    return this.materiales.filter(item => Number(item.cantidad_disponible) <= 0).length;
  }

  cargarStock(): void {
    this.cargando = true;
    this.error = '';
    this.stockService.porProyecto(this.proyectoId).subscribe({
      next: response => {
        this.materiales = Array.isArray(response) ? response : [];
        this.cargando = false;
      },
      error: error => {
        this.error = error?.error?.message || 'No se pudo cargar el stock actual del proyecto.';
        this.cargando = false;
      }
    });
  }

  volver(): void {
    this.router.navigate(['/proyectos']);
  }

  verMovimientos(item: any): void {
    this.router.navigate(['/proyectos', this.proyectoId, 'stock', item.id_material, 'movimientos']);
  }

  private normalizar(value: unknown): string {
    return String(value ?? '').trim().toLocaleUpperCase('es-AR');
  }
}
