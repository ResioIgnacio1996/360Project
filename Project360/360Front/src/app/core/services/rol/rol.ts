import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Rol } from '../../../shared/interfaces/rol.interface';

@Injectable({
  providedIn: 'root'
})
export class RolService {

  private baseUrl = '/api/roles';
  private entidadesUrl = '/api/entidades';
  private accionesUrl = '/api/acciones';
  private permisosUrl = '/api/usuarios/roles';

  constructor(private http: HttpClient) { }

  getRoles(): Observable<Rol[]> {
    return this.http.get<Rol[]>(this.baseUrl);
  }

  getRolById(id: number): Observable<Rol> {
    return this.http.get<Rol>(`${this.baseUrl}/${id}`);
  }

  crearRol(data: Partial<Rol>): Observable<any> {
    return this.http.post(this.baseUrl, data);
  }

  actualizarRol(id: number, data: Partial<Rol>): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}`, data);
  }

  activarDesactivarRol(id: number, activo: boolean): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}/estado`,{ activo });
  }
  getEntidades(): Observable<any[]> {
    return this.http.get<any[]>(this.entidadesUrl);
  }

  getAcciones(): Observable<any[]> {
    return this.http.get<any[]>(this.accionesUrl);
  }

  getPermisosRol(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${id}/permisos`);
  }

  guardarPermisosRol(id: number, permisos: any[]): Observable<any> {
    return this.http.put<any>(
      `${this.permisosUrl}/${id}/permisos`,
      { permisos }
    );
  }

}
