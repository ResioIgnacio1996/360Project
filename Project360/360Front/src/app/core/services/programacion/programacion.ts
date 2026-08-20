import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface OperacionProgramada {
  operacion_id: number; proyecto_id: number; secuencia: number; nombre: string;
  descripcion?: string; criterio_cierre?: string; etapa_codigo: string; etapa_nombre: string;
  responsable_id?: number; responsable_nombre?: string; estado_codigo: string; estado_label: string; unidad_avance: string;
  duracion_hs: number; desfase_inicio_hs: number; peso_pct: number; pct_avance_actual: number; fecha_inicio_estimada?: string;
  fecha_fin_estimada?: string; fecha_inicio_reprog?: string; fecha_fin_reprog?: string;
  fecha_inicio_real?: string; fecha_fin_real?: string; fecha_no_antes_del?: string;
  dependencias_secuencia?: string; archivada: boolean;
}

export interface EtapaProgramada {
  etapa_id: number; proyecto_id: number; version_id: number; estado_id: number;
  codigo: string; nombre: string; orden: number; estado_codigo: string; estado_label: string;
  estado_color?: string; fecha_creacion?: string; fecha_actualizacion?: string;
  peso_pct: number; pct_avance: number; aporte_proyecto: number;
}

@Injectable({ providedIn: 'root' })
export class ProgramacionService {
  private readonly api = '/api/programacion';
  constructor(private http: HttpClient) {}
  obtener(proyectoId: number): Observable<any> { return this.http.get(`${this.api}/proyectos/${proyectoId}`); }
  actualizarDuracion(id: number, data: any): Observable<any> { return this.http.patch(`${this.api}/operaciones/${id}/duracion`, data); }
  actualizarNmt(id: number, data: any): Observable<any> { return this.http.patch(`${this.api}/operaciones/${id}/nmt`, data); }
  actualizarOperacion(id: number, data: any): Observable<any> {
    return this.http.patch(`${this.api}/operaciones/${id}`, data);
  }
  crearOperacion(proyectoId: number, data: any): Observable<any> {
    return this.http.post(`${this.api}/proyectos/${proyectoId}/operaciones`, data);
  }
  crearEtapa(proyectoId: number, data: any): Observable<any> {
    return this.http.post(`${this.api}/proyectos/${proyectoId}/etapas`, data);
  }
  actualizarEtapa(proyectoId: number, etapaId: number, data: any): Observable<any> {
    return this.http.patch(`${this.api}/proyectos/${proyectoId}/etapas/${etapaId}`, data);
  }
  guardarExcepcion(proyectoId: number, data: any): Observable<any> {
    return this.http.post(`${this.api}/proyectos/${proyectoId}/excepciones`, data);
  }
  eliminarExcepcion(proyectoId: number, excepcionId: number): Observable<any> {
    return this.http.delete(`${this.api}/proyectos/${proyectoId}/excepciones/${excepcionId}`);
  }
}
