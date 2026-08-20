export interface Cliente {
  id_cliente: number;
  nombre: string;
  apellido: string;
  razon_social: string;
  cuil: string | null;
  telefono: string | null;
  ubicacion: string | null;
  email: string | null;
}

export interface ClientePayload {
  razon_social: string;
  cuil: string | null;
  telefono: string | null;
  ubicacion: string | null;
  email: string | null;
}
