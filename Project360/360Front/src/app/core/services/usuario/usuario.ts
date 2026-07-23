import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Usuario } from '../../../shared/interfaces/usuario.interface';

export interface UsuarioRequest {
  nombre?: string;
  email?: string;
  usuario?: string;
  password?: string;
  rol_id?: number;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {

  private apiUrl = '/api/usuarios';

  constructor(private http: HttpClient) { }

  obtenerUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.apiUrl);
  }

  obtenerPorId(usuarioId: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/${usuarioId}`);
  }

  crearUsuario(data: UsuarioRequest): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  actualizarUsuario(usuarioId: number, data: UsuarioRequest): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${usuarioId}`, data);
  }
  cambiarEstadoUsuario(usuarioId: number, activo: boolean): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/${usuarioId}/estado`,
      { activo }
    );
  }

}
