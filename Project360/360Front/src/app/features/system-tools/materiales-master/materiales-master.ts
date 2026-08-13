import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MaterialService } from '../../../core/services/material/material';

interface MaterialMaestro { id_material: number; nombre: string; descripcion?: string | null; uom_id: number; UoM: string; }

@Component({
  selector: 'app-materiales-master', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatSnackBarModule],
  templateUrl: './materiales-master.html', styleUrl: './materiales-master.css'
})
export class MaterialesMaster implements OnInit {
  materiales: MaterialMaestro[] = [];
  unidades: Array<{ uom_id: number; nombre: string }> = [];
  filtro = ''; cargando = false; guardando = false; editando: MaterialMaestro | null = null;
  borrador = { nombre: '', uom_id: 0 };

  constructor(private service: MaterialService, private snackBar: MatSnackBar) {}
  ngOnInit(): void { this.cargar(); }
  get materialesFiltrados(): MaterialMaestro[] {
    const termino = this.normalizar(this.filtro);
    return !termino ? this.materiales : this.materiales.filter(m => this.normalizar(`${m.id_material} ${m.nombre} ${m.UoM}`).includes(termino));
  }
  cargar(): void {
    this.cargando = true;
    forkJoin({ materiales: this.service.getMateriales(), unidades: this.service.getUom() }).pipe(finalize(() => this.cargando = false)).subscribe({
      next: r => { this.materiales = r.materiales; this.unidades = r.unidades; },
      error: e => this.mensaje(e?.error?.message || 'No se pudo cargar el maestro de materiales')
    });
  }
  editar(material: MaterialMaestro): void { this.editando = material; this.borrador = { nombre: material.nombre, uom_id: Number(material.uom_id) }; }
  cancelar(): void { if (!this.guardando) this.editando = null; }
  guardar(): void {
    if (!this.editando || !this.borrador.nombre.trim() || !this.borrador.uom_id) return this.mensaje('La descripciÃ³n y la UOM son obligatorias');
    this.guardando = true;
    this.service.actualizarMaterial(this.editando.id_material, { nombre: this.borrador.nombre.trim(), uom_id: Number(this.borrador.uom_id) })
      .pipe(finalize(() => this.guardando = false)).subscribe({
        next: actualizado => { Object.assign(this.editando!, actualizado); this.editando = null; this.mensaje('Material actualizado en el maestro y en las BOM vinculadas'); },
        error: e => this.mensaje(e?.error?.message || 'No se pudo actualizar el material')
      });
  }
  private normalizar(v: unknown): string { return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase(); }
  private mensaje(t: string): void { this.snackBar.open(t, 'Cerrar', { duration: 4000 }); }
}
