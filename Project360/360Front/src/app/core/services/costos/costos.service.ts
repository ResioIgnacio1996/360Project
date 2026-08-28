import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
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
  certificados(proyectoId:number):Observable<any[]>{return this.cargarPaginas<any>(`/api/certificados-cliente/proyectos/${proyectoId}`,50).pipe(map(paginas=>paginas.flatMap(p=>this.datosPagina(p))));}
  certificado(proyectoId:number,id:number):Observable<any>{return this.http.get(`/api/certificados-cliente/proyectos/${proyectoId}/${id}`);}
  pdfCertificado(proyectoId:number,id:number):Observable<Blob>{return this.http.get(`/api/certificados-cliente/proyectos/${proyectoId}/${id}/pdf`,{responseType:'blob'});}
  eliminarCertificado(proyectoId:number,id:number,motivo:string):Observable<any>{return this.http.delete(`/api/certificados-cliente/proyectos/${proyectoId}/${id}`,{body:{motivo}});}
  previewResponsable(proyectoId:number,corte:any):Observable<any>{return this.http.post(`/api/certificados-responsable/proyectos/${proyectoId}/preview`,corte);}
  emitirResponsable(proyectoId:number,data:any):Observable<any>{return this.http.post(`/api/certificados-responsable/proyectos/${proyectoId}`,data);}
  certificadosResponsable(proyectoId:number):Observable<any[]>{return this.cargarPaginas<any>(`/api/certificados-responsable/proyectos/${proyectoId}`,50).pipe(map(paginas=>paginas.flatMap(p=>this.datosPagina(p))));}
  certificadoResponsable(proyectoId:number,id:number):Observable<any>{return this.http.get(`/api/certificados-responsable/proyectos/${proyectoId}/${id}`);}
  pdfCertificadoResponsable(proyectoId:number,id:number):Observable<Blob>{return this.http.get(`/api/certificados-responsable/proyectos/${proyectoId}/${id}/pdf`,{responseType:'blob'});}
  eliminarCertificadoResponsable(proyectoId:number,id:number,motivo:string):Observable<any>{return this.http.delete(`/api/certificados-responsable/proyectos/${proyectoId}/${id}`,{body:{motivo}});}
  movimientos(proyectoId:number):Observable<any>{return this.cargarPaginas<any>(`/api/movimientos-financieros/proyectos/${proyectoId}`,50).pipe(map(paginas=>{const primero=this.datosPaginaObjeto(paginas[0]);return{...primero,movimientos:paginas.flatMap(p=>this.datosPaginaObjeto(p).movimientos||[])};}));}
  crearMovimiento(proyectoId:number,data:any):Observable<any>{return this.http.post(`/api/movimientos-financieros/proyectos/${proyectoId}`,data);}
  anularMovimiento(proyectoId:number,id:number,motivo:string):Observable<any>{return this.http.patch(`/api/movimientos-financieros/proyectos/${proyectoId}/${id}/anular`,{motivo});}
  private cargarPaginas<T>(url:string,pageSize:number):Observable<any[]>{const pedir=(page:number)=>this.http.get<T>(url,{params:new HttpParams().set('page',page).set('pageSize',pageSize)});return pedir(0).pipe(expand((respuesta:any)=>{const pagina=respuesta?.page;return pagina&&pagina.index+1<pagina.totalPages?pedir(pagina.index+1):EMPTY;}),reduce((paginas:any[],pagina:any)=>[...paginas,pagina],[]));}
  private datosPagina<T>(respuesta:any):T[]{return Array.isArray(respuesta)?respuesta:(Array.isArray(respuesta?.data)?respuesta.data:[]);}
  private datosPaginaObjeto(respuesta:any):any{return respuesta?.data??respuesta??{};}
}
