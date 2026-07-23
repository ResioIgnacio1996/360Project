import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MaterialService {
  private apiUrl = '/api/materiales';

  constructor(private http: HttpClient) {}

  getMateriales(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getUom(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/uom`);
  }
}
