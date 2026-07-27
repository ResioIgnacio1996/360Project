import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({providedIn:'root'})
export class ImportacionProgramacionService {
  private readonly api='/api/importacion-programacion';
  constructor(private http:HttpClient){}
  contexto(proyectoId:number):Observable<any>{return this.http.get(`/api/programacion/proyectos/${proyectoId}`)}
  previsualizar(proyectoId:number,files:Record<string,File>):Observable<any>{
    const form=new FormData();
    Object.entries(files).forEach(([key,file])=>form.append(key,file));
    return this.http.post(`${this.api}/proyectos/${proyectoId}/previsualizar`,form);
  }
  importar(proyectoId:number,version:string,fechaInicio:string,datos:any):Observable<any>{
    return this.http.post(`${this.api}/proyectos/${proyectoId}/importar`,{version,fecha_inicio_programacion:fechaInicio,datos});
  }
}
