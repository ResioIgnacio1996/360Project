const test=require('node:test');
const assert=require('node:assert/strict');
const {construirPanel,clasificarOperacion,diasEntre}=require('../services/PanelGeneral.service');

test('clasifica estados independientes y calcula días corridos',()=>{
  const op={pct_avance_actual:40,fecha_inicio_real:'2026-08-01',fecha_fin_estimada:'2026-08-20',ultima_actualizacion:'2026-08-10'};
  assert.deepEqual(clasificarOperacion(op,'2026-08-31',7),{completa:false,en_curso:true,pendiente:false,atrasada:true,dias_atraso:11,sin_actualizacion:true});
  assert.equal(diasEntre('2026-08-20','2026-08-31'),11);
});

test('construye KPIs ponderados, certificación y sobreconsumo',()=>{
  const operaciones=[
    {operacion_id:1,proyecto_id:9,etapa_id:1,etapa_codigo:'E1',etapa_nombre:'Etapa',etapa_orden:1,etapa_peso_pct:100,secuencia:10,nombre:'A',peso_pct:60,pct_avance_actual:100,fecha_inicio_estimada:'2026-08-01',fecha_fin_estimada:'2026-08-10',fecha_inicio_real:'2026-08-01',fecha_fin_real:'2026-08-09',duracion_hs:9,precio_cliente:600,costo_responsable:300,responsable_id:7,responsable_nombre:'R'},
    {operacion_id:2,proyecto_id:9,etapa_id:1,etapa_codigo:'E1',etapa_nombre:'Etapa',etapa_orden:1,etapa_peso_pct:100,secuencia:20,nombre:'B',peso_pct:40,pct_avance_actual:50,fecha_inicio_estimada:'2026-08-11',fecha_fin_estimada:'2026-08-20',fecha_inicio_real:'2026-08-11',duracion_hs:9,precio_cliente:400,costo_responsable:200,responsable_id:7,responsable_nombre:'R',ultima_actualizacion:'2026-08-30'}];
  const panel=construirPanel({proyecto:{proyecto_id:9},operaciones,dependencias:[],calendario:null,excepciones:[],certificados_cliente:[{operacion_id:1,importe:500}],certificados_responsable:[{operacion_id:1,responsable_id:7,importe:250}],consumos:[{bom_id:1,operacion_id:2,proyecto_id:9,secuencia:20,responsable_id:7,cantidad_teorica:10,cantidad_consumida:12,material_nombre:'M',uom_codigo:'UN'}]},{fecha_corte:'2026-08-31',ventana_dias:30});
  assert.equal(panel.kpis.avance_fisico_ponderado,80);
  assert.equal(panel.kpis.pct_certificado_cliente,50);
  assert.equal(panel.kpis.pendiente_certificar,30);
  assert.equal(panel.kpis.operaciones_atrasadas,1);
  assert.equal(panel.sobreconsumos.lineas_bom_excedidas,1);
  assert.equal(panel.responsables[0].avance,75);
  assert.ok(panel.alarmas.some(a=>a.codigo==='OP_ATRASADA'));
  assert.ok(panel.alarmas.some(a=>a.codigo==='SOBRECONSUMO_CRITICO'));
});
