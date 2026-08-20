import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ResponsablesCuadrillasService } from '../../../core/services/responsables-cuadrillas/responsables-cuadrillas';
import { ResponsableOperacion, ResponsablePayload, TipoResponsable } from '../../../shared/interfaces/responsable-operacion.interface';

@Component({
  selector: 'app-responsables-cuadrillas-master', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatSnackBarModule, MatTooltipModule],
  templateUrl: './responsables-cuadrillas-master.html', styleUrl: './responsables-cuadrillas-master.css'
})
export class ResponsablesCuadrillasMaster implements OnInit {
  readonly tipos: Array<{ valor: TipoResponsable; nombre: string }> = [
    { valor: 'CUADRILLA_PROPIA', nombre: 'Cuadrilla propia' },
    { valor: 'SUBCONTRATISTA', nombre: 'Subcontratista' },
    { valor: 'RESPONSABLE', nombre: 'Responsable individual' }
  ];
  responsables: ResponsableOperacion[] = [];
  filtro = '';
  tipoFiltro: TipoResponsable | 'TODOS' = 'TODOS';
  estadoFiltro: 'TODOS' | 'ACTIVOS' | 'INACTIVOS' = 'TODOS';
  cargando = false;
  guardando = false;
  editando: ResponsableOperacion | 'NUEVO' | null = null;
  borrador: ResponsablePayload = { codigo: '', nombre: '', tipo: 'CUADRILLA_PROPIA', activo: true };

  constructor(private service: ResponsablesCuadrillasService, private router: Router, private snackBar: MatSnackBar) {}
  ngOnInit(): void { this.cargar(); }

  get filtrados(): ResponsableOperacion[] {
    const termino = this.normalizar(this.filtro);
    return this.responsables.filter(item =>
      (!termino || this.normalizar(`${item.codigo} ${item.nombre} ${this.nombreTipo(item.tipo)}`).includes(termino)) &&
      (this.tipoFiltro === 'TODOS' || item.tipo === this.tipoFiltro) &&
      (this.estadoFiltro === 'TODOS' || (this.estadoFiltro === 'ACTIVOS' ? item.activo : !item.activo))
    );
  }

  cargar(): void {
    this.cargando = true;
    this.service.listar().pipe(finalize(() => this.cargando = false)).subscribe({
      next: data => this.responsables = data,
      error: error => this.mensaje(error?.error?.message || 'No se pudo cargar el maestro')
    });
  }
  agregar(): void { this.editando = 'NUEVO'; this.borrador = { codigo: '', nombre: '', tipo: 'CUADRILLA_PROPIA', activo: true }; }
  editar(item: ResponsableOperacion): void { this.editando = item; this.borrador = { codigo: item.codigo, nombre: item.nombre, tipo: item.tipo, activo: item.activo }; }
  cancelar(): void { if (!this.guardando) this.editando = null; }
  guardar(): void {
    this.borrador.codigo = this.borrador.codigo.trim().toUpperCase();
    this.borrador.nombre = this.borrador.nombre.trim();
    if (!this.borrador.codigo || !this.borrador.nombre) return this.mensaje('Código y nombre son obligatorios');
    this.guardando = true;
    const request = this.editando === 'NUEVO'
      ? this.service.crear(this.borrador)
      : this.service.actualizar((this.editando as ResponsableOperacion).responsable_id, this.borrador);
    request.pipe(finalize(() => this.guardando = false)).subscribe({
      next: () => { this.editando = null; this.cargar(); this.mensaje('Responsable o cuadrilla guardado correctamente'); },
      error: error => this.mensaje(error?.error?.message || 'No se pudo guardar')
    });
  }
  cambiarEstado(item: ResponsableOperacion): void {
    this.service.cambiarEstado(item.responsable_id, !item.activo).subscribe({
      next: actualizado => { item.activo = actualizado.activo; this.mensaje(actualizado.activo ? 'Responsable activado' : 'Responsable desactivado'); },
      error: error => this.mensaje(error?.error?.message || 'No se pudo cambiar el estado')
    });
  }
  verDetalle(item: ResponsableOperacion): void { this.router.navigate(['/system-tools/responsables-cuadrillas', item.responsable_id]); }
  nombreTipo(tipo: TipoResponsable): string { return this.tipos.find(item => item.valor === tipo)?.nombre || tipo; }
  private normalizar(value: unknown): string { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase(); }
  private mensaje(texto: string): void { this.snackBar.open(texto, 'Cerrar', { duration: 4000 }); }
}
