import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MaterialDetectado {
  codigo: string | null;
  descripcion: string;
  rubro: string | null;
  unidad_medida: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
  subtotal: number | null;
}

export interface DocumentoMaterialesResponse {
  message: string;
  archivo: {
    nombre: string;
    tipo: string;
    tamaño: number;
  };
  data: {
    tipo_documento: string;
    proveedor: any;
    orden_compra: any;
    obra_o_proyecto: any;
    materiales: MaterialDetectado[];
    datos_detectados: {
      confianza_general: string;
      campos_faltantes: string[];
      advertencias: string[];
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class OrdenCompraService {
  private readonly apiUrl = '/api/materiales/documento';

  constructor(private http: HttpClient) {}

  subirDocumento(file: File): Observable<DocumentoMaterialesResponse> {
    const formData = new FormData();

    formData.append('ordenCompra', file);

    return this.http.post<DocumentoMaterialesResponse>(
      this.apiUrl,
      formData
    );
  }
}