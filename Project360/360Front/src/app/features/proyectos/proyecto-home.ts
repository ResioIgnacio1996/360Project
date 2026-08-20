import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProyectoService } from '../../core/services/proyecto/proyecto';

@Component({
  selector: 'app-proyecto-home',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './proyecto-home.html',
  styleUrl: './proyecto-home.css'
})
export class ProyectoHome implements OnInit {
  proyecto: any = null;
  cargando = true;
  error = '';
  proyectoId = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private proyectoService: ProyectoService
  ) {}

  ngOnInit(): void {
    this.proyectoId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.proyectoId) {
      this.error = 'Proyecto inválido';
      this.cargando = false;
      return;
    }

    this.proyectoService.getProyecto(this.proyectoId).subscribe({
      next: proyecto => {
        this.proyecto = proyecto;
        this.cargando = false;
      },
      error: error => {
        this.error = error?.error?.message || 'No se pudo cargar el proyecto';
        this.cargando = false;
      }
    });
  }

  abrirProgramacion(): void {
    this.router.navigate(['/proyectos', this.proyectoId, 'programacion']);
  }

  abrirContainer(): void {
    this.router.navigate(['/proyectos', this.proyectoId, 'stock']);
  }

  abrirBom(): void {
    this.router.navigate(['/proyectos', this.proyectoId, 'bom']);
  }

  abrirAvances(): void {
    this.router.navigate(['/proyectos', this.proyectoId, 'avances']);
  }

  abrirDependencias(): void {
    this.router.navigate(['/proyectos', this.proyectoId, 'dependencias']);
  }

  codigoProyecto(): string {
    const codigo = this.proyecto?.codigo || this.proyecto?.codigo_proyecto;
    return codigo ? String(codigo) : `PRJ-${String(this.proyectoId).padStart(4, '0')}`;
  }

  claseEstado(): string {
    switch (String(this.proyecto?.estado || '').toUpperCase()) {
      case 'ACTIVO': return 'estado-activo';
      case 'PAUSADO': return 'estado-pausado';
      case 'FINALIZADO': return 'estado-finalizado';
      case 'CANCELADO': return 'estado-cancelado';
      default: return 'estado-default';
    }
  }
}
