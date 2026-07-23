import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  Proveedor,
  RubroProveedor
} from '../../../shared/interfaces/proveedor.interface';

@Injectable({
  providedIn: 'root'
})
export class ProveedorService {

  private apiUrl = '/api/proveedores';

  constructor(private http: HttpClient) {}

  getProveedores(): Observable<Proveedor[]> {
    return this.http.get<Proveedor[]>(this.apiUrl);
  }

  getProveedor(id: number): Observable<Proveedor> {
    return this.http.get<Proveedor>(`${this.apiUrl}/${id}`);
  }

  getRubrosProveedor(): Observable<RubroProveedor[]> {
    return this.http.get<RubroProveedor[]>(`${this.apiUrl}/rubros/lista`);
  }

  crearProveedor(proveedor: Partial<Proveedor>): Observable<any> {
    return this.http.post(this.apiUrl, proveedor);
  }

  actualizarProveedor(id: number, proveedor: Partial<Proveedor>): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, proveedor);
  }

  eliminarProveedor(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
