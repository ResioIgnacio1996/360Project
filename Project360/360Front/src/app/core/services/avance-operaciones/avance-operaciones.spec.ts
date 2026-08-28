import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AvanceOperacionesService } from './avance-operaciones';

describe('AvanceOperacionesService', () => {
  let service: AvanceOperacionesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AvanceOperacionesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carga el resumen inicial sin solicitar colecciones de detalle', () => {
    service.obtener(7).subscribe();
    const request = http.expectOne('/api/avance-operaciones/proyectos/7');
    expect(request.request.method).toBe('GET');
    request.flush({ proyecto: {}, operaciones: [] });
  });

  it('carga por operación BOM y los historiales con los límites visibles', () => {
    service.obtenerDetalle(42).subscribe(detalle => expect(detalle.operacion.operacion.operacion_id).toBe(42));

    http.expectOne('/api/avance-operaciones/operaciones/42').flush({ operacion: { operacion_id: 42 } });
    http.expectOne('/api/avance-operaciones/operaciones/42/bom').flush({ bom: [] });
    const avances = http.expectOne(r => r.url === '/api/avance-operaciones/operaciones/42/avances');
    expect(avances.request.params.get('pagina')).toBe('1');
    expect(avances.request.params.get('limite')).toBe('5');
    avances.flush({ avances: [], paginacion: { pagina: 1, limite: 5, total: 0 } });
    const consumos = http.expectOne(r => r.url === '/api/avance-operaciones/operaciones/42/consumos');
    expect(consumos.request.params.get('pagina')).toBe('1');
    expect(consumos.request.params.get('limite')).toBe('10');
    consumos.flush({ consumos: [], paginacion: { pagina: 1, limite: 10, total: 0 } });
  });
});
