import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
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
  modal: 'duracion' | 'nmt' | 'crear' | 'editar' | null = null;
  operacionEditada: any = { secuencia: null, nombre: '', duracion_hs: 0, descripcion: '' };
  nuevaOperacion: any = {
    etapa_id: null, secuencia: null, nombre: '', responsable_id: null, duracion_hs: 8,
    unidad_avance: 'PORCENTAJE', cantidad_meta: null, peso_pct: 0,
    dependencias: [], criterio_cierre: '', descripcion: ''
  };
  busquedaPredecesora = '';
  nuevaDuracion = 0;
  fechaNmt = '';
  motivo = '';
  guardando = false;
  mensaje = '';
  hoyISO = '';
  descripcionHoy = '';
  private actualizadorFecha?: ReturnType<typeof setInterval>;
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
  get sugerenciasPredecesoras(): OperacionProgramada[] {
    const q = this.busquedaPredecesora.trim().toLowerCase();
    const seleccionadas = new Set<number>(this.nuevaOperacion.dependencias || []);
    return this.operaciones
      .filter(op => !op.archivada && !seleccionadas.has(Number(op.secuencia)))
      .filter(op => !q || `${op.secuencia} ${op.nombre}`.toLowerCase().includes(q))
      .sort((a, b) => Number(a.secuencia) - Number(b.secuencia));
  }
  nombrePredecesora(secuencia: number): string {
    return this.operaciones.find(op => Number(op.secuencia) === Number(secuencia))?.nombre || '';
  }
  agregarPredecesora(op: OperacionProgramada): void {
    const actuales = new Set<number>(this.nuevaOperacion.dependencias || []);
    actuales.add(Number(op.secuencia));
    this.nuevaOperacion.dependencias = [...actuales];
    this.busquedaPredecesora = '';
  }
  quitarPredecesora(secuencia: number): void {
    this.nuevaOperacion.dependencias =
      (this.nuevaOperacion.dependencias || []).filter((valor: number) => Number(valor) !== Number(secuencia));
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
    return { inicio, dias: Math.max(14, Math.ceil((fin - inicio) / 86400000) + 1) };
  }
  get anchoGanttPx(): number {
    return 210 + this.rango.dias * 54;
  }
  get anchoTimelinePx(): number {
    return this.rango.dias * 54;
  }
  dias(): number[] {
    return Array.from({ length: this.rango.dias }, (_, i) => i);
  }
  fechaDia(i: number): Date {
    return new Date(this.rango.inicio + i * 86400000 + 12 * 3600000);
  }
  nombreDiaCorto(i: number): string {
    return this.calendarioService.obtenerNombreDiaCorto(this.fechaDia(i));
  }
  esHoy(i: number): boolean {
    return this.fechaDia(i).toISOString().slice(0, 10) === this.hoyISO;
  }
  mesesGantt(): Array<{ clave: string; etiqueta: string; inicio: number; dias: number }> {
    const grupos: Array<{ clave: string; etiqueta: string; inicio: number; dias: number }> = [];
    for (const dia of this.dias()) {
      const fecha = this.fechaDia(dia);
      const clave = `${fecha.getUTCFullYear()}-${fecha.getUTCMonth()}`;
      const actual = grupos.at(-1);
      if (actual?.clave === clave) actual.dias++;
      else
        grupos.push({
          clave,
          etiqueta: `${String(fecha.getUTCMonth() + 1).padStart(2, '0')}/${fecha.getUTCFullYear()}`,
          inicio: dia,
          dias: 1,
        });
    }
    return grupos;
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
    const base = this.tipoDia(i) === 0 ? 'no-laborable' : this.tipoDia(i) === 2 ? 'parcial' : 'completa';
    const excepcion = this.excepcionDia(i);
    return excepcion ? `${base} excepcion excepcion-${String(excepcion.tipo).toLowerCase()}` : base;
  }
  excepcionDia(i: number): any | null {
    const iso = this.fechaDia(i).toISOString().slice(0, 10);
    return this.excepcionesCalendario.find(item => String(item.fecha).slice(0, 10) === iso) || null;
  }
  detalleDia(i: number): string {
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
    this.modal = 'crear';
  }
  abrirEditarOperacion(): void {
    if (!this.seleccionada || Number(this.seleccionada.pct_avance_actual) !== 0) return;
    this.operacionEditada = {
      secuencia: this.seleccionada.secuencia,
      nombre: this.seleccionada.nombre,
      duracion_hs: Number(this.seleccionada.duracion_hs),
      descripcion: this.seleccionada.descripcion || ''
    };
    this.modal = 'editar';
  }
  guardarOperacionEditada(): void {
    if (!this.seleccionada || Number(this.seleccionada.pct_avance_actual) !== 0) return;
    const datos = this.operacionEditada;
    if (!datos.secuencia || !datos.nombre.trim() || !(datos.duracion_hs > 0)) return;
    this.guardando = true;
    this.service.actualizarOperacion(this.seleccionada.operacion_id, datos).subscribe({
      next: r => this.finalizar(r.message),
      error: e => {
        this.guardando = false;
        this.error = e?.error?.message || 'No se pudo actualizar la operación';
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
