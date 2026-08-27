import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
@Injectable({providedIn:'root'})
export class CostosService{
  constructor(private http:HttpClient){}
  permisos():Observable<string[]>{return this.http.get<string[]>('/api/economia-operaciones/permisos');}
  economia(proyectoId:number):Observable<any>{return this.http.get(`/api/economia-operaciones/proyectos/${proyectoId}/operaciones`);}
  dashboard(proyectoId:number):Observable<any>{return this.http.get(`/api/economia-operaciones/proyectos/${proyectoId}/dashboard`);}
  actualizarEconomia(operacionId:number,data:any):Observable<any>{return this.http.patch(`/api/economia-operaciones/operaciones/${operacionId}`,data);}
  historialEconomia(operacionId:number):Observable<any[]>{return this.http.get<any[]>(`/api/economia-operaciones/operaciones/${operacionId}/historial`);}
  preview(proyectoId:number,corte:any):Observable<any>{return this.http.post(`/api/certificados-cliente/proyectos/${proyectoId}/preview`,corte);}
  previewImportacion(proyectoId:number,contenido_csv:string):Observable<any>{return this.http.post(`/api/economia-operaciones/proyectos/${proyectoId}/importacion/preview`,{contenido_csv});}
  importarCostos(proyectoId:number,contenido_csv:string):Observable<any>{return this.http.post(`/api/economia-operaciones/proyectos/${proyectoId}/importacion`,{contenido_csv});}
  emitir(proyectoId:number,data:any):Observable<any>{return this.http.post(`/api/certificados-cliente/proyectos/${proyectoId}`,data);}
  certificados(proyectoId:number):Observable<any[]>{return this.http.get<any[]>(`/api/certificados-cliente/proyectos/${proyectoId}`);}
  certificado(proyectoId:number,id:number):Observable<any>{return this.http.get(`/api/certificados-cliente/proyectos/${proyectoId}/${id}`);}
  pdfCertificado(proyectoId:number,id:number):Observable<Blob>{return this.http.get(`/api/certificados-cliente/proyectos/${proyectoId}/${id}/pdf`,{responseType:'blob'});}
  eliminarCertificado(proyectoId:number,id:number,motivo:string):Observable<any>{return this.http.delete(`/api/certificados-cliente/proyectos/${proyectoId}/${id}`,{body:{motivo}});}
  previewResponsable(proyectoId:number,corte:any):Observable<any>{return this.http.post(`/api/certificados-responsable/proyectos/${proyectoId}/preview`,corte);}
  emitirResponsable(proyectoId:number,data:any):Observable<any>{return this.http.post(`/api/certificados-responsable/proyectos/${proyectoId}`,data);}
  certificadosResponsable(proyectoId:number):Observable<any[]>{return this.http.get<any[]>(`/api/certificados-responsable/proyectos/${proyectoId}`);}
  certificadoResponsable(proyectoId:number,id:number):Observable<any>{return this.http.get(`/api/certificados-responsable/proyectos/${proyectoId}/${id}`);}
  pdfCertificadoResponsable(proyectoId:number,id:number):Observable<Blob>{return this.http.get(`/api/certificados-responsable/proyectos/${proyectoId}/${id}/pdf`,{responseType:'blob'});}
  eliminarCertificadoResponsable(proyectoId:number,id:number,motivo:string):Observable<any>{return this.http.delete(`/api/certificados-responsable/proyectos/${proyectoId}/${id}`,{body:{motivo}});}
  movimientos(proyectoId:number):Observable<any>{return this.http.get(`/api/movimientos-financieros/proyectos/${proyectoId}`);}
  crearMovimiento(proyectoId:number,data:any):Observable<any>{return this.http.post(`/api/movimientos-financieros/proyectos/${proyectoId}`,data);}
  anularMovimiento(proyectoId:number,id:number,motivo:string):Observable<any>{return this.http.patch(`/api/movimientos-financieros/proyectos/${proyectoId}/${id}/anular`,{motivo});}
}
