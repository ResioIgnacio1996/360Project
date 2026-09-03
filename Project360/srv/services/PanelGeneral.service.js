const { sql } = require('../DB/dbConection');
const { construirProgramacion, fechaISO } = require('./ProgramacionFechas.service');
const CostosDashboard = require('./CostosDashboard.service');

const numero = valor => Number(valor || 0);
const redondear = (valor, decimales = 2) => Number(numero(valor).toFixed(decimales));
const porcentaje = (valor, base) => numero(base) > 0 ? redondear(numero(valor) * 100 / numero(base)) : null;
const diasEntre = (desde, hasta) => desde && hasta
  ? Math.round((Date.parse(`${fechaISO(hasta)}T00:00:00Z`) - Date.parse(`${fechaISO(desde)}T00:00:00Z`)) / 86400000)
  : null;
const maxFecha = valores => valores.filter(Boolean).map(fechaISO).sort().at(-1) || null;

function clasificarOperacion(op, fechaCorte, ventanaSinActualizacion) {
  const avance = numero(op.pct_avance_actual);
  const completa = Boolean(op.fecha_fin_real) || avance >= 100;
  const enCurso = !completa && (Boolean(op.fecha_inicio_real) || (avance > 0 && avance < 100));
  const pendiente = !completa && !op.fecha_inicio_real && avance <= 0;
  const atrasada = !completa && Boolean(op.fecha_fin_estimada) && fechaISO(op.fecha_fin_estimada) < fechaCorte;
  const diasAtraso = atrasada ? Math.max(0, diasEntre(op.fecha_fin_estimada, fechaCorte)) : 0;
  const sinActualizacion = enCurso && (!op.ultima_actualizacion || diasEntre(op.ultima_actualizacion, fechaCorte) > ventanaSinActualizacion);
  return { completa, en_curso: enCurso, pendiente, atrasada, dias_atraso: diasAtraso, sin_actualizacion: sinActualizacion };
}

function alarma(codigo, severidad, titulo, descripcion, fechaCorte, extra = {}) {
  return { codigo, severidad, titulo, descripcion, fecha_deteccion: fechaCorte, ...extra };
}

function construirPanel(datos, filtros = {}) {
  const fechaCorte = filtros.fecha_corte;
  const ventana = filtros.ventana_dias || 30;
  const sinActualizarDias = filtros.sin_actualizacion_dias || 7;
  const umbralSobreconsumo = filtros.umbral_sobreconsumo || 20;
  const calidad = { advertencias: [], registros_excluidos: [], kpis_incompletos: [] };
  const operacionesBase = datos.operaciones || [];
  const operaciones = operacionesBase.filter(op =>
    (!filtros.etapa_id || Number(op.etapa_id) === filtros.etapa_id) &&
    (!filtros.responsable_id || Number(op.responsable_id) === filtros.responsable_id));
  const ids = new Set(operaciones.map(op => Number(op.operacion_id)));
  const dependencias = datos.dependencias || [];
  const programadasTodas = construirProgramacion(operacionesBase.map(op => ({
    ...op,
    dependencias: dependencias.filter(d => Number(d.operacion_id) === Number(op.operacion_id))
      .map(d => d.operacion_predecesora_id).join(',')
  })), datos.calendario || null, datos.excepciones || []);
  const programadas = programadasTodas.filter(op => ids.has(Number(op.operacion_id)));
  const mapa = new Map(programadasTodas.map(op => [Number(op.operacion_id), op]));
  const estados = programadas.map(op => {
    const base = clasificarOperacion(op, fechaCorte, sinActualizarDias);
    const preds = dependencias.filter(d => Number(d.operacion_id) === Number(op.operacion_id));
    const bloqueada = !base.completa && preds.some(d => {
      const pred = mapa.get(Number(d.operacion_predecesora_id));
      return pred && !(pred.fecha_fin_real || numero(pred.pct_avance_actual) >= 100);
    });
    return { ...op, ...base, bloqueada };
  });

  const etapasBase = new Map();
  for (const op of operacionesBase) {
    const etapaId=Number(op.etapa_id);
    if(!etapasBase.has(etapaId))etapasBase.set(etapaId,{peso_etapa:numero(op.etapa_peso_pct),peso_operaciones:0});
    etapasBase.get(etapaId).peso_operaciones+=numero(op.peso_pct);
  }
  const sumaPesosEtapas=[...etapasBase.values()].reduce((s,e)=>s+e.peso_etapa,0);
  if(Math.abs(sumaPesosEtapas-100)>.1)calidad.advertencias.push({codigo:'PESOS_ETAPAS_NO_TOTALIZAN_100',mensaje:`Los pesos de las etapas suman ${redondear(sumaPesosEtapas)}%.`});
  for(const [etapaId,etapa] of etapasBase)if(Math.abs(etapa.peso_operaciones-100)>.1)calidad.advertencias.push({codigo:'PESOS_OPERACIONES_NO_TOTALIZAN_100',etapa_id:etapaId,mensaje:`Los pesos de operaciones de la etapa ${etapaId} suman ${redondear(etapa.peso_operaciones)}%.`});
  const avanceEtapasFiltro=new Map();
  for(const op of operaciones)avanceEtapasFiltro.set(Number(op.etapa_id),numero(avanceEtapasFiltro.get(Number(op.etapa_id)))+numero(op.pct_avance_actual)*numero(op.peso_pct)/100);
  const avanceFisico=redondear([...avanceEtapasFiltro].reduce((s,[etapaId,avance])=>s+avance*numero(operaciones.find(op=>Number(op.etapa_id)===etapaId)?.etapa_peso_pct)/100,0));
  const sinFechas = operaciones.filter(op => !op.fecha_fin_estimada);
  if (sinFechas.length) calidad.registros_excluidos.push({ kpi:'dias_desvio_cronograma',cantidad:sinFechas.length,causa:'SIN_FECHA_FIN_ESTIMADA' });
  const baseline = maxFecha(operaciones.map(op => op.fecha_fin_estimada));
  const reprogramada = maxFecha(programadas.map(op => op.fecha_fin_reprog));
  const diasDesvio = diasEntre(baseline, reprogramada);
  const diasRestantes = diasEntre(fechaCorte, reprogramada);

  const certCliente = (datos.certificados_cliente || []).filter(x => ids.has(Number(x.operacion_id))).reduce((s, x) => s + numero(x.importe), 0);
  const certResponsable = (datos.certificados_responsable || []).filter(x => ids.has(Number(x.operacion_id))).reduce((s, x) => s + numero(x.importe), 0);
  const presupuesto = operaciones.reduce((s, op) => s + (op.precio_cliente == null ? 0 : numero(op.precio_cliente)), 0);
  const costo = operaciones.reduce((s, op) => s + (op.costo_responsable == null ? 0 : numero(op.costo_responsable)), 0);
  const pctCliente = porcentaje(certCliente, presupuesto);
  const pctResponsables = porcentaje(certResponsable, costo);
  if (!presupuesto) calidad.kpis_incompletos.push({ kpi: 'pct_certificado_cliente', causa: 'SIN_PLANIFICACION' });
  if (!costo) calidad.kpis_incompletos.push({ kpi: 'pct_certificado_responsables', causa: 'SIN_PLANIFICACION' });

  const consumos = (datos.consumos || []).filter(x => ids.has(Number(x.operacion_id))).map(x => {
    const teorica = x.cantidad_teorica == null ? null : numero(x.cantidad_teorica);
    const consumida = numero(x.cantidad_consumida);
    const sinBase = !(teorica > 0);
    return { ...x, cantidad_teorica: teorica, cantidad_consumida: consumida, sin_base_teorica: sinBase,
      sobreconsumo: !sinBase && consumida > teorica,
      sobreconsumo_pct: !sinBase && consumida > teorica ? redondear((consumida - teorica) * 100 / teorica) : null };
  });
  const excedidos = consumos.filter(x => x.sobreconsumo).sort((a, b) => numero(b.sobreconsumo_pct) - numero(a.sobreconsumo_pct));
  const operacionesSobreconsumo = new Set(excedidos.map(x => Number(x.operacion_id))).size;
  const sinBom = new Set(operaciones.filter(op => !consumos.some(c => Number(c.operacion_id) === Number(op.operacion_id))).map(op => op.operacion_id));
  if (sinBom.size) calidad.advertencias.push({ codigo: 'OPERACIONES_SIN_BOM', cantidad: sinBom.size, mensaje: `${sinBom.size} operaciones no tienen BOM.` });
  const sinResponsable = operaciones.filter(op => !op.responsable_id);
  if (sinResponsable.length) calidad.advertencias.push({ codigo: 'OPERACIONES_SIN_RESPONSABLE', cantidad: sinResponsable.length, mensaje: `${sinResponsable.length} operaciones no tienen responsable.` });
  const economiaIncompleta = operaciones.filter(op => op.precio_cliente == null || op.costo_responsable == null);
  if (economiaIncompleta.length) calidad.advertencias.push({ codigo: 'ECONOMIA_INCOMPLETA', cantidad: economiaIncompleta.length, mensaje: `${economiaIncompleta.length} operaciones tienen economía incompleta.` });
  if (numero(datos.certificados_anulados)) calidad.registros_excluidos.push({ fuente:'Certificado',cantidad:numero(datos.certificados_anulados),causa:'ANULADO' });
  if (numero(datos.consumos_anulados)) calidad.registros_excluidos.push({ fuente:'ConsumoMaterialOperacion',cantidad:numero(datos.consumos_anulados),causa:'ANULADO' });

  const etapasMapa = new Map();
  for (const op of estados) {
    const id = Number(op.etapa_id);
    if (!etapasMapa.has(id)) etapasMapa.set(id, { etapa_id: id, codigo: op.etapa_codigo, nombre: op.etapa_nombre, orden: numero(op.etapa_orden), avance_real: 0, peso_operaciones: 0, fecha_fin_estimada: null, fecha_fin_reprog: null });
    const etapa = etapasMapa.get(id);
    etapa.avance_real += numero(op.pct_avance_actual) * numero(op.peso_pct) / 100;
    etapa.peso_operaciones += numero(op.peso_pct);
    etapa.fecha_fin_estimada = maxFecha([etapa.fecha_fin_estimada, op.fecha_fin_estimada]);
    etapa.fecha_fin_reprog = maxFecha([etapa.fecha_fin_reprog, op.fecha_fin_reprog]);
  }
  const avancePorEtapa = [...etapasMapa.values()].map(e => ({ ...e, avance_real: redondear(e.avance_real), dias_desvio: diasEntre(e.fecha_fin_estimada, e.fecha_fin_reprog) })).sort((a,b) => a.orden-b.orden);

  const responsablesMapa = new Map();
  for (const op of estados.filter(x => x.responsable_id)) {
    const id = Number(op.responsable_id);
    if (!responsablesMapa.has(id)) responsablesMapa.set(id, { responsable_id: id, nombre: op.responsable_nombre, operaciones: [], costo_contratado: 0 });
    const r = responsablesMapa.get(id); r.operaciones.push(op); r.costo_contratado += numero(op.costo_responsable);
  }
  const responsables = [...responsablesMapa.values()].map(r => {
    const atrasadas = r.operaciones.filter(x => x.atrasada);
    const certificado = (datos.certificados_responsable || []).filter(x => Number(x.responsable_id) === r.responsable_id && ids.has(Number(x.operacion_id))).reduce((s,x) => s+numero(x.importe),0);
    return { responsable_id:r.responsable_id,nombre:r.nombre,operaciones_asignadas:r.operaciones.length,
      completas:r.operaciones.filter(x=>x.completa).length,en_curso:r.operaciones.filter(x=>x.en_curso).length,atrasadas:atrasadas.length,
      avance: redondear(r.operaciones.reduce((s,x)=>s+numero(x.pct_avance_actual),0)/r.operaciones.length),
      dias_atraso_promedio: atrasadas.length ? redondear(atrasadas.reduce((s,x)=>s+x.dias_atraso,0)/atrasadas.length,1) : 0,
      sobreconsumos: excedidos.filter(x=>Number(x.responsable_id)===r.responsable_id).length,
      costo_contratado:redondear(r.costo_contratado,4),certificado_responsable:redondear(certificado,4) };
  }).sort((a,b)=>b.atrasadas-a.atrasadas || String(a.nombre).localeCompare(String(b.nombre)));

  const alarmas = [];
  for (const op of estados) {
    const referencia = { operacion_id:Number(op.operacion_id), responsable_id:op.responsable_id ? Number(op.responsable_id):null, ruta_accion:`/proyectos/${op.proyecto_id}/avances?operacion=${op.operacion_id}` };
    if (op.atrasada) alarmas.push(alarma('OP_ATRASADA','CRITICA',`Operación ${op.secuencia} atrasada`,`${op.nombre}: ${op.dias_atraso} días de atraso.`,fechaCorte,{...referencia,valor_actual:op.dias_atraso,umbral:0}));
    if (op.bloqueada && op.fecha_inicio_estimada && op.fecha_inicio_estimada < fechaCorte) alarmas.push(alarma('OP_BLOQUEADA_VENCIDA','CRITICA',`Operación ${op.secuencia} bloqueada`,`${op.nombre} debía iniciar el ${op.fecha_inicio_estimada}.`,fechaCorte,referencia));
    if (op.sin_actualizacion) alarmas.push(alarma('OP_SIN_ACTUALIZACION','ADVERTENCIA',`Operación ${op.secuencia} sin actualización`,`${op.nombre} no registra avances recientes.`,fechaCorte,{...referencia,umbral:sinActualizarDias}));
    if (!op.responsable_id) alarmas.push(alarma('OP_SIN_RESPONSABLE','ADVERTENCIA',`Operación ${op.secuencia} sin responsable`,op.nombre,fechaCorte,referencia));
    if (op.precio_cliente == null || op.costo_responsable == null) alarmas.push(alarma('ECONOMIA_INCOMPLETA','ADVERTENCIA',`Economía incompleta en operación ${op.secuencia}`,op.nombre,fechaCorte,referencia));
  }
  for (const x of excedidos.filter(x => numero(x.sobreconsumo_pct) >= umbralSobreconsumo)) alarmas.push(alarma('SOBRECONSUMO_CRITICO','CRITICA',`Sobreconsumo en operación ${x.secuencia}`,`${x.material_nombre || x.descripcion_libre}: ${x.sobreconsumo_pct}% sobre la base.`,fechaCorte,{operacion_id:Number(x.operacion_id),responsable_id:x.responsable_id?Number(x.responsable_id):null,valor_actual:x.sobreconsumo_pct,umbral:umbralSobreconsumo,ruta_accion:`/proyectos/${x.proyecto_id}/avances?operacion=${x.operacion_id}`}));
  if (baseline && baseline < fechaCorte && avanceFisico < 100) alarmas.push(alarma('PROYECTO_VENCIDO','CRITICA','Proyecto con fecha estimada vencida',`El proyecto registra ${avanceFisico}% de avance.`,fechaCorte,{valor_actual:avanceFisico,umbral:100,ruta_accion:`/proyectos/${datos.proyecto.proyecto_id}/programacion`}));
  const criticas = estados.filter(op => op.atrasada || op.sin_actualizacion || !op.responsable_id).map(op => ({
    operacion_id:Number(op.operacion_id),secuencia:op.secuencia,nombre:op.nombre,etapa_nombre:op.etapa_nombre,responsable_nombre:op.responsable_nombre,
    avance:numero(op.pct_avance_actual),fecha_fin_estimada:fechaISO(op.fecha_fin_estimada),dias_atraso:op.dias_atraso,
    causas:[op.atrasada?'ATRASADA':null,op.sin_actualizacion?'SIN_ACTUALIZACION':null,!op.responsable_id?'SIN_RESPONSABLE':null].filter(Boolean)
  })).sort((a,b)=>b.dias_atraso-a.dias_atraso || Number(a.secuencia)-Number(b.secuencia));

  return { proyecto:datos.proyecto,fecha_corte:fechaCorte,filtros_aplicados:{etapa_id:filtros.etapa_id||null,responsable_id:filtros.responsable_id||null,ventana_dias:ventana},
    kpis:{avance_fisico_ponderado:avanceFisico,dias_desvio_cronograma:diasDesvio,fecha_fin_estimada:baseline,fecha_fin_reprog:reprogramada,dias_restantes:diasRestantes,
      pct_certificado_cliente:pctCliente,pct_certificado_responsables:pctResponsables,pendiente_certificar:pctCliente==null?null:redondear(avanceFisico-pctCliente),
      operaciones_con_sobreconsumo:operacionesSobreconsumo,operaciones_completas:estados.filter(x=>x.completa).length,operaciones_en_curso:estados.filter(x=>x.en_curso).length,
      operaciones_pendientes:estados.filter(x=>x.pendiente).length,operaciones_atrasadas:estados.filter(x=>x.atrasada).length},
    avance_por_etapa:avancePorEtapa,operaciones_por_estado:{completas:estados.filter(x=>x.completa).length,en_curso:estados.filter(x=>x.en_curso).length,pendientes:estados.filter(x=>x.pendiente).length,atrasadas:estados.filter(x=>x.atrasada).length},
    responsables,alarmas,operaciones_criticas:criticas,sobreconsumos:{operaciones:operacionesSobreconsumo,lineas_bom_excedidas:excedidos.length,top_excesos:excedidos.slice(0,10)},calidad_datos:calidad};
}

async function obtener(pool, proyectoId, filtros) {
  const r = await pool.request().input('p',sql.BigInt,proyectoId).query(`
    SELECT p.proyecto_id,p.nombre,p.estado,p.fecha_inicio,p.fecha_fin_estimada,p.direccion,COALESCE(NULLIF(c.razon_social,''),LTRIM(RTRIM(CONCAT(c.apellido,' ',c.nombre)))) cliente_nombre
    FROM Proyecto p LEFT JOIN Cliente c ON c.id_cliente=p.cliente_id WHERE p.proyecto_id=@p AND ISNULL(p.eliminado,0)=0;
    SELECT o.*,e.codigo etapa_codigo,e.nombre etapa_nombre,e.orden etapa_orden,e.peso_pct etapa_peso_pct,r.nombre responsable_nombre,
      (SELECT MAX(a.fecha_registro) FROM AvanceOperacion a WHERE a.operacion_id=o.operacion_id) ultima_actualizacion
    FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1 JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id
    LEFT JOIN ResponsableOperacion r ON r.responsable_id=o.responsable_id WHERE o.proyecto_id=@p AND ISNULL(o.archivada,0)=0 ORDER BY o.secuencia;
    SELECT d.operacion_id,d.operacion_predecesora_id FROM OperacionDependencia d JOIN Operacion o ON o.operacion_id=d.operacion_id JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1 WHERE o.proyecto_id=@p;
    SELECT TOP 1 * FROM CalendarioProyecto WHERE proyecto_id=@p;
    SELECT ex.* FROM ExcepcionCalendario ex JOIN CalendarioProyecto cp ON cp.calendario_id=ex.calendario_id WHERE cp.proyecto_id=@p;
    SELECT d.operacion_id,SUM(d.importe) importe FROM CertificadoClienteDetalle d JOIN CertificadoCliente c ON c.certificado_cliente_id=d.certificado_cliente_id WHERE c.proyecto_id=@p AND c.estado='EMITIDO' GROUP BY d.operacion_id;
    SELECT d.operacion_id,c.responsable_id,SUM(d.importe) importe FROM CertificadoResponsableDetalle d JOIN CertificadoResponsable c ON c.certificado_responsable_id=d.certificado_responsable_id WHERE c.proyecto_id=@p AND c.estado='EMITIDO' GROUP BY d.operacion_id,c.responsable_id;
    SELECT b.bom_id,b.operacion_id,b.proyecto_id,b.descripcion_libre,b.cantidad_teorica,u.nombre uom_codigo,m.nombre material_nombre,o.secuencia,o.responsable_id,
      ISNULL(SUM(CASE WHEN ISNULL(cm.anulado,0)=0 THEN cm.cantidad_consumida ELSE 0 END),0) cantidad_consumida
    FROM BomOperacion b JOIN Operacion o ON o.operacion_id=b.operacion_id JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1 JOIN UoM u ON u.uom_id=b.uom_id
    LEFT JOIN Materiales m ON m.id_material=b.material_id LEFT JOIN ConsumoMaterialOperacion cm ON cm.bom_id=b.bom_id
    WHERE b.proyecto_id=@p AND ISNULL(o.archivada,0)=0 GROUP BY b.bom_id,b.operacion_id,b.proyecto_id,b.descripcion_libre,b.cantidad_teorica,u.nombre,m.nombre,o.secuencia,o.responsable_id;
    SELECT COUNT(*) versiones_activas FROM VersionPlan WHERE proyecto_id=@p AND es_activa=1;
    SELECT (SELECT COUNT(*) FROM CertificadoCliente WHERE proyecto_id=@p AND estado<>'EMITIDO')+(SELECT COUNT(*) FROM CertificadoResponsable WHERE proyecto_id=@p AND estado<>'EMITIDO') certificados_anulados,
      (SELECT COUNT(*) FROM ConsumoMaterialOperacion WHERE proyecto_id=@p AND ISNULL(anulado,0)=1) consumos_anulados;
  `);
  if (!r.recordsets[0].length) { const e=new Error('Proyecto no encontrado');e.status=404;throw e; }
  const datos={proyecto:r.recordsets[0][0],operaciones:r.recordsets[1],dependencias:r.recordsets[2],calendario:r.recordsets[3][0]||null,excepciones:r.recordsets[4],certificados_cliente:r.recordsets[5],certificados_responsable:r.recordsets[6],consumos:r.recordsets[7],certificados_anulados:r.recordsets[9][0]?.certificados_anulados,consumos_anulados:r.recordsets[9][0]?.consumos_anulados};
  if (Number(r.recordsets[8][0]?.versiones_activas)!==1) { const e=new Error('El proyecto debe tener exactamente una versión activa del plan');e.status=409;throw e; }
  const panel=construirPanel(datos,filtros);
  const costos=await CostosDashboard.obtener(pool,proyectoId);
  panel.curva_certificacion=costos.curva;
  panel.curva_flujo=[];
  return panel;
}

module.exports={ obtener, construirPanel, clasificarOperacion, diasEntre };
