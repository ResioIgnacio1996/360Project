import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EtapaProgramada,
  OperacionProgramada,
  ProgramacionService,
} from '../../core/services/programacion/programacion';
import { CalendarioService } from '../../core/services/calendario/calendario.service';

@Component({
  selector: 'app-programacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './programacion.html',
  styleUrl: './programacion.css',
})
export class Programacion implements OnInit, OnDestroy {
  @ViewChild('workspace') workspaceRef?: ElementRef<HTMLElement>;
  proyecto: any = null;
  operaciones: OperacionProgramada[] = [];
  etapasProgramadas: EtapaProgramada[] = [];
  seleccionada: OperacionProgramada | null = null;
  calendario: any = null;
  excepcionesCalendario: any[] = [];
  cargando = true;
  error = '';
  busqueda = '';
  filtroEstado = 'TODAS';
  filtroEtapa = 'TODAS';
  capas = { estimado: true, reprogramado: true, real: true };
  modal: 'duracion' | 'nmt' | 'crear' | 'editar' | 'excepcion' | null = null;
  operacionEditada: any = { secuencia: null, nombre: '', duracion_hs: 0, descripcion: '', dependencias: [] };
  nuevaExcepcion: any = {
    fecha: '', tipo: 'FERIADO', hs_disponibles: 0, motivo: '', recuperable: false
  };
  alturaTablaPct = 47;
  nuevaOperacion: any = {
    etapa_id: null, secuencia: null, nombre: '', responsable_id: null, duracion_hs: 8,
    unidad_avance: 'PORCENTAJE', cantidad_meta: null, peso_pct: 0,
    dependencias: [], criterio_cierre: '', descripcion: ''
  };
  busquedaPredecesora = '';
  sugerenciasPredecesoras: OperacionProgramada[] = [];
  busquedaPredecesoraEdicion = '';
  sugerenciasPredecesorasEdicion: OperacionProgramada[] = [];
  private nombresOperacion = new Map<number, string>();
  private excepcionesPorFecha = new Map<string, any>();
  private rangoGantt = { inicio: Date.now(), dias: 14 };
  private diasGantt: number[] = Array.from({ length: 14 }, (_, i) => i);
  private fechasGantt: Date[] = [];
  private mesesCalculados: Array<{ clave: string; etiqueta: string; inicio: number; dias: number }> = [];
  private clasesDia: string[] = [];
  private detallesDia: string[] = [];
  nuevaDuracion = 0;
  fechaNmt = '';
  motivo = '';
  guardando = false;
  errorFormulario = '';
  mensaje = '';
  hoyISO = '';
  descripcionHoy = '';
  private actualizadorFecha?: ReturnType<typeof setInterval>;
  private redimensionando = false;
  private readonly moverPanel = (evento: PointerEvent) => this.redimensionarPanel(evento);
  private readonly soltarPanel = () => this.finalizarRedimension();
  readonly proyectoId: number;
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: ProgramacionService,
    private calendarioService: CalendarioService,
  ) {
    this.proyectoId = Number(this.route.snapshot.paramMap.get('id'));
  }
  ngOnInit(): void {
    this.cargar();
    this.cargarFechaOficial();
    this.actualizadorFecha = setInterval(() => this.cargarFechaOficial(), 60000);
  }
  ngOnDestroy(): void {
    if (this.actualizadorFecha) clearInterval(this.actualizadorFecha);
    this.finalizarRedimension();
  }
  cargarFechaOficial(): void {
    this.calendarioService.obtenerFechaServidor().subscribe({
      next: respuesta => {
        this.hoyISO = respuesta.fecha;
        this.descripcionHoy = this.calendarioService.obtenerDescripcionFechaActual();
      },
      error: () => {
        const ahora = new Date();
        this.hoyISO = this.calendarioService.formatearFechaISO(ahora);
        this.descripcionHoy = this.calendarioService.obtenerDescripcionFechaActual();
      }
    });
  }
  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.service.obtener(this.proyectoId).subscribe({
      next: (d) => {
        this.proyecto = d.proyecto;
        this.operaciones = d.operaciones || [];
        this.etapasProgramadas = d.etapas || [];
        this.calendario = d.calendario || null;
        this.excepcionesCalendario = d.excepciones_calendario || [];
        this.precalcularVista();
        if (this.seleccionada)
          this.seleccionada =
            this.operaciones.find((o) => o.operacion_id === this.seleccionada?.operacion_id) ||
            null;
        this.cargando = false;
      },
      error: (e) => {
        this.error = e?.error?.message || 'No se pudo cargar la programación';
        this.cargando = false;
      },
    });
  }
  get etapas(): string[] {
    return [...new Set(this.operaciones.map((o) => o.etapa_nombre))];
  }
  get responsables(): Array<{ id: number; nombre: string }> {
    const mapa = new Map<number, string>();
    for (const op of this.operaciones)
      if (op.responsable_id && op.responsable_nombre) mapa.set(op.responsable_id, op.responsable_nombre);
    return [...mapa].map(([id, nombre]) => ({ id, nombre }));
  }
  actualizarSugerenciasPredecesoras(): void {
    const q = this.busquedaPredecesora.trim().toLowerCase();
    const seleccionadas = new Set<number>(this.nuevaOperacion.dependencias || []);
    this.sugerenciasPredecesoras = this.operaciones
      .filter(op => !op.archivada && !seleccionadas.has(Number(op.secuencia)))
      .filter(op => !q || `${op.secuencia} ${op.nombre}`.toLowerCase().includes(q))
      .sort((a, b) => Number(a.secuencia) - Number(b.secuencia));
  }
  nombrePredecesora(secuencia: number): string {
    return this.nombresOperacion.get(Number(secuencia)) || '';
  }
  agregarPredecesora(op: OperacionProgramada): void {
    const actuales = new Set<number>(this.nuevaOperacion.dependencias || []);
    actuales.add(Number(op.secuencia));
    this.nuevaOperacion.dependencias = [...actuales];
    this.busquedaPredecesora = '';
    this.actualizarSugerenciasPredecesoras();
  }
  quitarPredecesora(secuencia: number): void {
    this.nuevaOperacion.dependencias =
      (this.nuevaOperacion.dependencias || []).filter((valor: number) => Number(valor) !== Number(secuencia));
    this.actualizarSugerenciasPredecesoras();
  }
  actualizarSugerenciasEdicion(): void {
    const q = this.busquedaPredecesoraEdicion.trim().toLowerCase();
    const seleccionadas = new Set<number>(this.operacionEditada.dependencias || []);
    const propia = Number(this.seleccionada?.secuencia);
    const sucesoras = new Set<number>();
    let cambio = true;
    while (cambio) {
      cambio = false;
      for (const op of this.operaciones) {
        const deps = String(op.dependencias_secuencia || '').split(',').map(Number).filter(Number.isInteger);
        if (!sucesoras.has(Number(op.secuencia)) && deps.some(dep => dep === propia || sucesoras.has(dep))) {
          sucesoras.add(Number(op.secuencia));
          cambio = true;
        }
      }
    }
    this.sugerenciasPredecesorasEdicion = this.operaciones
      .filter(op => !op.archivada && Number(op.secuencia) !== propia &&
        !sucesoras.has(Number(op.secuencia)) && !seleccionadas.has(Number(op.secuencia)))
      .filter(op => !q || `${op.secuencia} ${op.nombre}`.toLowerCase().includes(q))
      .sort((a, b) => Number(a.secuencia) - Number(b.secuencia));
  }
  agregarPredecesoraEdicion(op: OperacionProgramada): void {
    this.operacionEditada.dependencias = [
      ...new Set<number>([...(this.operacionEditada.dependencias || []), Number(op.secuencia)])
    ];
    this.busquedaPredecesoraEdicion = '';
    this.actualizarSugerenciasEdicion();
  }
  quitarPredecesoraEdicion(secuencia: number): void {
    this.operacionEditada.dependencias =
      (this.operacionEditada.dependencias || []).filter((valor: number) => Number(valor) !== Number(secuencia));
    this.actualizarSugerenciasEdicion();
  }
  get filtradas(): OperacionProgramada[] {
    const q = this.busqueda.toLowerCase().trim();
    return this.operaciones.filter(
      (o) =>
        (this.filtroEstado === 'TODAS' || o.estado_codigo === this.filtroEstado) &&
        (this.filtroEtapa === 'TODAS' || o.etapa_nombre === this.filtroEtapa) &&
        (!q ||
          `${o.secuencia} ${o.nombre} ${o.etapa_nombre} ${o.responsable_nombre || ''}`
            .toLowerCase()
            .includes(q)),
    );
  }
  get progreso(): number {
    return Math.round(
      this.etapasProgramadas.reduce((total, etapa) => total + Number(etapa.aporte_proyecto || 0), 0),
    );
  }
  get atrasadas(): number {
    return this.operaciones.filter((o) => o.estado_codigo === 'ATRASADA').length;
  }
  get rango(): { inicio: number; dias: number } {
    return this.rangoGantt;
  }
  private precalcularVista(): void {
    this.nombresOperacion = new Map(this.operaciones.map(op => [Number(op.secuencia), op.nombre]));
    this.excepcionesPorFecha = new Map(
      this.excepcionesCalendario.map(item => [String(item.fecha).slice(0, 10), item]),
    );
    const fs = this.operaciones
      .flatMap((o) => [
        o.fecha_inicio_estimada,
        o.fecha_fin_estimada,
        o.fecha_inicio_reprog,
        o.fecha_fin_reprog,
      ])
      .filter(Boolean) as string[];
    const inicio = fs.length ? Math.min(...fs.map(Date.parse)) : Date.now();
    const fin = fs.length ? Math.max(...fs.map(Date.parse)) : inicio + 13 * 86400000;
    this.rangoGantt = { inicio, dias: Math.max(14, Math.ceil((fin - inicio) / 86400000) + 1) };
    this.diasGantt = Array.from({ length: this.rangoGantt.dias }, (_, i) => i);
    this.fechasGantt = this.diasGantt.map(i => new Date(this.rangoGantt.inicio + i * 86400000 + 12 * 3600000));
    this.mesesCalculados = [];
    for (const dia of this.diasGantt) {
      const fecha = this.fechasGantt[dia];
      const clave = `${fecha.getUTCFullYear()}-${fecha.getUTCMonth()}`;
      const actual = this.mesesCalculados.at(-1);
      if (actual?.clave === clave) actual.dias++;
      else this.mesesCalculados.push({
        clave,
        etiqueta: `${String(fecha.getUTCMonth() + 1).padStart(2, '0')}/${fecha.getUTCFullYear()}`,
        inicio: dia,
        dias: 1,
      });
    }
    this.clasesDia = this.diasGantt.map(i => this.calcularClaseDia(i));
    this.detallesDia = this.diasGantt.map(i => this.calcularDetalleDia(i));
  }
  get anchoGanttPx(): number {
    return 210 + this.rango.dias * 54;
  }
  get anchoTimelinePx(): number {
    return this.rango.dias * 54;
  }
  dias(): number[] {
    return this.diasGantt;
  }
  fechaDia(i: number): Date {
    return this.fechasGantt[i];
  }
  nombreDiaCorto(i: number): string {
    return this.calendarioService.obtenerNombreDiaCorto(this.fechaDia(i));
  }
  esHoy(i: number): boolean {
    return this.fechaDia(i).toISOString().slice(0, 10) === this.hoyISO;
  }
  mesesGantt(): Array<{ clave: string; etiqueta: string; inicio: number; dias: number }> {
    return this.mesesCalculados;
  }
  tipoDia(i: number): number {
    const fecha = this.fechaDia(i);
    const nombres = [
      'tipo_domingo',
      'tipo_lunes',
      'tipo_martes',
      'tipo_miercoles',
      'tipo_jueves',
      'tipo_viernes',
      'tipo_sabado',
    ];
    const excepcion = this.excepcionDia(i);
    if (excepcion) {
      const horas = Number(excepcion.hs_disponibles || 0);
      const estandar = Number(this.calendario?.hs_jornada_estandar || 9);
      return horas <= 0 ? 0 : horas < estandar ? 2 : 1;
    }
    return Number(
      this.calendario?.[nombres[fecha.getUTCDay()]] ??
        ([0, 6].includes(fecha.getUTCDay()) ? 0 : 1),
    );
  }
  claseDia(i: number): string {
    return this.clasesDia[i] || '';
  }
  private calcularClaseDia(i: number): string {
    const base = this.tipoDia(i) === 0 ? 'no-laborable' : this.tipoDia(i) === 2 ? 'parcial' : 'completa';
    const excepcion = this.excepcionDia(i);
    return excepcion ? `${base} excepcion excepcion-${String(excepcion.tipo).toLowerCase()}` : base;
  }
  excepcionDia(i: number): any | null {
    const iso = this.fechaDia(i).toISOString().slice(0, 10);
    return this.excepcionesPorFecha.get(iso) || null;
  }
  detalleDia(i: number): string {
    return this.detallesDia[i] || '';
  }
  private calcularDetalleDia(i: number): string {
    const excepcion = this.excepcionDia(i);
    if (!excepcion) {
      const tipo = this.tipoDia(i);
      return tipo === 0 ? 'Día no laborable' : tipo === 2 ? 'Jornada parcial' : 'Jornada completa';
    }
    return `${String(excepcion.tipo).replaceAll('_', ' ')} · ${excepcion.hs_disponibles} hs${excepcion.motivo ? ` · ${excepcion.motivo}` : ''}`;
  }
  posicion(f?: string): number {
    return f
      ? Math.max(0, ((Date.parse(f) - this.rango.inicio) / 86400000 / this.rango.dias) * 100)
      : 0;
  }
  ancho(i?: string, f?: string): number {
    return i && f
      ? Math.max(1.2, (((Date.parse(f) - Date.parse(i)) / 86400000 + 1) / this.rango.dias) * 100)
      : 0;
  }
  esFinSemana(i: number): boolean {
    return [0, 6].includes(this.fechaDia(i).getUTCDay());
  }
  claseEstado(o: OperacionProgramada): string {
    return `estado-${o.estado_codigo.toLowerCase()}`;
  }
  seleccionar(o: OperacionProgramada): void {
    this.seleccionada = o;
  }
  volver(): void {
    this.router.navigate(['/proyectos']);
  }
  importarBop(): void {
    this.router.navigate(['/proyectos', this.proyectoId, 'programacion', 'importar']);
  }
  abrirCrearOperacion(): void {
    const ultima = Math.max(0, ...this.operaciones.map(op => Number(op.secuencia)));
    this.nuevaOperacion = {
      etapa_id: this.etapasProgramadas[0]?.etapa_id || null,
      secuencia: ultima + 100,
      nombre: '', responsable_id: null, duracion_hs: 8, unidad_avance: 'PORCENTAJE',
      cantidad_meta: null, peso_pct: 0,
      dependencias: [], criterio_cierre: '', descripcion: ''
    };
    this.busquedaPredecesora = '';
    this.actualizarSugerenciasPredecesoras();
    this.modal = 'crear';
  }
  abrirExcepcion(): void {
    this.nuevaExcepcion = {
      fecha: this.hoyISO, tipo: 'FERIADO', hs_disponibles: 0, motivo: '', recuperable: false
    };
    this.modal = 'excepcion';
  }
  guardarExcepcion(): void {
    const ex = this.nuevaExcepcion;
    if (!ex.fecha || !ex.tipo || !ex.motivo.trim() ||
        (ex.tipo !== 'FERIADO' && !(Number(ex.hs_disponibles) >= 0))) return;
    this.guardando = true;
    this.service.guardarExcepcion(this.proyectoId, ex).subscribe({
      next: r => this.finalizar(r.message),
      error: e => {
        this.guardando = false;
        this.error = e?.error?.message || 'No se pudo guardar la excepción';
      }
    });
  }
  get excepcionesOrdenadas(): any[] {
    return [...this.excepcionesCalendario].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }
  eliminarExcepcion(excepcion: any): void {
    if (this.guardando || !excepcion?.excepcion_id) return;
    const fecha = String(excepcion.fecha).slice(0, 10);
    if (!window.confirm(`¿Quitar la excepción del ${fecha}?`)) return;
    this.guardando = true;
    this.service.eliminarExcepcion(this.proyectoId, Number(excepcion.excepcion_id)).subscribe({
      next: r => this.finalizar(r.message),
      error: e => {
        this.guardando = false;
        this.error = e?.error?.message || 'No se pudo eliminar la excepción';
      }
    });
  }
  trackOperacion(_: number, op: OperacionProgramada): number { return op.operacion_id; }
  trackEtapa(_: number, etapa: EtapaProgramada): number { return etapa.etapa_id; }
  trackDia(_: number, dia: number): number { return dia; }
  trackMes(_: number, mes: { clave: string }): string { return mes.clave; }
  trackSecuencia(_: number, op: OperacionProgramada): number { return Number(op.secuencia); }
  trackNumero(_: number, valor: number): number { return Number(valor); }
  iniciarRedimension(evento: PointerEvent): void {
    evento.preventDefault();
    this.redimensionando = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', this.moverPanel);
    window.addEventListener('pointerup', this.soltarPanel, { once: true });
  }
  private redimensionarPanel(evento: PointerEvent): void {
    if (!this.redimensionando || !this.workspaceRef) return;
    const rect = this.workspaceRef.nativeElement.getBoundingClientRect();
    const porcentaje = ((evento.clientY - rect.top) / rect.height) * 100;
    this.alturaTablaPct = Math.max(22, Math.min(72, Math.round(porcentaje)));
  }
  private finalizarRedimension(): void {
    if (!this.redimensionando) return;
    this.redimensionando = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', this.moverPanel);
    window.removeEventListener('pointerup', this.soltarPanel);
  }
  abrirEditarOperacion(): void {
    if (!this.seleccionada || Number(this.seleccionada.pct_avance_actual) !== 0) return;
    this.operacionEditada = {
      secuencia: this.seleccionada.secuencia,
      nombre: this.seleccionada.nombre,
      duracion_hs: Number(this.seleccionada.duracion_hs),
      descripcion: this.seleccionada.descripcion || '',
      dependencias: String(this.seleccionada.dependencias_secuencia || '')
        .split(',').map(Number).filter(Number.isInteger)
    };
    this.busquedaPredecesoraEdicion = '';
    this.errorFormulario = '';
    this.actualizarSugerenciasEdicion();
    this.modal = 'editar';
  }
  guardarOperacionEditada(): void {
    if (!this.seleccionada || Number(this.seleccionada.pct_avance_actual) !== 0) return;
    const datos = this.operacionEditada;
    if (!datos.secuencia || !datos.nombre.trim() || !(datos.duracion_hs > 0)) return;
    this.errorFormulario = '';
    this.guardando = true;
    this.service.actualizarOperacion(this.seleccionada.operacion_id, datos).subscribe({
      next: r => this.finalizar(r.message),
      error: e => {
        this.guardando = false;
        this.errorFormulario = e?.error?.message || 'No se pudo actualizar la operación';
      }
    });
  }
  guardarNuevaOperacion(): void {
    const n = this.nuevaOperacion;
    if (!n.etapa_id || !n.secuencia || !n.nombre.trim() || !(n.duracion_hs > 0) || !n.dependencias.length) return;
    this.guardando = true;
    this.service.crearOperacion(this.proyectoId, n).subscribe({
      next: r => this.finalizar(r.message),
      error: e => {
        this.guardando = false;
        this.error = e?.error?.message || 'No se pudo crear la operación';
      }
    });
  }
  toggle(c: keyof typeof this.capas): void {
    this.capas[c] = !this.capas[c];
  }
  abrirDuracion(): void {
    if (!this.seleccionada) return;
    this.nuevaDuracion = Number(this.seleccionada.duracion_hs);
    this.motivo = '';
    this.modal = 'duracion';
  }
  abrirNmt(): void {
    if (!this.seleccionada) return;
    this.fechaNmt = this.seleccionada.fecha_no_antes_del || '';
    this.motivo = '';
    this.modal = 'nmt';
  }
  guardarDuracion(): void {
    if (!this.seleccionada || !(this.nuevaDuracion > 0) || !this.motivo.trim()) return;
    this.guardando = true;
    this.service
      .actualizarDuracion(this.seleccionada.operacion_id, {
        duracion_hs: this.nuevaDuracion,
        motivo: this.motivo,
      })
      .subscribe({
        next: (r) => this.finalizar(r.message),
        error: (e) => {
          this.guardando = false;
          this.error = e?.error?.message || 'No se pudo guardar';
        },
      });
  }
  guardarNmt(quitar = false): void {
    if (!this.seleccionada || (!quitar && !this.fechaNmt) || !this.motivo.trim()) return;
    this.guardando = true;
    this.service
      .actualizarNmt(this.seleccionada.operacion_id, {
        fecha_no_antes_del: quitar ? null : this.fechaNmt,
        motivo: this.motivo,
      })
      .subscribe({
        next: (r) => this.finalizar(r.message),
        error: (e) => {
          this.guardando = false;
          this.error = e?.error?.message || 'No se pudo guardar';
        },
      });
  }
  finalizar(t: string): void {
    this.guardando = false;
    this.modal = null;
    this.mensaje = t;
    this.cargar();
    setTimeout(() => (this.mensaje = ''), 3500);
  }
}
