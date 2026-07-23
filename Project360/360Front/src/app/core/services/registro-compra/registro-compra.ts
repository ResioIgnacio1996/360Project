import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  RegistroCompra,
  RegistroCompraImportResponse,
  RegistroCompraPayload
} from '../../../shared/interfaces/RegistroDeCompra.interface';

@Injectable({
  providedIn: 'root'
})
export class RegistroCompraService {

  private apiUrl = '/api/registro-compra';

  constructor(private http: HttpClient) {}

  getRegistros(): Observable<RegistroCompra[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => {
        const registros = this.extraerLista(response);
        return registros.map((registro: any) => this.normalizarRegistro(registro));
      })
    );
  }

  getRegistroById(id: number): Observable<RegistroCompra> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => this.normalizarRegistroDetalle(response))
    );
  }

  crearRegistro(payload: RegistroCompraPayload): Observable<any> {
    return this.http.post(this.apiUrl, payload);
  }

  actualizarRegistro(id: number, payload: RegistroCompraPayload): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, payload);
  }

  cancelarRegistro(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/cancelar`, {});
  }

  importarDocumento(file: File): Observable<RegistroCompraImportResponse> {
    const formData = new FormData();
    formData.append('documento', file);

    return this.http.post<RegistroCompraImportResponse>(
      `${this.apiUrl}/documento`,
      formData
    );
  }

  private extraerLista(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.data)) {
      return response.data;
    }

    if (Array.isArray(response?.recordset)) {
      return response.recordset;
    }

    if (Array.isArray(response?.rows)) {
      return response.rows;
    }

    return [];
  }

  private normalizarRegistro(registro: any): RegistroCompra {
    const estadoNombre = registro.estado_nombre
      ?? (typeof registro.estado === 'string' ? registro.estado : registro.estado?.nombre)
      ?? '';
    const estadoCodigo = registro.estado_codigo
      ?? registro.estado?.codigo
      ?? estadoNombre;

    return {
      idRegistroCompra: registro.registro_compra_id ?? registro.idRegistroCompra,
      numero: registro.numero ?? '',
      tipo: registro.tipo ?? registro.tipoDocumento ?? registro.documentoTipo ?? null,
      fecha: registro.fecha ?? '',
      fechaEntrega: registro.fecha_entrega ?? registro.fechaEntrega ?? null,
      observaciones: registro.observaciones ?? null,
      activo: registro.activo,
      proveedor: {
        idProveedor: registro.proveedor_id ?? registro.proveedor?.idProveedor ?? null,
        razonSocial: registro.razon_social ?? registro.proveedor?.razonSocial ?? '',
        cuit: registro.cuit ?? registro.proveedor?.cuit ?? null
      },
      estado: {
        idEstado: registro.estado_registroDeCompra_id ?? registro.estado?.idEstado ?? 0,
        codigo: (estadoCodigo ?? '').toString().trim().toUpperCase(),
        nombre: estadoNombre
      },
      proyecto: registro.proyecto_id || registro.idProyecto || registro.proyecto
        ? {
            idProyecto: registro.proyecto_id ?? registro.idProyecto ?? registro.proyecto?.idProyecto,
            nombre: registro.proyecto_nombre ?? registro.proyecto?.nombre ?? ''
          }
        : null,
      detalle: []
    };
  }

  private normalizarRegistroDetalle(response: any): RegistroCompra {
    const cabecera = response?.cabecera ?? response;
    const detalle = response?.detalle ?? cabecera?.detalle ?? [];
    const registro = this.normalizarRegistro(cabecera);

    return {
      ...registro,
      detalle: detalle.map((item: any) => ({
        idDetalle: item.id_detalle_oc ?? item.idDetalle,
        idMaterial: item.id_material ?? item.idMaterial,
        nombreMaterial: item.material ?? item.nombreMaterial ?? item.nombre ?? '',
        descripcionOriginal: item.descripcionOriginal ?? item.material ?? item.nombreMaterial ?? '',
        cantidad: Number(item.cantidad ?? item.cantidadSolicitada ?? 0),
        cantidadSolicitada: Number(item.cantidad ?? item.cantidadSolicitada ?? 0),
        unidad: item.UoM ?? item.unidad ?? '',
        existe: true
      }))
    };
  }
}
