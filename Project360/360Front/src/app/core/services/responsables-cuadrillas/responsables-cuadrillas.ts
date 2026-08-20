import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DetalleResponsable, ResponsableOperacion, ResponsablePayload } from '../../../shared/interfaces/responsable-operacion.interface';

@Injectable({ providedIn: 'root' })
export class ResponsablesCuadrillasService {
  private readonly apiUrl = '/api/responsables-cuadrillas';
  constructor(private http: HttpClient) {}
  listar(): Observable<ResponsableOperacion[]> { return this.http.get<ResponsableOperacion[]>(this.apiUrl); }
  obtener(id: number): Observable<DetalleResponsable> { return this.http.get<DetalleResponsable>(`${this.apiUrl}/${id}`); }
  crear(data: ResponsablePayload): Observable<ResponsableOperacion> { return this.http.post<ResponsableOperacion>(this.apiUrl, data); }
  actualizar(id: number, data: ResponsablePayload): Observable<ResponsableOperacion> { return this.http.put<ResponsableOperacion>(`${this.apiUrl}/${id}`, data); }
  cambiarEstado(id: number, activo: boolean): Observable<ResponsableOperacion> { return this.http.patch<ResponsableOperacion>(`${this.apiUrl}/${id}/estado`, { activo }); }
}
