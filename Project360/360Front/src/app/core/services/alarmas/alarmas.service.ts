import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type CategoriaAlarma = 'OPERACIONES' | 'BOM' | 'CERTIFICACIONES' | 'COMPRAS' | 'PROYECTO';

export interface Alarma {
  alarma_id: number;
  proyecto_id: number;
  proyecto_nombre: string;
  categoria: CategoriaAlarma;
  severidad: 'INFORMATIVA' | 'ADVERTENCIA' | 'CRITICA';
  mensaje: string;
  recurso_tipo?: string;
  recurso_id?: number;
  url_destino?: string;
  fecha_disparo: string;
  leida: boolean;
  estado_gestion: 'ACTIVA' | 'ACEPTADA';
  comentario_aceptacion?: string;
  fecha_aceptacion?: string;
  aceptada_por_nombre?: string;
}

export interface BandejaAlarmas { alarmas: Alarma[]; no_leidas: number; }
export interface ReglaAlarma {
  regla_id?: number; proyecto_id?: number; categoria: CategoriaAlarma; tipo: string; nombre: string;
  mensaje: string; parametros: Record<string, any>; alcance: 'TODAS' | 'SELECCIONADAS';
  entidades: number[]; estado: 'ACTIVA' | 'PAUSADA'; fecha_actualizacion?: string;
}

@Injectable({ providedIn: 'root' })
export class AlarmasService {
  private readonly apiUrl = '/api/alarmas';
  constructor(private http: HttpClient) {}

  listar(proyectoId?: number, limite = 30, estado: 'ACTIVA'|'ACEPTADA'|'TODAS' = 'ACTIVA'): Observable<BandejaAlarmas> {
    let params = new HttpParams().set('limite', limite);
    params = params.set('estado', estado);
    if (proyectoId) params = params.set('proyecto_id', proyectoId);
    return this.http.get<BandejaAlarmas>(this.apiUrl, { params });
  }
  aceptar(id:number,comentario:string):Observable<unknown>{return this.http.patch(`${this.apiUrl}/${id}/aceptar`,{comentario});}

  marcarLeida(id: number): Observable<unknown> {
    return this.http.patch(`${this.apiUrl}/${id}/leer`, {});
  }

  marcarTodasLeidas(proyectoId?: number): Observable<unknown> {
    return this.http.patch(`${this.apiUrl}/leer-todas`, proyectoId ? { proyecto_id: proyectoId } : {});
  }
  listarReglas(proyectoId: number): Observable<ReglaAlarma[]> { return this.http.get<ReglaAlarma[]>(`${this.apiUrl}/proyectos/${proyectoId}/reglas`); }
  opcionesCertificaciones(proyectoId:number):Observable<any>{return this.http.get(`${this.apiUrl}/proyectos/${proyectoId}/certificaciones`);}
  crearRegla(proyectoId: number, regla: ReglaAlarma): Observable<unknown> { return this.http.post(`${this.apiUrl}/proyectos/${proyectoId}/reglas`, regla); }
  actualizarRegla(proyectoId: number, regla: ReglaAlarma): Observable<unknown> { return this.http.put(`${this.apiUrl}/proyectos/${proyectoId}/reglas/${regla.regla_id}`, regla); }
  eliminarRegla(proyectoId: number, reglaId: number): Observable<unknown> { return this.http.delete(`${this.apiUrl}/proyectos/${proyectoId}/reglas/${reglaId}`); }
}
