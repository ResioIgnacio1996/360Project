import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { StockGeneral } from '../../../../../core/services/stock-general';
import { ProyectoService } from '../../../../../core/services/proyecto/proyecto';
import { BomService } from '../../../../../core/services/bom/bom';

@Component({
  selector: 'app-container-master',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './conteiner-master.html',
  styleUrl: './conteiner-master.css'
})
export class containerMaster implements OnInit {
  proyectoId = 0; proyecto: any; stock: any[] = []; asignados: any[] = []; bom: any[] = [];
  stockId: number | null = null; cantidad: number | null = null;
  error = ''; mensaje = ''; procesando = false;
  modalBom = false; archivoBom: File | null = null; previewBom: any = null;

  constructor(
    private route: ActivatedRoute, private router: Router, private stockService: StockGeneral,
    private proyectos: ProyectoService, private bomService: BomService
  ) {}

  ngOnInit(): void {
    this.proyectoId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.proyectoId) { this.error = 'Seleccione un proyecto desde el maestro de proyectos.'; return; }
    this.proyectos.getProyecto(this.proyectoId).subscribe(p => this.proyecto = p);
    this.cargar();
  }
  cargar(): void {
    this.stockService.listar().subscribe(r => this.stock = r.filter(x => Number(x.cantidad_disponible) > 0));
    this.stockService.porProyecto(this.proyectoId).subscribe(r => this.asignados = r);
    this.bomService.listar(this.proyectoId).subscribe({ next: r => this.bom = r, error: e => this.error = e?.error?.message || 'No se pudo cargar el BOM' });
  }
  asignar(): void {
    if (!this.stockId || !this.cantidad || this.cantidad <= 0) return;
    this.procesando = true;
    this.stockService.asignar({ stock_general_id: this.stockId, proyecto_id: this.proyectoId, cantidad: this.cantidad }).subscribe({
      next: () => { this.cantidad = null; this.procesando = false; this.cargar(); },
      error: e => { this.error = e?.error?.message || 'Error al asignar'; this.procesando = false; }
    });
  }
  devolver(item: any): void {
    const valor = Number(prompt(`Cantidad de ${item.material} a devolver:`, String(item.cantidad_disponible)));
    if (!valor) return;
    this.stockService.devolver({ container_id: item.container_id, cantidad: valor }).subscribe({
      next: () => this.cargar(), error: e => this.error = e?.error?.message || 'Error al devolver'
    });
  }
  abrirImportacion(): void { this.modalBom = true; this.archivoBom = null; this.previewBom = null; this.error = ''; }
  get filasPreview(): any[] { return (this.previewBom?.datos || []).slice(0, 12); }
  cerrarImportacion(): void { if (!this.procesando) this.modalBom = false; }
  seleccionarBom(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.archivoBom = input.files?.[0] || null; this.previewBom = null; this.error = '';
  }
  previsualizarBom(): void {
    if (!this.archivoBom) return;
    this.procesando = true; this.error = '';
    this.bomService.previsualizar(this.proyectoId, this.archivoBom).subscribe({
      next: r => { this.previewBom = r; this.procesando = false; },
      error: e => { this.error = e?.error?.message || 'No se pudo procesar el CSV'; this.procesando = false; }
    });
  }
  importarBom(): void {
    if (!this.previewBom || this.previewBom.errores?.length) return;
    this.procesando = true; this.error = '';
    this.bomService.importar(this.proyectoId, this.previewBom.datos).subscribe({
      next: r => {
        this.procesando = false; this.modalBom = false;
        this.mensaje = `${r.message}: ${r.resumen.insertadas} nuevas y ${r.resumen.actualizadas} actualizadas`;
        this.cargar(); setTimeout(() => this.mensaje = '', 4500);
      },
      error: e => { this.error = e?.error?.message || 'No se pudo importar el BOM'; this.procesando = false; }
    });
  }
  volver(): void { this.router.navigate(['/proyectos', this.proyectoId]); }
}
