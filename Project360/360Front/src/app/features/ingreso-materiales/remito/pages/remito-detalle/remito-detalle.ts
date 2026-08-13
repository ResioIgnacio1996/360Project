import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { catchError, finalize, forkJoin, of, timeout } from 'rxjs';

import { DetalleRemito, MaterialBomProyecto, Remito, Remitos } from '../../../../../core/services/remitos';
import { ProyectoService } from '../../../../../core/services/proyecto/proyecto';

interface DestinoLiberacion {
  proyectoId: number | null;
  cantidad: number;
}

interface MaterialLiberacion {
  idDetalle: number;
  idMaterial: number | null;
  material: string;
  unidad: string;
  cantidadTotal: number;
  destinos: DestinoLiberacion[];
}

interface ResumenLiberacionItem {
  material: string;
  proyecto: string;
  cantidad: number;
  unidad: string;
  operacionBom: string;
  coincideBom: boolean;
  clave: string;
  sugerencias: MaterialBomProyecto[];
  bomSeleccionadaId: number | null;
  proyectoId: number;
  busquedaManualVisible: boolean;
  busquedaBom: string;
  resultadosBusqueda: MaterialBomProyecto[];
}

@Component({
  selector: 'app-remito-detalle',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule
  ],
  templateUrl: './remito-detalle.html',
  styleUrl: './remito-detalle.css',
})
export class RemitoDetalle implements OnInit {
  remito: Remito | null = null;
  idRegistroCompra: number | null = null;
  displayedColumns = ['material', 'cantidad', 'unidad'];
  cargando = false;
  liberando = false;
  cargandoCoincidenciasBom = false;
  errorCoincidenciasBom = '';
  resumenLiberacionVisible = false;
  proyectos: any[] = [];
  materialesLiberacion: MaterialLiberacion[] = [];
  bomPorProyecto: Record<number, MaterialBomProyecto[]> = {};
  resumenAsignaciones: ResumenLiberacionItem[] = [];

  get detalleRemito(): DetalleRemito[] {
    return (this.remito?.detalle ?? []).filter(item =>
      !!item.material && Number(item.cantidad) > 0
    );
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private remitosService: Remitos,
    private proyectoService: ProyectoService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const remitoId = this.route.snapshot.paramMap.get('remitoId');
    const id = Number(remitoId || this.route.snapshot.paramMap.get('id'));
    const idRegistro = this.route.snapshot.paramMap.get('id');
    this.idRegistroCompra = remitoId && idRegistro ? Number(idRegistro) : null;

    if (id) {
      this.cargarRemito(id);
    }

    this.proyectoService.getProyectos().subscribe({
      next: response => {
        this.proyectos = (Array.isArray(response) ? response : [])
          .filter(proyecto => proyecto.activo !== false && proyecto.estado !== 'CANCELADO');
      },
      error: () => this.proyectos = []
    });
  }

  cargarRemito(id: number): void {
    this.cargando = true;

    this.remitosService.getRemitoById(id).subscribe({
      next: remito => {
        this.cargando = false;
        this.remito = remito;
        this.inicializarDistribucion(remito);
      },
      error: error => {
        this.cargando = false;
        this.snackBar.open(error?.error?.message || 'Error al obtener remito.', 'Cerrar', {
          duration: 3500
        });
      }
    });
  }

  previsualizarLiberacion(): void {
    if (!this.remito || this.remito.liberado || this.cargandoCoincidenciasBom) {
      return;
    }

    if (!this.distribucionValida()) {
      this.snackBar.open(
        'Distribuí completamente cada material entre proyectos, sin faltantes ni excesos.',
        'Cerrar',
        { duration: 4000 }
      );
      return;
    }

    const proyectosDestino = [...new Set(
      this.materialesLiberacion.flatMap(material =>
        material.destinos.filter(destino => Number(destino.cantidad) > 0).map(destino => Number(destino.proyectoId))
      )
    )];

    this.resumenAsignaciones = [];
    this.errorCoincidenciasBom = '';
    this.resumenLiberacionVisible = true;
    this.cargandoCoincidenciasBom = true;
    let huboError = false;
    forkJoin(proyectosDestino.map(proyectoId =>
      this.remitosService.getMaterialesBomProyecto(proyectoId).pipe(
        timeout(10000),
        catchError(() => {
          huboError = true;
          return of([] as MaterialBomProyecto[]);
        })
      )
    )).pipe(
      finalize(() => this.cargandoCoincidenciasBom = false)
    ).subscribe({
      next: respuestas => {
        this.bomPorProyecto = proyectosDestino.reduce((resultado, proyectoId, index) => {
          resultado[proyectoId] = respuestas[index] || [];
          return resultado;
        }, {} as Record<number, MaterialBomProyecto[]>);
        this.construirResumenAsignaciones();
        if (huboError) {
          this.errorCoincidenciasBom = 'No se pudieron cargar todas las sugerencias BOM. Podés volver y reintentar.';
        }
      },
      error: error => {
        this.errorCoincidenciasBom = error?.error?.message
          || 'No se pudo verificar la coincidencia con la BOM de los proyectos.';
      }
    });
  }

  cerrarResumenLiberacion(): void {
    if (this.liberando) {
      return;
    }
    this.resumenLiberacionVisible = false;
  }

  private construirResumenAsignaciones(): void {
    this.resumenAsignaciones = this.materialesLiberacion.flatMap(material =>
      material.destinos.filter(destino => Number(destino.cantidad) > 0).map(destino => {
        const clave = this.claveDestino(material, destino);
        const sugerencias = this.obtenerSugerenciasBom(material, destino.proyectoId);
        const coincidencia = sugerencias.find(linea => this.esCoincidenciaFuerte(material, linea));
        return {
          material: material.material,
          proyecto: this.nombreProyecto(destino.proyectoId),
          cantidad: Number(destino.cantidad),
          unidad: material.unidad,
          operacionBom: coincidencia
            ? `OP ${coincidencia.operacion_secuencia} · ${coincidencia.operacion_nombre}`
            : sugerencias.length ? 'Seleccioná una de las sugerencias' : 'No hay coincidencias aproximadas',
          coincideBom: !!coincidencia,
          clave,
          sugerencias,
          bomSeleccionadaId: coincidencia?.material_id ?? null,
          proyectoId: Number(destino.proyectoId),
          busquedaManualVisible: false,
          busquedaBom: '',
          resultadosBusqueda: []
        };
      })
    );
  }

  actualizarSeleccionBom(asignacion: ResumenLiberacionItem): void {
    const coincidencia = asignacion.sugerencias.find(linea =>
      Number(linea.material_id) === Number(asignacion.bomSeleccionadaId)
    );
    asignacion.coincideBom = !!coincidencia;
    asignacion.operacionBom = coincidencia
      ? `OP ${coincidencia.operacion_secuencia} · ${coincidencia.operacion_nombre}`
      : asignacion.sugerencias.length
        ? 'Seleccioná una de las sugerencias'
        : 'No hay coincidencias aproximadas';
  }

  alternarBusquedaBom(asignacion: ResumenLiberacionItem): void {
    asignacion.busquedaManualVisible = !asignacion.busquedaManualVisible;
    if (!asignacion.busquedaManualVisible) {
      asignacion.busquedaBom = '';
      asignacion.resultadosBusqueda = [];
    }
  }

  buscarBomManual(asignacion: ResumenLiberacionItem): void {
    const termino = this.normalizar(asignacion.busquedaBom);
    if (termino.length < 2) {
      asignacion.resultadosBusqueda = [];
      return;
    }

    const tokensBusqueda = this.tokens(termino);
    const vistos = new Set<string>();
    asignacion.resultadosBusqueda = (this.bomPorProyecto[asignacion.proyectoId] || [])
      .map(linea => {
        const nombre = this.normalizar(linea.material_bom || linea.descripcion_libre);
        const tokensNombre = this.tokens(nombre);
        const coincidencias = tokensBusqueda.filter(token =>
          nombre.includes(token) || tokensNombre.some(tokenNombre => tokenNombre.includes(token))
        ).length;
        const puntaje = nombre === termino
          ? 1000
          : nombre.includes(termino)
            ? 500
            : coincidencias * 100;
        return { linea, puntaje };
      })
      .filter(resultado => resultado.puntaje > 0)
      .sort((a, b) => b.puntaje - a.puntaje)
      .filter(resultado => {
        const clave = resultado.linea.material_id
          ? `MAT:${resultado.linea.material_id}`
          : `${this.normalizar(resultado.linea.material_bom)}:${this.normalizar(resultado.linea.uom_nombre)}`;
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      })
      .slice(0, 5)
      .map(resultado => resultado.linea);
  }

  seleccionarBomManual(
    asignacion: ResumenLiberacionItem,
    linea: MaterialBomProyecto
  ): void {
    if (!asignacion.sugerencias.some(sugerencia => Number(sugerencia.material_id) === Number(linea.material_id))) {
      asignacion.sugerencias = [...asignacion.sugerencias, linea];
    }
    asignacion.bomSeleccionadaId = linea.material_id;
    asignacion.busquedaBom = '';
    asignacion.resultadosBusqueda = [];
    asignacion.busquedaManualVisible = false;
    this.actualizarSeleccionBom(asignacion);
  }

  get resumenConFaltantesBom(): boolean {
    return this.resumenAsignaciones.some(asignacion => !asignacion.coincideBom);
  }

  liberar(): void {
    if (!this.remito || this.remito.liberado || !this.distribucionValida()) {
      return;
    }

    const asignaciones = this.materialesLiberacion.filter(material => this.cantidadAsignada(material) > 0).map(material => ({
      detalle_remito_id: material.idDetalle,
      destinos: material.destinos.filter(destino => Number(destino.cantidad) > 0).map(destino => ({
        proyecto_id: Number(destino.proyectoId),
        cantidad: Number(destino.cantidad),
        material_id: this.resumenAsignaciones.find(asignacion =>
          asignacion.clave === this.claveDestino(material, destino)
        )?.bomSeleccionadaId || 0
      }))
    }));

    this.liberando = true;

    this.remitosService.liberarRemito(this.remito.idRemito, asignaciones).subscribe({
      next: response => {
        this.liberando = false;
        this.resumenLiberacionVisible = false;
        this.snackBar.open(response?.message || 'Remito liberado correctamente.', 'Cerrar', {
          duration: 3500
        });
        this.cargarRemito(this.remito!.idRemito);
      },
      error: error => {
        this.liberando = false;
        this.snackBar.open(error?.error?.message || 'Error al liberar remito.', 'Cerrar', {
          duration: 4000
        });
      }
    });
  }

  inicializarDistribucion(remito: Remito): void {
    this.materialesLiberacion = (remito.detalle ?? []).filter(item => Number(item.cantidadPendiente ?? item.cantidad) > 0).map(item => ({
      idDetalle: Number(item.idDetalle),
      idMaterial: item.idMaterial,
      material: item.material,
      unidad: item.unidad,
      cantidadTotal: Number(item.cantidadPendiente ?? item.cantidad),
      destinos: [{
        proyectoId: remito.idProyecto ?? null,
        cantidad: Number(item.cantidadPendiente ?? item.cantidad)
      }]
    }));
  }

  agregarDestino(material: MaterialLiberacion): void {
    material.destinos.push({ proyectoId: null, cantidad: 0 });
  }

  nombreProyecto(proyectoId: number | null): string {
    return this.proyectos.find(proyecto =>
      Number(proyecto.proyecto_id) === Number(proyectoId)
    )?.nombre || `Proyecto #${proyectoId}`;
  }

  quitarDestino(material: MaterialLiberacion, index: number): void {
    if (material.destinos.length === 1) {
      this.snackBar.open('Cada material debe conservar al menos un proyecto destino.', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    material.destinos.splice(index, 1);
  }

  cantidadAsignada(material: MaterialLiberacion): number {
    return this.redondearCantidad(material.destinos.reduce(
      (total, destino) => total + Number(destino.cantidad || 0),
      0
    ));
  }

  cantidadRestante(material: MaterialLiberacion): number {
    return this.redondearCantidad(material.cantidadTotal - this.cantidadAsignada(material));
  }

  proyectoUsadoEnOtroDestino(
    material: MaterialLiberacion,
    proyectoId: number,
    destinoActual: DestinoLiberacion
  ): boolean {
    return material.destinos.some(destino =>
      destino !== destinoActual && Number(destino.proyectoId) === Number(proyectoId)
    );
  }

  distribucionMaterialValida(material: MaterialLiberacion): boolean {
    const destinosActivos = material.destinos.filter(destino => Number(destino.cantidad) > 0);
    if (!destinosActivos.length) return true;
    const proyectos = destinosActivos.map(destino => Number(destino.proyectoId));
    const proyectosValidos = proyectos.every(id => id > 0);
    const proyectosUnicos = new Set(proyectos).size === proyectos.length;
    const cantidadesValidas = destinosActivos.every(destino => Number(destino.cantidad) > 0);

    return proyectosValidos
      && proyectosUnicos
      && cantidadesValidas
      && this.cantidadRestante(material) >= -0.005;
  }

  distribucionValida(): boolean {
    return this.materialesLiberacion.some(material => this.cantidadAsignada(material) > 0)
      && this.materialesLiberacion.every(material => this.distribucionMaterialValida(material));
  }

  volver(): void {
    if (this.idRegistroCompra) {
      this.router.navigate(['/ingreso-materiales/registros', this.idRegistroCompra, 'remitos']);
      return;
    }

    this.router.navigate(['/ingreso-materiales/remitos']);
  }

  formatearFecha(fecha?: string | null): string {
    return fecha ? fecha.substring(0, 10) : '-';
  }

  private claveDestino(material: MaterialLiberacion, destino: DestinoLiberacion): string {
    return `${material.idDetalle}:${Number(destino.proyectoId)}`;
  }

  private obtenerSugerenciasBom(
    material: MaterialLiberacion,
    proyectoId: number | null
  ): MaterialBomProyecto[] {
    const lineasBom = this.bomPorProyecto[Number(proyectoId)] || [];
    const nombre = this.normalizar(material.material);
    const unidad = this.normalizar(material.unidad);
    const tokensMaterial = this.tokens(nombre);
    const vistos = new Set<string>();

    const ordenadas = lineasBom
      .map(linea => {
        const nombreBom = this.normalizar(linea.material_bom || linea.descripcion_libre);
        const mismaUom = this.normalizar(linea.uom_nombre) === unidad;
        const tokensBom = this.tokens(nombreBom);
        const comunes = tokensMaterial.filter(token => tokensBom.includes(token)).length;
        const union = new Set([...tokensMaterial, ...tokensBom]).size || 1;
        const similitud = comunes / union;
        let puntaje = similitud * 70;
        if (nombreBom === nombre) puntaje += 120;
        else if (nombreBom.includes(nombre) || nombre.includes(nombreBom)) puntaje += 55;
        if (mismaUom) puntaje += 35;
        else puntaje -= 40;
        return { linea, puntaje, mismaUom };
      })
      .sort((a, b) => b.puntaje - a.puntaje)
      .filter(resultado => {
        const clave = resultado.linea.material_id
          ? `MAT:${resultado.linea.material_id}`
          : `${this.normalizar(resultado.linea.material_bom)}:${this.normalizar(resultado.linea.uom_nombre)}`;
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      });

    const aproximadas = ordenadas.filter(resultado =>
      resultado.puntaje >= 30 || resultado.mismaUom
    );

    return (aproximadas.length ? aproximadas : ordenadas)
      .slice(0, 5)
      .map(resultado => resultado.linea);
  }

  private tokens(value: string): string[] {
    return value
      .replace(/[^A-Z0-9]+/g, ' ')
      .split(' ')
      .filter(token => token.length > 1);
  }

  private esCoincidenciaFuerte(
    material: MaterialLiberacion,
    linea: MaterialBomProyecto
  ): boolean {
    return this.normalizar(linea.material_bom || linea.descripcion_libre) === this.normalizar(material.material)
      && this.normalizar(linea.uom_nombre) === this.normalizar(material.unidad);
  }

  private normalizar(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private redondearCantidad(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
