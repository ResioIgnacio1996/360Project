import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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

  getRegistrosPaginados(query: Record<string, string | number | null | undefined>): Observable<any> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return this.http.get<any>(this.apiUrl, { params }).pipe(map(response => {
      const data = this.extraerLista(response).map((registro: any) => this.normalizarRegistro(registro));
      const page = response?.page ?? {};
      return {
        data,
        page: {
          index: Number(page.index ?? query['page'] ?? 0),
          size: Number(page.size ?? query['pageSize'] ?? data.length),
          total: Number(page.total ?? data.length),
          totalPages: Number(page.totalPages ?? (data.length ? 1 : 0))
        }
      };
    }));
  }

  obtenerImpactoCancelacion(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}/impacto-cancelacion`);
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
      cantidadRemitosActivos: Number(registro.cantidad_remitos_activos ?? registro.cantidadRemitosActivos ?? 0),
      estadoLiberacion: registro.estado_liberacion ?? registro.estadoLiberacion ?? 'PENDIENTE',
      cantidadMateriales: Number(registro.cantidad_materiales ?? registro.cantidadMateriales ?? 0),
      materialesLiberados: Number(registro.materiales_liberados ?? registro.materialesLiberados ?? 0),
      cantidadLiberada: Number(registro.cantidad_liberada ?? registro.cantidadLiberada ?? 0),
      cantidadTotal: Number(registro.cantidad_total ?? registro.cantidadTotal ?? 0),
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
        cantidadRecibida: Number(item.cantidad_liberada ?? item.cantidadRecibida ?? 0),
        cantidadEnRemitos: Number(item.cantidad_en_remitos ?? item.cantidadEnRemitos ?? 0),
        cantidadPendienteLiberar: Number(item.cantidad_pendiente_liberar ?? item.cantidadPendienteLiberar ?? 0),
        estadoLiberacion: item.estado_liberacion ?? item.estadoLiberacion ?? 'PENDIENTE',
        unidad: item.UoM ?? item.unidad ?? '',
        existe: true
      }))
    };
  }
}
