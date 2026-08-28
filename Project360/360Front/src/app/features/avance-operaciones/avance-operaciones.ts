import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AvanceOperacionesService } from '../../core/services/avance-operaciones/avance-operaciones';
import { Auth } from '../../core/services/auth/auth';

const hoyLocalISO = (): string => {
  const fecha = new Date();
  const parte = (valor: number) => String(valor).padStart(2, '0');
  return `${fecha.getFullYear()}-${parte(fecha.getMonth() + 1)}-${parte(fecha.getDate())}`;
};

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
  cargandoDetalle = false;
  errorConsumo = '';
  busqueda = ''; estado = 'TODAS'; etapa = 'TODAS'; orden = 'secuencia'; direccion: 'asc' | 'desc' = 'asc';
  readonly fechaMaxima = hoyLocalISO();
  porcentaje = 0; cantidadHoy: number | null = null; nota = ''; fecha = this.fechaMaxima;
  consumosHoy: Record<number, number | null> = {}; fotoNombre = ''; fotoPreview = '';
  gestionFecha: 'iniciar' | 'editar-inicio' | 'finalizar' | 'editar-fin' | null = null;
  fechaGestion = ''; motivoGestion = ''; errorGestionFecha = '';
  confirmacionConsumo = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: AvanceOperacionesService,
    private auth: Auth
  ) {
    this.proyectoId = Number(this.route.snapshot.paramMap.get('id'));
  }
  ngOnInit(): void { this.cargar(); }
  cargar(mantener = true): void {
    const seleccionadaId = mantener ? this.seleccionada?.operacion_id : null;
    this.cargando = true; this.error = '';
    this.service.obtener(this.proyectoId).subscribe({
      next: d => {
        this.proyecto = d.proyecto; this.operaciones = d.operaciones || [];
        this.seleccionada = this.operaciones.find(o => o.operacion_id === seleccionadaId) || null;
        if (this.seleccionada) this.cargarDetalle(this.seleccionada.operacion_id);
        this.cargando = false;
      },
      error: e => { this.error = e?.error?.message || 'No se pudieron cargar las operaciones'; this.cargando = false; }
    });
  }
  get etapas(): string[] { return [...new Set(this.operaciones.map(o => o.etapa_nombre))]; }
  get estados(): string[] { return [...new Set(this.operaciones.map(o => o.estado_codigo))]; }
  get enCurso(): number { return this.operaciones.filter(o => o.estado_codigo === 'EN_CURSO').length; }
  get finalizadas(): number { return this.operaciones.filter(o => ['FINALIZADA', 'COMPLETADA', 'COMPLETA'].includes(o.estado_codigo)).length; }
  get puedeCorregirFechas(): boolean {
    return ['ADMIN', 'SUPERVISOR', 'OPERARIO', 'DEMO']
      .includes(String(this.auth.getUsuarioActual()?.rol_nombre || '').toUpperCase());
  }
  get avanceHabilitado(): boolean { return !!this.seleccionada?.fecha_inicio_real && !this.seleccionada?.fecha_fin_real; }
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
  get consumosPendientes(): any[] {
    return this.materialesSeleccionados
      .map(m => {
        const cantidad = Number(this.consumosHoy[m.bom_id] || 0);
        const acumulado = Number(m.cantidad_consumida || 0);
        const teorico = Number(m.cantidad_teorica || 0);
        const stock = Number(m.stock_disponible || 0);
        return { ...m, cantidad, stockRestante: stock - cantidad, acumuladoProyectado: acumulado + cantidad, sobreconsumo: teorico > 0 && acumulado + cantidad > teorico, stockInsuficiente: cantidad > stock };
      })
      .filter(m => m.cantidad > 0);
  }
  get consumoConAlertas(): boolean { return this.consumosPendientes.some(m => m.sobreconsumo || m.stockInsuficiente); }
  get consumoConStockInsuficiente(): boolean { return this.consumosPendientes.some(m => m.stockInsuficiente); }
  seleccionar(op: any): void {
    this.seleccionada = op; this.prepararFormulario();
    this.avances = []; this.bom = []; this.consumos = [];
    this.cargarDetalle(op.operacion_id);
  }
  private cargarDetalle(operacionId: number): void {
    this.cargandoDetalle = true;
    this.service.obtenerDetalle(operacionId).subscribe({
      next: detalle => {
        if (this.seleccionada?.operacion_id !== operacionId) return;
        const actualizada = detalle.operacion?.operacion;
        if (actualizada) this.actualizarOperacion(actualizada);
        this.bom = detalle.bom?.bom || [];
        this.avances = detalle.avances?.avances || [];
        this.consumos = detalle.consumos?.consumos || [];
        this.cargandoDetalle = false;
      },
      error: e => {
        if (this.seleccionada?.operacion_id === operacionId) {
          this.error = this.mensajeError(e, 'No se pudo cargar el detalle de la operación');
          this.cargandoDetalle = false;
        }
      }
    });
  }
  private actualizarOperacion(operacion: any): void {
    const indice = this.operaciones.findIndex(o => o.operacion_id === operacion.operacion_id);
    const fusionada = indice >= 0 ? { ...this.operaciones[indice], ...operacion } : operacion;
    if (indice >= 0) this.operaciones = this.operaciones.map((o, i) => i === indice ? fusionada : o);
    this.seleccionada = fusionada;
    this.porcentaje = Number(fusionada.pct_avance_actual || 0);
  }
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
    this.seleccionada = op; this.prepararFormulario(); this.abrirGestionFecha('iniciar');
  }
  prepararFormulario(): void {
    this.porcentaje = Number(this.seleccionada?.pct_avance_actual || 0); this.cantidadHoy = null; this.nota = '';
    this.consumosHoy = {}; this.fotoNombre = ''; this.fotoPreview = '';
  }
  actualizarPorcentaje(value: number | string): void {
    const avanceActual = Number(this.seleccionada?.pct_avance_actual || 0);
    const nuevoValor = Number(value);

    if (!Number.isFinite(nuevoValor)) {
      this.porcentaje = avanceActual;
      return;
    }

    this.porcentaje = Math.max(avanceActual, Math.min(100, Math.round(nuevoValor)));
  }
  volver(): void { this.router.navigate(['/proyectos', this.proyectoId]); }
  importarPlan(): void { this.router.navigate(['/proyectos', this.proyectoId, 'programacion', 'importar']); }
  verProgramacion(): void { this.router.navigate(['/proyectos', this.proyectoId, 'programacion']); }
  cerrarDetalle(): void { this.seleccionada = null; }
  iniciar(): void {
    if (!this.seleccionada || this.seleccionada.fecha_inicio_real) return;
    this.abrirGestionFecha('iniciar');
  }
  abrirGestionFecha(tipo: 'iniciar' | 'editar-inicio' | 'finalizar' | 'editar-fin'): void {
    if (!this.seleccionada) return;
    this.gestionFecha = tipo;
    this.motivoGestion = '';
    this.errorGestionFecha = '';
    this.fechaGestion = tipo.includes('inicio')
      ? (this.seleccionada.fecha_inicio_real || this.fecha)
      : (this.seleccionada.fecha_fin_real || this.fecha);
  }
  cerrarGestionFecha(): void { this.gestionFecha = null; this.errorGestionFecha = ''; }
  confirmarGestionFecha(): void {
    if (!this.seleccionada || !this.gestionFecha || !this.fechaGestion) return;
    const id = this.seleccionada.operacion_id;
    let peticion;
    if (this.gestionFecha === 'iniciar') peticion = this.service.iniciar(id, this.fechaGestion);
    else if (this.gestionFecha === 'finalizar') peticion = this.service.finalizar(id, this.fechaGestion);
    else if (this.gestionFecha === 'editar-inicio') {
      if (!this.motivoGestion.trim()) return;
      peticion = this.service.modificarInicio(id, { fecha_inicio_real: this.fechaGestion, motivo: this.motivoGestion });
    } else {
      if (!this.motivoGestion.trim()) return;
      peticion = this.service.modificarFin(id, { fecha_fin_real: this.fechaGestion, motivo: this.motivoGestion });
    }
    this.guardando = true;
    this.errorGestionFecha = '';
    peticion.subscribe({
      next: (r: any) => {
        this.guardando = false;
        this.gestionFecha = null;
        this.mensaje = r.message;
        this.cargarDetalle(id);
        setTimeout(() => this.mensaje = '', 3500);
      },
      error: (e: any) => {
        this.guardando = false;
        this.errorGestionFecha = this.mensajeError(e, 'No se pudo guardar la fecha de la operación');
      }
    });
  }
  guardarAvance(): void {
    if (!this.seleccionada) return;
    if (!this.seleccionada.fecha_inicio_real) {
      this.error = 'Primero iniciá la operación indicando su fecha real de inicio';
      return;
    }
    if (this.seleccionada.fecha_fin_real) {
      this.error = 'La operación ya está finalizada. Podés corregir sus fechas desde el panel de instrucciones';
      return;
    }
    this.actualizarPorcentaje(this.porcentaje);
    if (this.porcentaje === 100) {
      this.fechaGestion = this.fecha;
      this.motivoGestion = '';
      this.gestionFecha = 'finalizar';
      return;
    }
    this.ejecutar(this.service.registrarAvance(this.seleccionada.operacion_id, {
      porcentaje: this.porcentaje, cantidad_hoy: this.cantidadHoy, fecha_registro: this.fecha, nota: this.nota
    }));
  }
  guardarConsumos(): void {
    if (!this.seleccionada) return;
    this.errorConsumo = '';
    if (!this.consumosPendientes.length) {
      this.errorConsumo = 'Informá al menos un consumo mayor a cero';
      return;
    }
    if (this.consumoConStockInsuficiente) {
      this.errorConsumo = 'No se puede confirmar: uno o más materiales superan el stock disponible del proyecto';
      return;
    }
    this.confirmacionConsumo = true;
  }
  cerrarConfirmacionConsumo(): void {
    if (this.guardando) return;
    this.confirmacionConsumo = false;
    this.errorConsumo = '';
  }
  confirmarConsumos(): void {
    if (!this.seleccionada || !this.consumosPendientes.length || this.guardando) return;
    const consumos = this.consumosPendientes.map(m => ({ bom_id: m.bom_id, cantidad: m.cantidad }));
    this.guardando = true;
    this.errorConsumo = '';
    this.service.registrarConsumos(this.seleccionada.operacion_id, {
      fecha_consumo: this.fecha,
      consumos
    }).subscribe({
      next: (respuesta: any) => {
        this.guardando = false;
        this.confirmacionConsumo = false;
        this.mensaje = respuesta?.message || 'Consumo guardado correctamente';
        this.prepararFormulario();
        this.cargarDetalle(this.seleccionada!.operacion_id);
        setTimeout(() => this.mensaje = '', 3500);
      },
      error: (error: any) => {
        this.guardando = false;
        this.errorConsumo = error?.error?.message || error?.error?.error || 'No se pudo guardar el consumo';
      }
    });
  }
  porcentajeConsumo(m: any): number {
    const teorico = Number(m.cantidad_teorica || 0);
    return teorico > 0 ? (Number(m.cantidad_consumida || 0) / teorico) * 100 : 0;
  }
  esSobreconsumo(m: any): boolean { return Number(m.cantidad_teorica || 0) > 0 && Number(m.cantidad_consumida || 0) > Number(m.cantidad_teorica); }
  esConsumoHistoricoExcedido(c: any): boolean { return Number(c.cantidad_teorica || 0) > 0 && Number(c.consumo_acumulado || 0) > Number(c.cantidad_teorica); }
  formatearFechaCalendario(valor: unknown): string {
    const coincidencia = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return coincidencia ? `${coincidencia[3]}/${coincidencia[2]}/${coincidencia[1]}` : '';
  }
  anularConsumo(consumo: any): void {
    if (consumo.anulado || this.guardando) return;
    const motivo = prompt(`Motivo de anulación del consumo de ${consumo.material_nombre}:`)?.trim();
    if (!motivo) return;
    this.ejecutar(this.service.anularConsumo(consumo.consumo_id, motivo));
  }
  ejecutar(peticion: any): void {
    this.guardando = true; this.error = '';
    peticion.subscribe({
      next: (r: any) => {
        this.guardando = false; this.mensaje = r.message;
        if (this.seleccionada) this.cargarDetalle(this.seleccionada.operacion_id);
        setTimeout(() => this.mensaje = '', 3500);
      },
      error: (e: any) => { this.guardando = false; this.error = this.mensajeError(e, 'No se pudo guardar'); }
    });
  }
  private mensajeError(e: any, fallback: string): string {
    if (typeof e?.error?.message === 'string' && e.error.message.trim()) return e.error.message;
    if (typeof e?.error?.detail === 'string' && e.error.detail.trim()) return e.error.detail;
    if (typeof e?.error?.error === 'string' && e.error.error.trim()) return e.error.error;
    if (e?.status === 0 || e?.status === 530) return 'No se pudo conectar con el servidor. Verificá que el backend y el túnel estén activos';
    return fallback;
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
