import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

export interface DiaCalendario {
  fecha: Date;
  fechaISO: string;
  numeroDia: number;
  nombreDia: string;
  nombreDiaCorto: string;
  esHoy: boolean;
  esFinDeSemana: boolean;
}

export interface MesCalendario {
  anio: number;
  numeroMes: number;
  nombreMes: string;
  cantidadDias: number;
  primerDiaSemana: number;
  dias: DiaCalendario[];
}

export interface FechaOficial {
  fechaHora: string;
  fecha: string;
  zonaHoraria: string;
}

@Injectable({ providedIn: 'root' })
export class CalendarioService {
  private fechaOficial?: Date;
  private readonly locale = 'es-AR';
  private readonly zonaHoraria = 'America/Argentina/Buenos_Aires';

  constructor(private http: HttpClient) {}

  obtenerFechaServidor(): Observable<FechaOficial> {
    return this.http.get<FechaOficial>('/api/sistema/fecha-actual').pipe(
      tap(respuesta => {
        this.fechaOficial = this.fechaDesdeISO(respuesta.fecha);
      })
    );
  }

  obtenerFechaActual(): Date {
    return this.fechaOficial ? new Date(this.fechaOficial) : new Date();
  }

  obtenerMesActual(): MesCalendario {
    const hoy = this.obtenerFechaActual();
    return this.obtenerMes(hoy.getFullYear(), hoy.getMonth() + 1);
  }

  obtenerMes(anio: number, numeroMes: number): MesCalendario {
    if (!Number.isInteger(anio) || !Number.isInteger(numeroMes) || numeroMes < 1 || numeroMes > 12)
      throw new RangeError('El mes debe estar entre 1 y 12 y el año debe ser entero');
    const indiceMes = numeroMes - 1;
    const cantidadDias = new Date(anio, numeroMes, 0).getDate();
    const hoy = this.obtenerFechaActual();
    const dias: DiaCalendario[] = [];
    for (let numeroDia = 1; numeroDia <= cantidadDias; numeroDia++) {
      const fecha = new Date(anio, indiceMes, numeroDia, 12);
      dias.push({
        fecha,
        fechaISO: this.formatearFechaISO(fecha),
        numeroDia,
        nombreDia: this.obtenerNombreDia(fecha),
        nombreDiaCorto: this.obtenerNombreDiaCorto(fecha),
        esHoy: this.esMismaFecha(fecha, hoy),
        esFinDeSemana: fecha.getDay() === 0 || fecha.getDay() === 6
      });
    }
    const primeraFecha = new Date(anio, indiceMes, 1, 12);
    return {
      anio, numeroMes, nombreMes: this.obtenerNombreMes(primeraFecha), cantidadDias,
      primerDiaSemana: this.convertirDiaSemanaALunesPrimero(primeraFecha), dias
    };
  }

  obtenerNombreDia(fecha: Date): string {
    return new Intl.DateTimeFormat(this.locale, { weekday: 'long', timeZone: this.zonaHoraria }).format(fecha);
  }

  obtenerNombreDiaCorto(fecha: Date): string {
    return new Intl.DateTimeFormat(this.locale, { weekday: 'short', timeZone: this.zonaHoraria })
      .format(fecha).replace('.', '').slice(0, 3).toUpperCase();
  }

  obtenerNombreMes(fecha: Date): string {
    return new Intl.DateTimeFormat(this.locale, { month: 'long', timeZone: this.zonaHoraria }).format(fecha);
  }

  obtenerDescripcionFechaActual(): string {
    return new Intl.DateTimeFormat(this.locale, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: this.zonaHoraria
    }).format(this.obtenerFechaActual());
  }

  convertirDiaSemanaALunesPrimero(fecha: Date): number {
    return (fecha.getDay() + 6) % 7;
  }

  formatearFechaISO(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  esMismaFecha(a: Date, b: Date): boolean {
    return this.formatearFechaISO(a) === this.formatearFechaISO(b);
  }

  fechaDesdeISO(fechaISO: string): Date {
    const [anio, mes, dia] = fechaISO.split('-').map(Number);
    return new Date(anio, mes - 1, dia, 12);
  }
}
