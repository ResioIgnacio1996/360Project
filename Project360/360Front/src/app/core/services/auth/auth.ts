import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { LoginRequest, LoginResponse, UsuarioSesion } from '../../../shared/interfaces/auth.interface';

export type { UsuarioSesion };

@Injectable({
  providedIn: 'root'
})
export class Auth {

  private apiUrl = '/api/auth';
  private readonly tokenStorageKey = 'token';
  private readonly usuarioStorageKey = 'currentUser';

  private usuarioActualSubject = new BehaviorSubject<UsuarioSesion | null>(this.obtenerUsuarioGuardado());

  usuarioActual$ = this.usuarioActualSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, data)
      .pipe(
        tap(response => {
          localStorage.setItem(this.tokenStorageKey, response.token);
          localStorage.setItem(this.usuarioStorageKey, JSON.stringify(response.usuario));

          this.usuarioActualSubject.next(response.usuario);
        })
      );
  }

  getUsuarioActual(): UsuarioSesion | null {
    return this.usuarioActualSubject.value;
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenStorageKey);
  }

  estaLogueado(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.usuarioStorageKey);
    this.usuarioActualSubject.next(null);
  }

  private obtenerUsuarioGuardado(): UsuarioSesion | null {
    const usuarioGuardado = localStorage.getItem(this.usuarioStorageKey);

    if (!usuarioGuardado) {
      return null;
    }

    try {
      return JSON.parse(usuarioGuardado) as UsuarioSesion;
    } catch {
      localStorage.removeItem(this.usuarioStorageKey);
      return null;
    }
  }
}
