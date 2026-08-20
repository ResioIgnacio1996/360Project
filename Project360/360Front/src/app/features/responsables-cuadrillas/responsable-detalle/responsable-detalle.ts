import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ResponsablesCuadrillasService } from '../../../core/services/responsables-cuadrillas/responsables-cuadrillas';
import { DetalleResponsable, OperacionResponsable } from '../../../shared/interfaces/responsable-operacion.interface';

@Component({
  selector: 'app-responsable-detalle', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, MatTooltipModule],
  templateUrl: './responsable-detalle.html', styleUrl: './responsable-detalle.css'
})
export class ResponsableDetalle implements OnInit {
  detalle: DetalleResponsable | null = null;
  proyectos: Array<{ id: number; nombre: string }> = [];
  operacionesFiltradas: OperacionResponsable[] = [];
  cargando = false;
  error = '';
  proyectoFiltro: number | 'TODOS' = 'TODOS';
  cumplimientoFiltro = 'TODOS';

  constructor(private route: ActivatedRoute, private service: ResponsablesCuadrillasService) {}
  ngOnInit(): void { this.cargar(); }

  private prepararVista(): void {
    const mapa = new Map<number, string>();
    this.detalle?.operaciones.forEach(item => mapa.set(Number(item.proyecto_id), item.proyecto_nombre));
    this.proyectos = [...mapa]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    this.operacionesFiltradas = (this.detalle?.operaciones || []).filter(item =>
      (this.proyectoFiltro === 'TODOS' || Number(item.proyecto_id) === Number(this.proyectoFiltro)) &&
      (this.cumplimientoFiltro === 'TODOS' || item.cumplimiento === this.cumplimientoFiltro)
    );
  }

  cargar(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      this.error = 'La cuadrilla seleccionada no es valida';
      return;
    }
    this.cargando = true;
    this.error = '';
    this.service.obtener(id).pipe(finalize(() => this.cargando = false)).subscribe({
      next: detalle => {
        this.detalle = detalle;
        this.prepararVista();
      },
      error: error => this.error = error?.error?.message || 'No se pudo cargar el detalle'
    });
  }
  trackProyecto(_index: number, proyecto: { id: number }): number { return proyecto.id; }
  trackOperacion(_index: number, operacion: OperacionResponsable): number { return operacion.operacion_id; }
  claseCumplimiento(valor: string): string { return `timing timing-${valor.toLowerCase().replaceAll('_', '-')}`; }
  nombreCumplimiento(valor: string): string {
    const nombres: Record<string, string> = { CUMPLIDA_A_TIEMPO: 'Cumplida a tiempo', CUMPLIDA_CON_DEMORA: 'Cumplida con demora', CUMPLIDA: 'Cumplida', ATRASADA: 'Atrasada', EN_RIESGO: 'En riesgo', EN_TERMINO: 'En término' };
    return nombres[valor] || valor;
  }
}
