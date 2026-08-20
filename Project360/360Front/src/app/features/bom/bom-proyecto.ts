import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { BomService } from '../../core/services/bom/bom';

@Component({
  selector: 'app-bom-proyecto',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './bom-proyecto.html',
  styleUrl: './bom-proyecto.css'
})
export class BomProyecto implements OnInit {
  readonly proyectoId: number;
  proyecto: any = null;
  operaciones: any[] = [];
  unidades: any[] = [];
  materiales: any[] = [];
  lineas: any[] = [];
  cargando = true;
  guardando = false;
  error = '';
  mensaje = '';
  busqueda = '';
  operacionFiltro = 0;
  formularioAbierto = false;
  lineaEditada: any = null;
  form = this.formVacio();

  constructor(private route: ActivatedRoute, private router: Router, private bom: BomService) {
    this.proyectoId = Number(this.route.snapshot.paramMap.get('id'));
  }

  ngOnInit(): void { this.cargar(); }

  formVacio(): any {
    return { operacion_id: 0, numero_linea: 1, material_id: 0, descripcion_libre: '', cantidad_teorica: null, uom_id: 0 };
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    forkJoin({ contexto: this.bom.contexto(this.proyectoId), lineas: this.bom.listar(this.proyectoId) }).subscribe({
      next: ({ contexto, lineas }) => {
        this.proyecto = contexto.proyecto;
        this.operaciones = contexto.operaciones || [];
        this.unidades = (contexto.unidades || []).map((uom: any) => ({ ...uom, uom_id: Number(uom.uom_id) }));
        this.materiales = (contexto.materiales || []).map((material: any) => ({
          ...material, id_material: Number(material.id_material), uom_id: Number(material.uom_id)
        }));
        this.lineas = lineas || [];
        this.cargando = false;
      },
      error: e => {
        this.error = e?.error?.message || 'No se pudo cargar el BOM del proyecto';
        this.cargando = false;
      }
    });
  }

  get filtradas(): any[] {
    const texto = this.busqueda.trim().toLowerCase();
    return this.lineas.filter(linea =>
      (!this.operacionFiltro || Number(linea.operacion_id) === Number(this.operacionFiltro)) &&
      (!texto || `${linea.descripcion_libre} ${linea.etapa_codigo} ${linea.secuencia} ${linea.operacion_nombre} ${linea.unidad}`.toLowerCase().includes(texto))
    );
  }

  get totalTeorico(): number { return this.lineas.reduce((total, linea) => total + Number(linea.cantidad_teorica || 0), 0); }
  get operacionesConMaterial(): number { return new Set(this.lineas.map(linea => Number(linea.operacion_id))).size; }

  volver(): void { this.router.navigate(['/proyectos', this.proyectoId]); }

  nuevaLinea(): void {
    const operacionId = Number(this.operaciones[0]?.operacion_id || 0);
    this.lineaEditada = null;
    this.form = { ...this.formVacio(), operacion_id: operacionId, numero_linea: this.siguienteLinea(operacionId) };
    this.formularioAbierto = true;
    this.error = '';
  }

  editar(linea: any): void {
    this.lineaEditada = linea;
    this.form = {
      operacion_id: Number(linea.operacion_id),
      numero_linea: Number(linea.numero_linea),
      material_id: Number(linea.material_id || 0),
      descripcion_libre: linea.descripcion_libre,
      cantidad_teorica: Number(linea.cantidad_teorica),
      uom_id: Number(linea.uom_id)
    };
    this.formularioAbierto = true;
    this.error = '';
  }

  cambiarOperacion(): void {
    if (!this.lineaEditada) this.form.numero_linea = this.siguienteLinea(Number(this.form.operacion_id));
  }

  cambiarMaterial(): void {
    const material = this.materiales.find(item => Number(item.id_material) === Number(this.form.material_id));
    if (!material) {
      this.form.descripcion_libre = '';
      this.form.uom_id = 0;
      return;
    }
    this.form.descripcion_libre = material.nombre;
    this.form.uom_id = Number(material.uom_id);
  }

  siguienteLinea(operacionId: number): number {
    return Math.max(0, ...this.lineas.filter(l => Number(l.operacion_id) === operacionId).map(l => Number(l.numero_linea) || 0)) + 1;
  }

  cerrarFormulario(): void {
    if (this.guardando) return;
    this.formularioAbierto = false;
    this.lineaEditada = null;
    this.error = '';
  }

  guardar(): void {
    this.error = '';
    const payload = {
      operacion_id: Number(this.form.operacion_id),
      numero_linea: Number(this.form.numero_linea),
      material_id: Number(this.form.material_id || 0),
      descripcion_libre: String(this.form.descripcion_libre || '').trim(),
      cantidad_teorica: Number(this.form.cantidad_teorica),
      uom_id: Number(this.form.uom_id)
    };
    if (!payload.operacion_id || !Number.isInteger(payload.numero_linea) || payload.numero_linea <= 0 ||
        !payload.descripcion_libre || !(payload.cantidad_teorica > 0) || !payload.uom_id) {
      this.error = 'Completa operacion, numero de linea, material, cantidad y unidad de medida';
      return;
    }
    this.guardando = true;
    const request = this.lineaEditada
      ? this.bom.actualizarLinea(this.proyectoId, this.lineaEditada.bom_id, payload)
      : this.bom.crearLinea(this.proyectoId, payload);
    request.subscribe({
      next: r => {
        this.guardando = false;
        this.formularioAbierto = false;
        this.lineaEditada = null;
        this.mensaje = r?.message || 'BOM actualizado correctamente';
        this.cargar();
        setTimeout(() => this.mensaje = '', 3500);
      },
      error: e => {
        this.guardando = false;
        this.error = e?.error?.message || 'No se pudo guardar la linea BOM';
      }
    });
  }

  eliminar(linea: any): void {
    if (this.guardando || !confirm(`Eliminar ${linea.descripcion_libre} del BOM?`)) return;
    this.guardando = true;
    this.error = '';
    this.bom.eliminarLinea(this.proyectoId, linea.bom_id).subscribe({
      next: r => {
        this.guardando = false;
        this.mensaje = r?.message || 'Linea BOM eliminada';
        this.cargar();
        setTimeout(() => this.mensaje = '', 3500);
      },
      error: e => {
        this.guardando = false;
        this.error = e?.error?.message || 'No se pudo eliminar la linea BOM';
      }
    });
  }
}
