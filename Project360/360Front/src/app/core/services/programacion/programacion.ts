import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface OperacionProgramada {
  operacion_id: number; proyecto_id: number; secuencia: number; nombre: string;
  descripcion?: string; criterio_cierre?: string; etapa_codigo: string; etapa_nombre: string;
  responsable_nombre?: string; estado_codigo: string; estado_label: string; unidad_avance: string;
  duracion_hs: number; pct_avance_actual: number; fecha_inicio_estimada?: string;
  fecha_fin_estimada?: string; fecha_inicio_reprog?: string; fecha_fin_reprog?: string;
  fecha_inicio_real?: string; fecha_fin_real?: string; fecha_no_antes_del?: string;
  dependencias_secuencia?: string; archivada: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProgramacionService {
  private readonly api = '/api/programacion';
  constructor(private http: HttpClient) {}
  obtener(proyectoId: number): Observable<any> { return this.http.get(`${this.api}/proyectos/${proyectoId}`); }
  actualizarDuracion(id: number, data: any): Observable<any> { return this.http.patch(`${this.api}/operaciones/${id}/duracion`, data); }
  actualizarNmt(id: number, data: any): Observable<any> { return this.http.patch(`${this.api}/operaciones/${id}/nmt`, data); }
}
