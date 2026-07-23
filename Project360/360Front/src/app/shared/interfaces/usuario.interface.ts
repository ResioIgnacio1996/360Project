export interface Usuario {
  usuario_id: number;
  nombre: string;
  email: string;
  usuario: string;
  activo: boolean;
  rol_id: number | null;
  rol: string | null;
}
