import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AvanceOperacionesService {
  private readonly api = '/api/avance-operaciones';
  constructor(private http: HttpClient) {}
  obtener(proyectoId: number): Observable<any> { return this.http.get(`${this.api}/proyectos/${proyectoId}`); }
  iniciar(operacionId: number, fecha_inicio_real: string): Observable<any> {
    return this.http.post(`${this.api}/operaciones/${operacionId}/iniciar`, { fecha_inicio_real });
  }
  registrarAvance(operacionId: number, datos: any): Observable<any> {
    return this.http.post(`${this.api}/operaciones/${operacionId}/avances`, datos);
  }
  registrarConsumos(operacionId: number, datos: any): Observable<any> {
    return this.http.post(`${this.api}/operaciones/${operacionId}/consumos`, datos);
  }
}
