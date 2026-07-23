import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface Remito {
  idRemito: number;
  numero: string;
  fecha: string;
  liberado: boolean;
  idRegistroCompra: number;
  registroCompraNumero?: string;
  proveedor?: string;
  estadoRegistroCompra?: string;
  cantidadItems?: number;
  detalle?: DetalleRemito[];
}

export interface DetalleRemito {
  idDetalle?: number;
  idMaterial: number;
  material: string;
  cantidad: number;
  unidad: string;
}

export interface RemitoPayload {
  numero: string;
  fecha: string;
  registro_compra_id: number;
  detalle: Array<{
    id_material: number;
    cantidad: number;
    UoM: string;
  }>;
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

  importarDocumento(file: File): Observable<RemitoImportResponse> {
    const formData = new FormData();
    formData.append('documento', file);

    return this.http.post<RemitoImportResponse>(`${this.apiUrl}/documento`, formData);
  }

  liberarRemito(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/liberar`, {});
  }

  private normalizarRemito(item: any): Remito {
    return {
      idRemito: item.remito_id ?? item.idRemito,
      numero: item.numero ?? '',
      fecha: item.fecha ?? '',
      liberado: !!item.liberado,
      idRegistroCompra: item.idRegistroDeCompra ?? item.idRegistroCompra,
      registroCompraNumero: item.registro_compra_numero ?? item.registroCompraNumero,
      proveedor: item.razon_social ?? item.proveedor,
      estadoRegistroCompra: item.estado_registro_compra ?? item.estadoRegistroCompra,
      cantidadItems: item.cantidad_items ?? item.cantidadItems
    };
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
        unidad: item.UoM ?? item.unidad ?? ''
      }))
    };
  }
}
