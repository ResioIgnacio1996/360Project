import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class PanelGeneralService {
  constructor(private http: HttpClient) {}
  obtener(proyectoId:number, filtros:{fecha_corte:string;etapa_id?:number|null;responsable_id?:number|null;ventana_dias?:number}) {
    let params=new HttpParams().set('fecha_corte',filtros.fecha_corte).set('ventana_dias',filtros.ventana_dias||30);
    if(filtros.etapa_id)params=params.set('etapa_id',filtros.etapa_id);
    if(filtros.responsable_id)params=params.set('responsable_id',filtros.responsable_id);
    return this.http.get<any>(`/api/proyectos/${proyectoId}/panel-general`,{params});
  }
}
