import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BomService {
  private readonly api = '/api/bom';
  constructor(private http: HttpClient) {}
  listar(proyectoId: number): Observable<any[]> { return this.http.get<any[]>(`${this.api}/proyectos/${proyectoId}`); }
  contexto(proyectoId: number): Observable<any> { return this.http.get(`${this.api}/proyectos/${proyectoId}/contexto`); }
  crearLinea(proyectoId: number, linea: any): Observable<any> {
    return this.http.post(`${this.api}/proyectos/${proyectoId}/lineas`, linea);
  }
  actualizarLinea(proyectoId: number, bomId: number, linea: any): Observable<any> {
    return this.http.put(`${this.api}/proyectos/${proyectoId}/lineas/${bomId}`, linea);
  }
  eliminarLinea(proyectoId: number, bomId: number): Observable<any> {
    return this.http.delete(`${this.api}/proyectos/${proyectoId}/lineas/${bomId}`);
  }
  previsualizar(proyectoId: number, archivo: File): Observable<any> {
    const form = new FormData(); form.append('bom', archivo);
    return this.http.post(`${this.api}/proyectos/${proyectoId}/previsualizar`, form);
  }
  importar(proyectoId: number, filas: any[]): Observable<any> {
    return this.http.post(`${this.api}/proyectos/${proyectoId}/importar`, { filas });
  }
}
