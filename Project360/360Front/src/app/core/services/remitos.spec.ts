import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Remitos } from './remitos';

describe('Remitos paginados', () => {
  let service:Remitos;
  let http:HttpTestingController;
  beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});service=TestBed.inject(Remitos);http=TestBed.inject(HttpTestingController);});
  afterEach(()=>http.verify());

  it('envia filtros y normaliza el envelope',()=>{
    let resultado:any;
    service.getRemitosPaginados({page:1,pageSize:50,estado:'PENDIENTE',sort:'numero',direction:'asc'}).subscribe(r=>resultado=r);
    const req=http.expectOne(r=>r.url==='/api/remitos');
    expect(req.request.params.get('estado')).toBe('PENDIENTE');
    expect(req.request.params.get('pageSize')).toBe('50');
    req.flush({data:[{remito_id:4,numero:'R-4'}],page:{index:1,size:50,total:51,totalPages:2}});
    expect(resultado.data[0].idRemito).toBe(4);
    expect(resultado.page.total).toBe(51);
  });

  it('acepta arrays en el endpoint filtrado por compra',()=>{
    let resultado:any;
    service.getRemitosRegistroCompraPaginados(9,{page:0,pageSize:10}).subscribe(r=>resultado=r);
    http.expectOne(r=>r.url==='/api/remitos/registro-compra/9').flush([{remito_id:2,numero:'R-2'}]);
    expect(resultado.data.length).toBe(1);
    expect(resultado.page.total).toBe(1);
  });
});
