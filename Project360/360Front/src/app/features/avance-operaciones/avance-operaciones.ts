import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AvanceOperacionesService } from '../../core/services/avance-operaciones/avance-operaciones';

@Component({
  selector: 'app-avance-operaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './avance-operaciones.html',
  styleUrl: './avance-operaciones.css'
})
export class AvanceOperaciones implements OnInit {
  readonly proyectoId: number;
  proyecto: any; operaciones: any[] = []; avances: any[] = []; bom: any[] = []; consumos: any[] = [];
  seleccionada: any = null; cargando = true; guardando = false; error = ''; mensaje = '';
  busqueda = ''; estado = 'TODAS'; etapa = 'TODAS'; orden = 'secuencia'; direccion: 'asc' | 'desc' = 'asc';
  porcentaje = 0; cantidadHoy: number | null = null; nota = ''; fecha = new Date().toISOString().slice(0, 10);
  consumosHoy: Record<number, number | null> = {}; fotoNombre = ''; fotoPreview = '';

  constructor(private route: ActivatedRoute, private router: Router, private service: AvanceOperacionesService) {
    this.proyectoId = Number(this.route.snapshot.paramMap.get('id'));
  }
  ngOnInit(): void { this.cargar(); }
  cargar(mantener = true): void {
    const seleccionadaId = mantener ? this.seleccionada?.operacion_id : null;
    this.cargando = true; this.error = '';
    this.service.obtener(this.proyectoId).subscribe({
      next: d => {
        this.proyecto = d.proyecto; this.operaciones = d.operaciones || []; this.avances = d.avances || [];
        this.bom = d.bom || []; this.consumos = d.consumos || [];
        this.seleccionada = this.operaciones.find(o => o.operacion_id === seleccionadaId) || null;
        if (this.seleccionada) this.prepararFormulario();
        this.cargando = false;
      },
      error: e => { this.error = e?.error?.message || 'No se pudieron cargar las operaciones'; this.cargando = false; }
    });
  }
  get etapas(): string[] { return [...new Set(this.operaciones.map(o => o.etapa_nombre))]; }
  get estados(): string[] { return [...new Set(this.operaciones.map(o => o.estado_codigo))]; }
  get enCurso(): number { return this.operaciones.filter(o => o.estado_codigo === 'EN_CURSO').length; }
  get finalizadas(): number { return this.operaciones.filter(o => ['FINALIZADA', 'COMPLETADA'].includes(o.estado_codigo)).length; }
  get pendientes(): number { return this.operaciones.filter(o => !o.fecha_inicio_real).length; }
  get avanceGeneral(): number {
    return this.operaciones.length
      ? this.operaciones.reduce((total, o) => total + Number(o.pct_avance_actual || 0), 0) / this.operaciones.length
      : 0;
  }
  get filtradas(): any[] {
    const q = this.busqueda.trim().toLowerCase();
    const lista = this.operaciones.filter(o =>
      (this.estado === 'TODAS' || o.estado_codigo === this.estado) &&
      (this.etapa === 'TODAS' || o.etapa_nombre === this.etapa) &&
      (!q || `${o.secuencia} ${o.nombre} ${o.etapa_nombre} ${o.responsable_nombre || ''}`.toLowerCase().includes(q)));
    return [...lista].sort((a, b) => {
      let resultado = 0;
      if (this.orden === 'avance') resultado = Number(a.pct_avance_actual) - Number(b.pct_avance_actual);
      else if (this.orden === 'fecha') resultado = String(a.fecha_fin_estimada || '').localeCompare(String(b.fecha_fin_estimada || ''));
      else if (this.orden === 'reprog') resultado = String(a.fecha_fin_reprog || '').localeCompare(String(b.fecha_fin_reprog || ''));
      else if (this.orden === 'nombre') resultado = String(a.nombre || '').localeCompare(String(b.nombre || ''));
      else if (this.orden === 'responsable') resultado = String(a.responsable_nombre || '').localeCompare(String(b.responsable_nombre || ''));
      else if (this.orden === 'estado') resultado = String(a.estado_label || '').localeCompare(String(b.estado_label || ''));
      else resultado = Number(a.secuencia) - Number(b.secuencia);
      return this.direccion === 'asc' ? resultado : -resultado;
    });
  }
  get materialesSeleccionados(): any[] { return this.bom.filter(b => b.operacion_id === this.seleccionada?.operacion_id); }
  get historialAvances(): any[] { return this.avances.filter(a => a.operacion_id === this.seleccionada?.operacion_id); }
  get historialConsumos(): any[] { return this.consumos.filter(c => c.operacion_id === this.seleccionada?.operacion_id); }
  seleccionar(op: any): void { this.seleccionada = op; this.prepararFormulario(); }
  ordenar(campo: string): void {
    if (this.orden === campo) this.direccion = this.direccion === 'asc' ? 'desc' : 'asc';
    else { this.orden = campo; this.direccion = 'asc'; }
  }
  iconoOrden(campo: string): string {
    if (this.orden !== campo) return 'unfold_more';
    return this.direccion === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }
  iniciarFila(event: Event, op: any): void {
    event.stopPropagation();
    if (op.fecha_inicio_real || this.guardando) return;
    this.seleccionada = op; this.prepararFormulario(); this.iniciar();
  }
  prepararFormulario(): void {
    this.porcentaje = Number(this.seleccionada?.pct_avance_actual || 0); this.cantidadHoy = null; this.nota = '';
    this.consumosHoy = {}; this.fotoNombre = ''; this.fotoPreview = '';
  }
  volver(): void { this.router.navigate(['/proyectos', this.proyectoId]); }
  importarPlan(): void { this.router.navigate(['/proyectos', this.proyectoId, 'programacion', 'importar']); }
  verProgramacion(): void { this.router.navigate(['/proyectos', this.proyectoId, 'programacion']); }
  cerrarDetalle(): void { this.seleccionada = null; }
  iniciar(): void {
    if (!this.seleccionada || this.seleccionada.fecha_inicio_real) return;
    this.ejecutar(this.service.iniciar(this.seleccionada.operacion_id, this.fecha));
  }
  guardarAvance(): void {
    if (!this.seleccionada) return;
    this.ejecutar(this.service.registrarAvance(this.seleccionada.operacion_id, {
      porcentaje: this.porcentaje, cantidad_hoy: this.cantidadHoy, fecha_registro: this.fecha, nota: this.nota
    }));
  }
  guardarConsumos(): void {
    if (!this.seleccionada) return;
    const consumos = this.materialesSeleccionados.map(m => ({ bom_id: m.bom_id, cantidad: this.consumosHoy[m.bom_id] || 0 }));
    this.ejecutar(this.service.registrarConsumos(this.seleccionada.operacion_id, { fecha_consumo: this.fecha, consumos }));
  }
  ejecutar(peticion: any): void {
    this.guardando = true; this.error = '';
    peticion.subscribe({
      next: (r: any) => { this.guardando = false; this.mensaje = r.message; this.cargar(); setTimeout(() => this.mensaje = '', 3500); },
      error: (e: any) => { this.guardando = false; this.error = e?.error?.message || 'No se pudo guardar'; }
    });
  }
  seleccionarFoto(event: Event): void {
    const input = event.target as HTMLInputElement; const archivo = input.files?.[0];
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) { this.error = 'Seleccioná un archivo de imagen'; input.value = ''; return; }
    this.fotoNombre = archivo.name;
    const lector = new FileReader(); lector.onload = () => this.fotoPreview = String(lector.result); lector.readAsDataURL(archivo);
  }
  esBinaria(): boolean { return String(this.seleccionada?.unidad_avance || '').toUpperCase().includes('BIN'); }
  esCantidad(): boolean { return String(this.seleccionada?.unidad_avance || '').toUpperCase().includes('CANT'); }
  claseEstado(op: any): string { return `estado-${String(op.estado_codigo || '').toLowerCase().replace('_', '-')}`; }
}
