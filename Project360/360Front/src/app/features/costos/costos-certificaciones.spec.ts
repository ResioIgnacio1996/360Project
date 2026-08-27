import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { CostosService } from '../../core/services/costos/costos.service';
import { CostosCertificaciones } from './costos-certificaciones';

class CostosServiceMock {
  ultimoPreview: any;
  ultimoPreviewResponsable: any;
  permisos = () => of([
    'COSTOS_VER', 'ECONOMIA_OPERACION_EDITAR', 'CERTIFICADO_CLIENTE_PREVIEW',
    'CERTIFICADO_CLIENTE_EMITIR', 'CERTIFICADO_CLIENTE_VER', 'CERTIFICADO_CLIENTE_ELIMINAR',
    'CERTIFICADO_RESPONSABLE_PREVIEW','CERTIFICADO_RESPONSABLE_EMITIR','CERTIFICADO_RESPONSABLE_VER','CERTIFICADO_RESPONSABLE_ELIMINAR',
    'MOVIMIENTO_FINANCIERO_VER', 'MOVIMIENTO_FINANCIERO_CREAR', 'MOVIMIENTO_FINANCIERO_ANULAR'
  ]);
  economia = () => of({
    proyecto: { proyecto_id: 8, nombre: 'IRE001', estado: 'ACTIVO', cliente_nombre: 'Cliente' },
    operaciones: [
      { operacion_id: 1, responsable_id:10, responsable_nombre:'Contratista A', secuencia: 100, nombre: 'Operación 100', etapa_nombre: 'Etapa A', pct_avance_actual: 20, precio_cliente: 1000, costo_responsable: 500 },
      { operacion_id: 2, responsable_id:10, responsable_nombre:'Contratista A', secuencia: 200, nombre: 'Operación 200', etapa_nombre: 'Etapa A', pct_avance_actual: 0, precio_cliente: 2000, costo_responsable: 900 }
    ]
  });
  certificados = () => of([{ certificado_cliente_id: 3, fecha_certificacion: '2026-08-27', total: 8000, total_cobrado: 3000, saldo_cobro: 5000, estado_pago: 'PAGADO_PARCIAL', creado_por_nombre: 'Admin', metodo_corte: 'POR_FECHA', estado: 'EMITIDO', es_ultimo_emitido: true }]);
  preview = (_proyectoId: number, corte: any) => {
    this.ultimoPreview = corte;
    return of({ ...corte, operacion_corte: corte.metodo_corte === 'POR_OPERACION' ? { secuencia: 200, nombre: 'Operación 200' } : null, lineas: [] });
  };
  previewImportacion = () => of({ filas: [], total_filas: 0, filas_validas: 0, filas_con_error: 0, filas_con_cambios: 0 });
  importarCostos = () => of({ message: 'OK', operaciones_actualizadas: 0 });
  actualizarEconomia = () => of({ message: 'OK' });
  historialEconomia = () => of([]);
  emitir = () => of({ certificado_cliente_id: 1 });
  certificado = () => of({ certificado: { certificado_cliente_id: 3, fecha_certificacion: '2026-08-27', total: 8000, total_cobrado: 3000, saldo_cobro: 5000, estado_pago: 'PAGADO_PARCIAL', creado_por_nombre: 'Admin', metodo_corte: 'POR_FECHA', es_ultimo_emitido: true }, etapas: [{ etapa_id: 1, etapa_nombre: 'Etapa A', porcentaje_certificado: 70 }], detalles: [], pagos:[{movimiento_id:1,fecha:'2026-08-25',importe:3000,medio_pago:'TRANSFERENCIA',referencia:'TRX-1'}] });
  eliminarCertificado = () => of({ certificado_anterior_vigente: { certificado_cliente_id: 2 } });
  previewResponsable = (_proyectoId:number,corte:any) => {this.ultimoPreviewResponsable=corte;return of({...corte,responsable:{responsable_id:10,nombre:'Contratista A'},lineas:[]});};
  emitirResponsable = () => of({certificado_responsable_id:9});
  certificadosResponsable = () => of([{certificado_responsable_id:9,responsable_id:10,responsable_nombre:'Contratista A',fecha_certificacion:'2026-08-25',total:400,total_pagado:100,saldo_pago:300,estado_pago:'PAGADO_PARCIAL',metodo_corte:'POR_FECHA',estado:'EMITIDO',es_ultimo_emitido:true}]);
  certificadoResponsable = () => of({certificado:{certificado_responsable_id:9,responsable_nombre:'Contratista A',fecha_certificacion:'2026-08-25',total:400,total_pagado:100,saldo_pago:300,estado_pago:'PAGADO_PARCIAL',metodo_corte:'POR_FECHA',es_ultimo_emitido:true},etapas:[],detalles:[],pagos:[]});
  eliminarCertificadoResponsable = () => of({certificado_anterior_vigente:null});
  movimientos = () => of({resumen:{ingresos:3000,egresos:500,saldo:2500},movimientos:[{movimiento_id:1,tipo:'INGRESO',fecha:'2026-08-25',importe:3000,descripcion:'Cobro',vinculo_tipo:'CERTIFICADO_CLIENTE',certificado_cliente_id:3,medio_pago:'TRANSFERENCIA',referencia:'TRX-1',estado:'ACTIVO'}],certificados_cliente:[],registros_compra:[],certificados_responsable:[{certificado_responsable_id:9,responsable_nombre:'Contratista A',saldo:300,estado_pago:'PAGADO_PARCIAL'}]});
  crearMovimiento = () => of({message:'Movimiento registrado correctamente',movimiento_id:2});
  anularMovimiento = () => of({message:'Movimiento anulado correctamente'});
}

describe('CostosCertificaciones', () => {
  let fixture: ComponentFixture<CostosCertificaciones>;
  let component: CostosCertificaciones;
  let api: CostosServiceMock;

  beforeEach(async () => {
    api = new CostosServiceMock();
    await TestBed.configureTestingModule({
      imports: [CostosCertificaciones],
      providers: [
        { provide: CostosService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '8' } } } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(CostosCertificaciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('muestra nombres y boton CSV acordados', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(texto).toContain('Costos Operaciones');
    expect(texto).toContain('Certificación a Cliente');
    expect(texto).toContain('AVANCE CLIENTE');
    expect(texto).toContain('AVANCE RESPONSABLE');
    expect(texto).toContain('CRONOGRAMA CERT. CLIENTE');
    expect(texto).toContain('N° CERT. CLIENTE');
    expect(texto).toContain('Cargar CSV');
  });

  it('envia corte por operacion con fecha documental y operacion elegida', () => {
    component.metodoCorte = 'POR_OPERACION';
    component.operacionCorteId = 2;
    component.fecha = '2026-08-24';
    component.generarPreview();
    expect(api.ultimoPreview).toEqual({
      metodo_corte: 'POR_OPERACION',
      fecha_certificacion: '2026-08-24',
      operacion_corte_id: 2
    });
  });

  it('diferencia visualmente lineas con delta y sin delta', async () => {
    component.previewData = {
      metodo_corte: 'POR_FECHA',
      lineas: [
        { operacion_id: 1, secuencia: 100, nombre: 'A', etapa_nombre: 'Etapa', avance_fisico_referencia: 20, porcentaje_anterior: 20, porcentaje_actual: 20, porcentaje_sugerido: 20, delta: 0, precio_cliente: 1000, importe: 0 },
        { operacion_id: 2, secuencia: 200, nombre: 'B', etapa_nombre: 'Etapa', avance_fisico_referencia: 30, porcentaje_anterior: 10, porcentaje_actual: 30, porcentaje_sugerido: 30, delta: 20, precio_cliente: 2000, importe: 400 }
      ]
    };
    const botones = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav button'));
    (botones.find(boton => boton.textContent?.includes('Certificación a Cliente')) as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('tr.sin-delta').length).toBe(1);
    expect(raiz.querySelectorAll('tr.con-delta').length).toBe(1);
    expect(raiz.textContent).toContain('SIN DELTA');
    expect(raiz.textContent).toContain('A CERTIFICAR');
  });

  it('ofrece borrado auditado solamente para el ultimo certificado', async () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const tabs = Array.from(raiz.querySelectorAll('nav button'));
    (tabs.find(item => item.textContent?.includes('Certificados emitidos')) as HTMLButtonElement).click();
    await fixture.whenStable();
    (raiz.querySelector('.cert-card') as HTMLButtonElement).click();
    await fixture.whenStable();
    const boton = Array.from(raiz.querySelectorAll('button')).find(item => item.textContent?.includes('Eliminar certificado')) as HTMLButtonElement;
    expect(boton).toBeTruthy();
    boton.click();
    await fixture.whenStable();
    expect(raiz.textContent).toContain('ELIMINACIÓN AUDITADA');
    expect(raiz.textContent).toContain('Motivo obligatorio'.toUpperCase());
  });

  it('muestra un tachito en la card y abre la confirmacion sin entrar al detalle', async () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const tabs = Array.from(raiz.querySelectorAll('nav button'));
    (tabs.find(item => item.textContent?.includes('Certificados emitidos')) as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    const tachito = raiz.querySelector('.cert-trash') as HTMLButtonElement;
    expect(tachito).toBeTruthy();
    expect(tachito.getAttribute('aria-label')).toContain('Eliminar certificado #3');
    tachito.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(raiz.textContent).toContain('ELIMINACIÓN AUDITADA');
  });

  it('muestra en el certificado el porcentaje ponderado por etapa', async () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const tabs = Array.from(raiz.querySelectorAll('nav button'));
    (tabs.find(item => item.textContent?.includes('Certificados emitidos')) as HTMLButtonElement).click();
    await fixture.whenStable();
    (raiz.querySelector('.cert-card') as HTMLButtonElement).click();
    await fixture.whenStable();
    const texto = raiz.textContent || '';
    expect(texto).toContain('PORCENTAJE CERTIFICADO POR ETAPA');
    expect(texto).toContain('Etapa A');
    expect(texto).toContain('70.0%');
  });

  it('muestra el tab financiero y el estado de pago parcial', async () => {
    const raiz=fixture.nativeElement as HTMLElement;
    const tabs=Array.from(raiz.querySelectorAll('nav button'));
    (tabs.find(item=>item.textContent?.includes('Ingresos y Egresos')) as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(raiz.textContent).toContain('Ingresos y egresos manuales');
    expect(raiz.textContent).toContain('2,500.0');
    (tabs.find(item=>item.textContent?.includes('Certificados emitidos')) as HTMLButtonElement).click();
    await fixture.whenStable();
    (raiz.querySelector('.cert-card') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(raiz.textContent).toContain('PAGADO PARCIAL');
    expect(raiz.textContent).toContain('TRX-1');
  });

  it('genera preview del contratista filtrando responsable y corte', () => {
    component.responsableId=10;
    component.metodoCorteResponsable='POR_OPERACION';
    component.operacionCorteResponsableId=2;
    component.fechaResponsable='2026-08-25';
    component.generarPreviewResponsable();
    expect(api.ultimoPreviewResponsable).toEqual({responsable_id:10,metodo_corte:'POR_OPERACION',fecha_certificacion:'2026-08-25',operacion_corte_id:2});
  });

  it('muestra certificados a contratistas y habilita su egreso', async () => {
    const raiz=fixture.nativeElement as HTMLElement;
    const tabs=Array.from(raiz.querySelectorAll('nav button'));
    (tabs.find(item=>item.textContent?.includes('Certificados Contratistas')) as HTMLButtonElement).click();
    await fixture.whenStable();fixture.detectChanges();
    expect(raiz.textContent).toContain('Contratista A');
    expect(raiz.textContent).toContain('PAGADO PARCIAL');
    (tabs.find(item=>item.textContent?.includes('Ingresos y Egresos')) as HTMLButtonElement).click();
    await fixture.whenStable();fixture.detectChanges();
    (Array.from(raiz.querySelectorAll('button')).find(item=>item.textContent?.includes('Nuevo movimiento')) as HTMLButtonElement).click();
    await fixture.whenStable();fixture.detectChanges();
    const tipo=raiz.querySelector('select[name="tipoMovimiento"]') as HTMLSelectElement;
    tipo.value='EGRESO';tipo.dispatchEvent(new Event('change'));await fixture.whenStable();fixture.detectChanges();
    expect(raiz.textContent).toContain('Certificado a responsable');
  });
});
