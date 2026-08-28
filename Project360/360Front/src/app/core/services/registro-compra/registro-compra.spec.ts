import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RegistroCompraService } from './registro-compra';

describe('RegistroCompraService paginado', () => {
  let service: RegistroCompraService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
    service=TestBed.inject(RegistroCompraService);
    http=TestBed.inject(HttpTestingController);
  });
  afterEach(()=>http.verify());

  it('envia la consulta completa y conserva el envelope del servidor', () => {
    let resultado:any;
    service.getRegistrosPaginados({page:2,pageSize:25,search:'acero',sort:'fecha',direction:'desc'}).subscribe(r=>resultado=r);
    const req=http.expectOne(r=>r.url==='/api/registro-compra');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('25');
    expect(req.request.params.get('search')).toBe('acero');
    req.flush({data:[{registro_compra_id:7,numero:'OC-7'}],page:{index:2,size:25,total:80,totalPages:4}});
    expect(resultado.page.total).toBe(80);
    expect(resultado.data[0].idRegistroCompra).toBe(7);
  });

  it('acepta la respuesta array anterior', () => {
    let resultado:any;
    service.getRegistrosPaginados({page:0,pageSize:10}).subscribe(r=>resultado=r);
    http.expectOne(r=>r.url==='/api/registro-compra').flush([{registro_compra_id:1,numero:'OC-1'}]);
    expect(resultado.data.length).toBe(1);
    expect(resultado.page.total).toBe(1);
  });
});
