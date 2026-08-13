import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { StockGeneral } from '../../../../../core/services/stock-general';

@Component({
  selector: 'app-container-movimientos',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './conteiner-movimientos.html',
  styleUrl: './conteiner-movimientos.css'
})
export class ContainerMovimientos implements OnInit {
  proyectoId = 0;
  materialId = 0;
  detalle: any = null;
  cargando = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockService: StockGeneral
  ) {}

  ngOnInit(): void {
    this.proyectoId = Number(this.route.snapshot.paramMap.get('id'));
    this.materialId = Number(this.route.snapshot.paramMap.get('materialId'));
    if (!this.proyectoId || !this.materialId) {
      this.cargando = false;
      this.error = 'El proyecto o el material no son válidos.';
      return;
    }
    this.cargar();
  }

  get movimientos(): any[] { return this.detalle?.movimientos || []; }
  get totalIngresado(): number {
    return this.movimientos
      .filter(m => m.tipo === 'INGRESO')
      .reduce((total, m) => total + Number(m.cantidad || 0), 0);
  }
  get totalConsumido(): number {
    return this.movimientos
      .filter(m => m.tipo === 'CONSUMO' && !m.anulado)
      .reduce((total, m) => total + Number(m.cantidad || 0), 0);
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.stockService.movimientos(this.proyectoId, this.materialId).subscribe({
      next: response => { this.detalle = response; this.cargando = false; },
      error: error => {
        this.error = error?.error?.message || 'No se pudieron cargar los movimientos del material.';
        this.cargando = false;
      }
    });
  }

  volver(): void {
    this.router.navigate(['/proyectos', this.proyectoId, 'stock']);
  }
}
