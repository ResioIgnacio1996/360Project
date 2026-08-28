import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CostosService } from './costos.service';

describe('CostosService listados paginados transparentes',()=>{
  let service:CostosService;let http:HttpTestingController;
  beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});service=TestBed.inject(CostosService);http=TestBed.inject(HttpTestingController);});
  afterEach(()=>http.verify());

  it('acumula todas las paginas de certificados cliente',()=>{
    let resultado:any[]=[];service.certificados(8).subscribe(r=>resultado=r);
    const primera=http.expectOne(r=>r.url==='/api/certificados-cliente/proyectos/8'&&r.params.get('page')==='0');
    primera.flush({data:[{certificado_cliente_id:2}],page:{index:0,size:50,total:51,totalPages:2}});
    const segunda=http.expectOne(r=>r.url==='/api/certificados-cliente/proyectos/8'&&r.params.get('page')==='1');
    segunda.flush({data:[{certificado_cliente_id:1}],page:{index:1,size:50,total:51,totalPages:2}});
    expect(resultado.map(x=>x.certificado_cliente_id)).toEqual([2,1]);
  });

  it('acumula movimientos y conserva resumen y opciones de la primera pagina',()=>{
    let resultado:any;service.movimientos(8).subscribe(r=>resultado=r);
    http.expectOne(r=>r.url==='/api/movimientos-financieros/proyectos/8'&&r.params.get('page')==='0').flush({data:{movimientos:[{movimiento_id:2}],resumen:{saldo:10},certificados_cliente:[{certificado_cliente_id:3}]},page:{index:0,size:50,total:51,totalPages:2}});
    http.expectOne(r=>r.url==='/api/movimientos-financieros/proyectos/8'&&r.params.get('page')==='1').flush({data:{movimientos:[{movimiento_id:1}],resumen:{saldo:10},certificados_cliente:[{certificado_cliente_id:3}]},page:{index:1,size:50,total:51,totalPages:2}});
    expect(resultado.movimientos.map((x:any)=>x.movimiento_id)).toEqual([2,1]);
    expect(resultado.resumen.saldo).toBe(10);
    expect(resultado.certificados_cliente.length).toBe(1);
  });

  it('mantiene compatibilidad si el servidor responde un array legacy',()=>{
    let resultado:any[]=[];service.certificadosResponsable(8).subscribe(r=>resultado=r);
    http.expectOne(r=>r.url==='/api/certificados-responsable/proyectos/8').flush([{certificado_responsable_id:4}]);
    expect(resultado[0].certificado_responsable_id).toBe(4);
  });
});
