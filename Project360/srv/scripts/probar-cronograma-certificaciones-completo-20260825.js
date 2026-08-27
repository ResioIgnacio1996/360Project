require('dotenv').config();
const fs=require('fs');const path=require('path');
const {conectarDB}=require('../DB/dbConection');
const importacion=require('../services/ImportacionCostos.service');
const economia=require('../services/EconomiaOperacion.service');

const PROYECTO_ID=7;
const archivo=path.resolve(__dirname,'../../output/CSV_PRUEBA_COMPLETA_CRONOGRAMA_TEST1_20260825.csv');

(async()=>{const pool=await conectarDB();try{
  const inicial=await pool.request().query(`SELECT COUNT(*) operaciones,
    SUM(CASE WHEN precio_cliente=0 AND costo_responsable=0 THEN 1 ELSE 0 END) economia_cero,
    SUM(CASE WHEN cronograma_certificacion_fecha IS NULL AND numero_certificado_planificado IS NULL THEN 1 ELSE 0 END) sin_plan
    FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
    WHERE o.proyecto_id=${PROYECTO_ID} AND ISNULL(o.archivada,0)=0;
    SELECT COUNT(*) cantidad FROM HistorialCronogramaCertificacionOperacion h JOIN Operacion o ON o.operacion_id=h.operacion_id WHERE o.proyecto_id=${PROYECTO_ID};
    SELECT COUNT(*) cantidad FROM HistorialEconomiaOperacion h JOIN Operacion o ON o.operacion_id=h.operacion_id WHERE o.proyecto_id=${PROYECTO_ID};
    SELECT TOP 1 usuario_id FROM Usuario WHERE UPPER(usuario)='IRE';`);
  const base=inicial.recordsets[0][0];
  if(Number(base.operaciones)!==23||Number(base.economia_cero)!==23||Number(base.sin_plan)!==23)throw new Error(`TEST1 ya no esta limpio: ${JSON.stringify(base)}`);
  const usuarioId=Number(inicial.recordsets[3][0]?.usuario_id);if(!usuarioId)throw new Error('Usuario auditor IRE no encontrado');

  const casosInvalidos={
    secuencia_repetida:'secuencia,precio_cliente,costo_responsable,cronograma_certificacion,nro_certificado_planificado\n100,10,5,2026-09-15,1\n100,10,5,2026-09-15,1',
    fecha_inconsistente:'secuencia,precio_cliente,costo_responsable,cronograma_certificacion,nro_certificado_planificado\n100,10,5,2026-09-15,9\n200,10,5,2026-10-15,9'
  };
  const rechazos={};
  for(const [nombre,contenido] of Object.entries(casosInvalidos)){
    const preview=await importacion.previsualizar(pool,PROYECTO_ID,contenido);
    if(!preview.filas_con_error)throw new Error(`${nombre} no fue detectado en preview`);
    try{await importacion.importar(pool,PROYECTO_ID,contenido,usuarioId);rechazos[nombre]='NO_RECHAZADO';}
    catch(e){rechazos[nombre]=e.status===422?'RECHAZADO_422':`ERROR_${e.status||500}`;}
  }
  const trasInvalidos=await pool.request().query(`SELECT COUNT(*) modificadas FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1 WHERE o.proyecto_id=${PROYECTO_ID} AND ISNULL(o.archivada,0)=0 AND (precio_cliente<>0 OR costo_responsable<>0 OR cronograma_certificacion_fecha IS NOT NULL OR numero_certificado_planificado IS NOT NULL)`);
  if(Number(trasInvalidos.recordset[0].modificadas)!==0)throw new Error('Un CSV invalido modifico TEST1');

  const contenido=fs.readFileSync(archivo,'utf8');
  const preview=await importacion.previsualizar(pool,PROYECTO_ID,contenido);
  if(preview.total_filas!==23||preview.filas_validas!==23||preview.filas_con_error!==0||preview.filas_con_cambios!==23)throw new Error(`Preview valido inesperado: ${JSON.stringify(preview)}`);
  const resultado=await importacion.importar(pool,PROYECTO_ID,contenido,usuarioId);

  const verificacion=await pool.request().query(`SELECT o.secuencia,o.precio_cliente,o.costo_responsable,
    CONVERT(varchar(10),o.cronograma_certificacion_fecha,23) fecha,o.numero_certificado_planificado numero
    FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
    WHERE o.proyecto_id=${PROYECTO_ID} AND ISNULL(o.archivada,0)=0 ORDER BY o.secuencia;
    SELECT numero_certificado_planificado numero,CONVERT(varchar(10),MIN(cronograma_certificacion_fecha),23) fecha,
      COUNT(*) operaciones,COUNT(DISTINCT CONVERT(varchar(10),cronograma_certificacion_fecha,23)) fechas_distintas
    FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
    WHERE o.proyecto_id=${PROYECTO_ID} AND ISNULL(o.archivada,0)=0 GROUP BY numero_certificado_planificado ORDER BY numero;
    SELECT COUNT(*) cantidad FROM HistorialCronogramaCertificacionOperacion h JOIN Operacion o ON o.operacion_id=h.operacion_id WHERE o.proyecto_id=${PROYECTO_ID};
    SELECT COUNT(*) cantidad FROM HistorialEconomiaOperacion h JOIN Operacion o ON o.operacion_id=h.operacion_id WHERE o.proyecto_id=${PROYECTO_ID};
    SELECT COUNT(*) certificados FROM CertificadoCliente WHERE proyecto_id=${PROYECTO_ID};`);
  const ops=verificacion.recordsets[0],planes=verificacion.recordsets[1];
  if(ops.length!==23||ops.some(o=>!o.fecha||!Number.isInteger(Number(o.numero))||Number(o.precio_cliente)<=0||Number(o.costo_responsable)<=0))throw new Error('La persistencia por operacion no coincide con el CSV');
  if(planes.length!==6||planes.some(p=>Number(p.fechas_distintas)!==1))throw new Error(`Agrupacion planificada invalida: ${JSON.stringify(planes)}`);
  const auditoriaCronograma=Number(verificacion.recordsets[2][0].cantidad)-Number(inicial.recordsets[1][0].cantidad);
  const auditoriaEconomia=Number(verificacion.recordsets[3][0].cantidad)-Number(inicial.recordsets[2][0].cantidad);
  if(auditoriaCronograma!==23||auditoriaEconomia!==46)throw new Error(`Auditoria inesperada: cronograma=${auditoriaCronograma}, economia=${auditoriaEconomia}`);
  if(Number(verificacion.recordsets[4][0].certificados)!==0)throw new Error('La planificacion creo certificados reales indebidamente');

  const segundoPreview=await importacion.previsualizar(pool,PROYECTO_ID,contenido);
  if(segundoPreview.filas_con_cambios!==0)throw new Error('La segunda carga identica no es idempotente');
  const legacy='secuencia,precio_cliente,costo_responsable\n100,1500.0000,600.0000';
  const previewLegacy=await importacion.previsualizar(pool,PROYECTO_ID,legacy);
  if(previewLegacy.filas_con_cambios!==0||previewLegacy.filas[0].cambia_cronograma)throw new Error('El CSV anterior altera el cronograma');
  const respuestaEconomia=await economia.listar(pool,PROYECTO_ID);
  if(respuestaEconomia.operaciones.length!==23||respuestaEconomia.operaciones.some(o=>!o.cronograma_certificacion_fecha||!o.numero_certificado_planificado))throw new Error('La API de economia no devuelve el cronograma');

  console.log(JSON.stringify({proyecto:{proyecto_id:7,nombre:'TEST1'},archivo,preview:{filas:23,validas:23,errores:0,cambios:23},rechazos,importacion:resultado,certificados_planificados:planes,auditoria:{cronograma:auditoriaCronograma,economia:auditoriaEconomia},segunda_carga:'0 cambios',csv_legacy:'conserva cronograma',certificados_reales_creados:0,api_economia:'23 operaciones con planificacion'},null,2));
}finally{await pool.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
