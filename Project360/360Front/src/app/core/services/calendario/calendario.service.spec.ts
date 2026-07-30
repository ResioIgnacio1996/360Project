import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { CalendarioService } from './calendario.service';

describe('CalendarioService', () => {
  let service: CalendarioService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(CalendarioService);
  });

  it('calcula correctamente los días de julio de 2026', () => {
    const mes = service.obtenerMes(2026, 7);
    expect(mes.dias[0].nombreDia).toBe('miércoles');
    expect(mes.dias[8].nombreDia).toBe('jueves');
    expect(mes.dias[11].nombreDia).toBe('domingo');
    expect(mes.dias[19].nombreDia).toBe('lunes');
    expect(mes.dias[28].nombreDia).toBe('miércoles');
    expect(mes.dias[30].nombreDia).toBe('viernes');
  });

  it('calcula años bisiestos', () => {
    expect(service.obtenerMes(2024, 2).cantidadDias).toBe(29);
    expect(service.obtenerMes(2026, 2).cantidadDias).toBe(28);
  });

  it('ordena la semana desde el lunes', () => {
    expect(service.convertirDiaSemanaALunesPrimero(new Date(2026, 6, 6, 12))).toBe(0);
    expect(service.convertirDiaSemanaALunesPrimero(new Date(2026, 10, 1, 12))).toBe(6);
  });
});
