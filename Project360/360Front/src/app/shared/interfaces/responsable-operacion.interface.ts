export type TipoResponsable = 'CUADRILLA_PROPIA' | 'SUBCONTRATISTA' | 'RESPONSABLE';

export interface ResponsableOperacion {
  responsable_id: number;
  codigo: string;
  nombre: string;
  tipo: TipoResponsable;
  activo: boolean;
  fecha_creacion: string;
  operaciones_asignadas: number;
  proyectos_asignados: number;
  avance_promedio: number;
  operaciones_atrasadas: number;
  operaciones_en_riesgo: number;
}

export interface OperacionResponsable {
  operacion_id: number;
  secuencia: number;
  nombre: string;
  descripcion?: string | null;
  pct_avance_actual: number;
  fecha_inicio_estimada?: string | null;
  fecha_fin_estimada?: string | null;
  fecha_inicio_real?: string | null;
  fecha_fin_real?: string | null;
  proyecto_id: number;
  proyecto_nombre: string;
  etapa_nombre: string;
  estado_codigo: string;
  estado_nombre: string;
  cumplimiento: 'CUMPLIDA_A_TIEMPO' | 'CUMPLIDA_CON_DEMORA' | 'CUMPLIDA' | 'ATRASADA' | 'EN_RIESGO' | 'EN_TERMINO';
}

export interface DetalleResponsable {
  responsable: ResponsableOperacion;
  resumen: { operaciones: number; completadas: number; atrasadas: number; en_riesgo: number; avance_promedio: number };
  operaciones: OperacionResponsable[];
  no_conformidades: unknown[];
  nc_disponible: boolean;
}

export interface ResponsablePayload {
  codigo: string;
  nombre: string;
  tipo: TipoResponsable;
  activo: boolean;
}
