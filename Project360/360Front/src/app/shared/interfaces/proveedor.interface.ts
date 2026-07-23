export interface Proveedor {
  proveedor_id: number;
  razon_social: string;
  cuit: string;
  telefono: string;
  email: string;
  direccion: string;
  ubicacion: string;
  rubro_id: number;
  rubro: string;
  activo: boolean;
}

export interface RubroProveedor {
  rubro_id: number;
  nombre: string;
}