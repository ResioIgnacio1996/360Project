import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface Remito {
  idRemito: number;
  numero: string;
  fecha: string;
  liberado: boolean;
  idRegistroCompra: number;
  registroCompraNumero?: string;
  registroCompraTipo?: string;
  proveedor?: string;
  estadoRegistroCompra?: string;
  idProyecto?: number | null;
  proyectoNombre?: string | null;
  cantidadItems?: number;
  estadoLiberacion?: 'PENDIENTE' | 'PARCIAL' | 'LIBERADO';
  cantidadPendiente?: number;
  detalle?: DetalleRemito[];
}

export interface DetalleRemito {
  idDetalle?: number;
  idMaterial: number | null;
  material: string;
  cantidad: number;
  unidad: string;
  cantidadLiberada?: number;
  cantidadPendiente?: number;
  estadoLiberacion?: string;
}

export interface RemitoPayload {
  numero: string;
  fecha: string;
  registro_compra_id: number;
  detalle: Array<{
    id_material?: number | null;
    descripcion: string;
    cantidad: number;
    UoM: string;
  }>;
}

export interface AsignacionMaterialRemito {
  detalle_remito_id: number;
  destinos: Array<{
    proyecto_id: number;
    cantidad: number;
    material_id: number;
  }>;
}

export interface MaterialBomProyecto {
  bom_id: number;
  material_id: number | null;
  descripcion_libre: string;
  material_bom: string;
  uom_nombre: string;
  operacion_secuencia?: number;
  operacion_nombre?: string;
}

export interface RemitoImportResponse {
  success: boolean;
  message: string;
  data: {
    remito: {
      numero: string;
      fecha: string;
      observaciones?: string | null;
    };
    proveedor?: {
      razonSocial?: string;
      cuit?: string | null;
    };
    detalle: Array<{
      nombreMaterial: string;
      descripcionOriginal?: string | null;
      cantidad: number;
      unidad: string;
    }>;
    advertencias: string[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class Remitos {
  private apiUrl = '/api/remitos';

  constructor(private http: HttpClient) {}

  getRemitos(): Observable<Remito[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      map(response => response.map(item => this.normalizarRemito(item)))
    );
  }

  getRemitosPaginados(query: Record<string, string | number | null | undefined>): Observable<any> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return this.http.get<any>(this.apiUrl, { params }).pipe(map(response => this.normalizarPagina(response, query)));
  }

  getRemitosRegistroCompraPaginados(idRegistroCompra: number, query: Record<string, string | number | null | undefined>): Observable<any> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return this.http.get<any>(`${this.apiUrl}/registro-compra/${idRegistroCompra}`, { params }).pipe(map(response => this.normalizarPagina(response, query)));
  }

  getRemitoById(id: number): Observable<Remito> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => this.normalizarRemitoDetalle(response))
    );
  }

  getRemitosByRegistroCompra(idRegistroCompra: number): Observable<Remito[]> {
    return this.http.get<any[]>(`${this.apiUrl}/registro-compra/${idRegistroCompra}`).pipe(
      map(response => response.map(item => this.normalizarRemito(item)))
    );
  }

  crearRemito(payload: RemitoPayload): Observable<any> {
    return this.http.post(this.apiUrl, payload);
  }

  actualizarRemito(id: number, payload: RemitoPayload): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, payload);
  }

  importarDocumento(file: File): Observable<RemitoImportResponse> {
    const formData = new FormData();
    formData.append('documento', file);

    return this.http.post<RemitoImportResponse>(`${this.apiUrl}/documento`, formData);
  }

  liberarRemito(id: number, asignaciones?: AsignacionMaterialRemito[]): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/${id}/liberar`,
      asignaciones ? { asignaciones } : {}
    );
  }

  cancelarRemito(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/cancelar`, {});
  }

  getMaterialesBomProyecto(proyectoId: number): Observable<MaterialBomProyecto[]> {
    return this.http.get<MaterialBomProyecto[]>(`${this.apiUrl}/proyecto/${proyectoId}/materiales-bom`);
  }

  private normalizarRemito(item: any): Remito {
    return {
      idRemito: item.remito_id ?? item.idRemito,
      numero: item.numero ?? '',
      fecha: item.fecha ?? '',
      liberado: !!item.liberado,
      idRegistroCompra: item.idRegistroDeCompra ?? item.idRegistroCompra,
      registroCompraNumero: item.registro_compra_numero ?? item.registroCompraNumero,
      registroCompraTipo: item.registro_compra_tipo ?? item.registroCompraTipo,
      proveedor: item.razon_social ?? item.proveedor,
      estadoRegistroCompra: item.estado_registro_compra ?? item.estadoRegistroCompra,
      idProyecto: item.proyecto_id ?? item.idProyecto ?? null,
      proyectoNombre: item.proyecto_nombre ?? item.proyectoNombre ?? null,
      cantidadItems: item.cantidad_items ?? item.cantidadItems
      ,estadoLiberacion: item.estado_liberacion ?? item.estadoLiberacion
      ,cantidadPendiente: Number(item.cantidad_pendiente ?? item.cantidadPendiente ?? 0)
    };
  }

  private normalizarPagina(response: any, query: Record<string, string | number | null | undefined>): any {
    const lista = Array.isArray(response) ? response : response?.data ?? response?.recordset ?? response?.rows ?? [];
    const data = lista.map((item: any) => this.normalizarRemito(item));
    const page = response?.page ?? {};
    return { data, page: {
      index: Number(page.index ?? query['page'] ?? 0),
      size: Number(page.size ?? query['pageSize'] ?? data.length),
      total: Number(page.total ?? data.length),
      totalPages: Number(page.totalPages ?? (data.length ? 1 : 0))
    }};
  }

  private normalizarRemitoDetalle(response: any): Remito {
    const cabecera = response.cabecera ?? response;
    const remito = this.normalizarRemito(cabecera);

    return {
      ...remito,
      detalle: (response.detalle ?? []).map((item: any) => ({
        idDetalle: item.detalle_remito_id ?? item.idDetalle,
        idMaterial: item.id_material ?? item.idMaterial,
        material: item.material ?? '',
        cantidad: Number(item.cantidad ?? 0),
        unidad: item.UoM ?? item.unidad ?? '',
        cantidadLiberada: Number(item.cantidad_liberada ?? 0),
        cantidadPendiente: Number(item.cantidad_pendiente ?? item.cantidad ?? 0),
        estadoLiberacion: item.estado_liberacion ?? 'PENDIENTE'
      }))
    };
  }
}
