import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { LoginRequest } from '../../shared/interfaces/auth.interface';

export interface UsuarioSesion {
  usuario_id: number;
  nombre: string;
  usuario: string;
}

@Injectable({
  providedIn: 'root'
})
export class Auth {

  private apiUrl = 'http://localhost:3000/api/auth';

  private usuarioActualSubject = new BehaviorSubject<UsuarioSesion | null>(null);

  usuarioActual$ = this.usuarioActualSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(data: LoginRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, data)
      .pipe(
        tap(response => {
          localStorage.setItem('token', response.token);

          this.usuarioActualSubject.next(response.usuario);
        })
      );
  }

  getUsuarioActual(): UsuarioSesion | null {
    return this.usuarioActualSubject.value;
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  estaLogueado(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem('token');
    this.usuarioActualSubject.next(null);
  }
}