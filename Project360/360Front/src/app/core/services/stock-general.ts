import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class StockGeneral {
  private apiUrl='/api/stock-general';
  constructor(private http:HttpClient){}
  listar():Observable<any[]>{return this.http.get<any[]>(this.apiUrl);}
  porProyecto(id:number):Observable<any[]>{return this.http.get<any[]>(`${this.apiUrl}/proyecto/${id}`);}
  asignar(data:any):Observable<any>{return this.http.post(`${this.apiUrl}/asignar-proyecto`,data);}
  devolver(data:any):Observable<any>{return this.http.post(`${this.apiUrl}/devolver-proyecto`,data);}
}
