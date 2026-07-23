export interface RegistroCompra {
  idRegistroCompra: number;
  numero: string;
  tipo?: 'OC' | 'FAC' | string | null;
  fecha: string;
  fechaEntrega?: string | null;
  observaciones?: string | null;
  estado?: EstadoRegistroCompra;
  proveedor: ProveedorRegistroCompra;
  proyecto?: ProyectoRegistroCompra | null;
  detalle: DetalleRegistroCompra[];
  activo?: boolean;
}

export interface EstadoRegistroCompra {
  idEstado: number;
  codigo: string;
  nombre: string;
}

export interface ProveedorRegistroCompra {
  idProveedor?: number | null;
  razonSocial: string;
  cuit?: string | null;
  existe?: boolean;
}

export interface ProyectoRegistroCompra {
  idProyecto: number;
  nombre: string;
}

export interface DetalleRegistroCompra {
  idDetalle?: number;
  idMaterial?: number | null;
  nombreMaterial: string;
  descripcionOriginal?: string | null;
  cantidad: number;
  cantidadSolicitada?: number;
  cantidadRecibida?: number;
  unidad: string;
  existe?: boolean;
}

export interface ArchivoImportado {
  nombreOriginal: string;
  tipo: string;
  tamaño: number;
}

export interface RegistroCompraImportResponse {
  success: boolean;
  message: string;
  data: {
    archivo?: ArchivoImportado;
    registroCompra: {
      numero: string;
      tipo?: 'OC' | 'FAC' | string | null;
      fecha: string;
      fechaEntrega?: string | null;
      observaciones?: string | null;
      proyecto?: ProyectoRegistroCompra | null;
    };
    proveedor: ProveedorRegistroCompra;
    detalle: DetalleRegistroCompra[];
    advertencias: string[];
  };
}

export interface RegistroCompraPayload {
  numero: string;
  tipo?: 'OC' | 'FAC' | string | null;
  fecha: string;
  fechaEntrega?: string | null;
  observaciones?: string | null;
  idProyecto?: number | null;
  proveedor: ProveedorRegistroCompra;
  detalle: DetalleRegistroCompra[];
}
