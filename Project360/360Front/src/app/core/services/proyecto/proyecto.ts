import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProyectoService {
  private apiUrl = '/api/proyectos';

  constructor(private http: HttpClient) {}

  getProyectos(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }
  getProyecto(id: number): Observable<any> { return this.http.get(`${this.apiUrl}/${id}`); }
  crearProyecto(data: any): Observable<any> { return this.http.post(this.apiUrl, data); }
  actualizarProyecto(id: number, data: any): Observable<any> { return this.http.put(`${this.apiUrl}/${id}`, data); }
  eliminarProyecto(id: number): Observable<any> { return this.http.delete(`${this.apiUrl}/${id}`); }
}
