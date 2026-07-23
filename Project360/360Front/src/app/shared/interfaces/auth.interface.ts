export interface LoginRequest {
  usuario: string;
  password: string;
}

export interface UsuarioSesion {
  usuario_id: number;
  empresa_id?: number;
  nombre: string;
  usuario: string;
  rol_id?: number;
  rol_nombre?: string;
}

export interface LoginResponse {
  token: string;
  usuario: UsuarioSesion;
}
