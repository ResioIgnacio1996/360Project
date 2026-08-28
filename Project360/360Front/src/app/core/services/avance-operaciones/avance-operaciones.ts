import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AvanceOperacionesService {
  private readonly api = '/api/avance-operaciones';
  constructor(private http: HttpClient) {}
  obtener(proyectoId: number): Observable<any> { return this.http.get(`${this.api}/proyectos/${proyectoId}`); }
  obtenerOperacion(operacionId: number): Observable<any> { return this.http.get(`${this.api}/operaciones/${operacionId}`); }
  obtenerBom(operacionId: number): Observable<any> { return this.http.get(`${this.api}/operaciones/${operacionId}/bom`); }
  obtenerAvances(operacionId: number, pagina = 1, limite = 5): Observable<any> {
    return this.http.get(`${this.api}/operaciones/${operacionId}/avances`, { params: { pagina, limite } });
  }
  obtenerConsumos(operacionId: number, pagina = 1, limite = 10): Observable<any> {
    return this.http.get(`${this.api}/operaciones/${operacionId}/consumos`, { params: { pagina, limite } });
  }
  obtenerDetalle(operacionId: number): Observable<any> {
    return forkJoin({
      operacion: this.obtenerOperacion(operacionId),
      bom: this.obtenerBom(operacionId),
      avances: this.obtenerAvances(operacionId),
      consumos: this.obtenerConsumos(operacionId)
    });
  }
  iniciar(operacionId: number, fecha_inicio_real: string): Observable<any> {
    return this.http.post(`${this.api}/operaciones/${operacionId}/iniciar`, { fecha_inicio_real });
  }
  modificarInicio(operacionId: number, datos: any): Observable<any> {
    return this.http.patch(`${this.api}/operaciones/${operacionId}/fecha-inicio`, datos);
  }
  finalizar(operacionId: number, fecha_fin_real: string): Observable<any> {
    return this.http.post(`${this.api}/operaciones/${operacionId}/finalizar`, { fecha_fin_real });
  }
  modificarFin(operacionId: number, datos: any): Observable<any> {
    return this.http.patch(`${this.api}/operaciones/${operacionId}/fecha-fin`, datos);
  }
  registrarAvance(operacionId: number, datos: any): Observable<any> {
    return this.http.post(`${this.api}/operaciones/${operacionId}/avances`, datos);
  }
  registrarConsumos(operacionId: number, datos: any): Observable<any> {
    return this.http.post(`${this.api}/operaciones/${operacionId}/consumos`, datos);
  }
  anularConsumo(consumoId: number, motivo: string): Observable<any> {
    return this.http.patch(`${this.api}/consumos/${consumoId}/anular`, { motivo });
  }
}
