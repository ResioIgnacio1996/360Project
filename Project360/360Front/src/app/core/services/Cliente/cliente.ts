import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Cliente, ClientePayload } from '../../../shared/interfaces/cliente.interface';

@Injectable({
  providedIn: 'root'
})
export class ClienteService {

  private apiUrl = '/api/clientes';

  constructor(private http: HttpClient) {}

  getClientes(): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(this.apiUrl);
  }

  getCliente(id: number): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.apiUrl}/${id}`);
  }

  crearCliente(cliente: ClientePayload): Observable<any> {
    return this.http.post(this.apiUrl, cliente);
  }

  actualizarCliente(id: number, cliente: ClientePayload): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, cliente);
  }

  eliminarCliente(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
