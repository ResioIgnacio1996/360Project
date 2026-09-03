const { sql } = require('../DB/dbConection');

const json = (valor, defecto) => { try { return valor ? JSON.parse(valor) : defecto; } catch { return defecto; } };
const fechaTexto = valor => valor ? new Date(valor).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '';
const render = (plantilla, variables) => String(plantilla || '').replace(/\{([^}]+)\}/g, (_, clave) => variables[clave] ?? `{${clave}}`);

async function insertar(pool, alarma) {
  const result = await pool.request()
    .input('proyecto_id', sql.BigInt, alarma.proyecto_id)
    .input('categoria', sql.VarChar(30), alarma.categoria)
    .input('severidad', sql.VarChar(20), alarma.severidad)
    .input('mensaje', sql.NVarChar(500), alarma.mensaje.slice(0, 500))
    .input('recurso_tipo', sql.VarChar(50), alarma.recurso_tipo)
    .input('recurso_id', sql.BigInt, alarma.recurso_id)
    .input('url_destino', sql.NVarChar(500), alarma.url_destino)
    .input('clave', sql.VarChar(250), alarma.clave)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM AlarmaProyecto WITH (UPDLOCK,HOLDLOCK) WHERE proyecto_id=@proyecto_id AND clave_deduplicacion=@clave)
      BEGIN
        INSERT INTO AlarmaProyecto(proyecto_id,categoria,severidad,mensaje,recurso_tipo,recurso_id,url_destino,clave_deduplicacion)
        OUTPUT INSERTED.alarma_id
        VALUES(@proyecto_id,@categoria,@severidad,@mensaje,@recurso_tipo,@recurso_id,@url_destino,@clave)
      END
    `);
  return result.recordset?.length ? 1 : 0;
}

async function evaluarFechas(pool, regla, parametros, entidades, operacionId) {
  const campoInicio = regla.tipo === 'INICIO_PROXIMO';
  const request = pool.request().input('proyecto_id',sql.BigInt,regla.proyecto_id).input('operacion_id',sql.BigInt,operacionId || null);
  const result = await request.query(`
    SELECT o.operacion_id,o.secuencia,o.nombre,
      ${campoInicio ? 'o.fecha_inicio_estimada' : 'o.fecha_fin_estimada'} fecha_objetivo,
      DATEDIFF(DAY,CONVERT(date,GETDATE()),CONVERT(date,${campoInicio ? 'o.fecha_inicio_estimada' : 'o.fecha_fin_estimada'})) dias_restantes
    FROM Operacion o
    WHERE o.proyecto_id=@proyecto_id AND ISNULL(o.archivada,0)=0
      AND o.version_id=(SELECT TOP 1 version_id FROM VersionPlan WHERE proyecto_id=@proyecto_id AND es_activa=1)
      AND (@operacion_id IS NULL OR o.operacion_id=@operacion_id)
  `);
  const seleccionadas=new Set(entidades.map(Number)); let creadas=0;
  for (const op of result.recordset) {
    if (regla.alcance!=='TODAS'&&!seleccionadas.has(Number(op.operacion_id))) continue;
    if (Number(op.dias_restantes)!==Number(parametros.dias)) continue;
    creadas += await insertar(pool,{proyecto_id:regla.proyecto_id,categoria:'OPERACIONES',severidad:'ADVERTENCIA',mensaje:render(regla.mensaje,{nombre:op.nombre,N:parametros.dias,fecha:fechaTexto(op.fecha_objetivo),operacion:`OP-${op.secuencia}`}),recurso_tipo:'OPERACION',recurso_id:op.operacion_id,url_destino:`/proyectos/${regla.proyecto_id}/avances?operacion=${op.operacion_id}`,clave:`REGLA:${regla.regla_id}:OP:${op.operacion_id}:FECHA:${new Date(op.fecha_objetivo).toISOString().slice(0,10)}`});
  }
  return creadas;
}

async function evaluarSobreconsumo(pool, regla, parametros, entidades, operacionId) {
  const result=await pool.request().input('proyecto_id',sql.BigInt,regla.proyecto_id).input('operacion_id',sql.BigInt,operacionId||null).query(`
    SELECT b.bom_id,b.operacion_id,b.cantidad_teorica,COALESCE(m.nombre,b.descripcion_libre) material_nombre,o.nombre operacion_nombre,o.secuencia,u.nombre unidad,
      ISNULL(SUM(CASE WHEN ISNULL(c.anulado,0)=0 THEN c.cantidad_consumida ELSE 0 END),0) cantidad_consumida
    FROM BomOperacion b JOIN Operacion o ON o.operacion_id=b.operacion_id
    LEFT JOIN Materiales m ON m.id_material=b.material_id LEFT JOIN UoM u ON u.uom_id=b.uom_id
    LEFT JOIN ConsumoMaterialOperacion c ON c.bom_id=b.bom_id
    WHERE b.proyecto_id=@proyecto_id AND ISNULL(o.archivada,0)=0 AND (@operacion_id IS NULL OR b.operacion_id=@operacion_id)
    GROUP BY b.bom_id,b.operacion_id,b.cantidad_teorica,m.nombre,b.descripcion_libre,o.nombre,o.secuencia,u.nombre
  `);
  const seleccionadas=new Set(entidades.map(Number)), porcentaje=Number(parametros.porcentaje||100); let creadas=0;
  for(const linea of result.recordset){
    if(regla.alcance!=='TODAS'&&!seleccionadas.has(Number(linea.operacion_id)))continue;
    const teorico=Number(linea.cantidad_teorica),consumido=Number(linea.cantidad_consumida),limite=teorico*porcentaje/100;
    if(!(teorico>0&&consumido>limite))continue;
    creadas+=await insertar(pool,{proyecto_id:regla.proyecto_id,categoria:'OPERACIONES',severidad:'CRITICA',mensaje:render(regla.mensaje,{nombre:`OP-${linea.secuencia} ${linea.operacion_nombre}`,material:linea.material_nombre,porcentaje,N:porcentaje,teorico,consumido,unidad:linea.unidad||''}),recurso_tipo:'OPERACION',recurso_id:linea.operacion_id,url_destino:`/proyectos/${regla.proyecto_id}/avances?operacion=${linea.operacion_id}`,clave:`REGLA:${regla.regla_id}:BOM:${linea.bom_id}:UMBRAL:${porcentaje}`});
  }
  return creadas;
}

async function evaluarBom(pool,regla,parametros,entidades){
  const materialId=Number(entidades[0]); if(!materialId)return 0;
  if(regla.tipo==='STOCK_MINIMO'){
    const r=await pool.request().input('proyecto_id',sql.BigInt,regla.proyecto_id).input('material_id',sql.BigInt,materialId).query(`SELECT m.nombre,u.nombre unidad,ISNULL(SUM(CASE WHEN c.activo=1 THEN c.cantidad_actual ELSE 0 END),0) stock FROM Materiales m LEFT JOIN UoM u ON u.uom_id=m.uom_id LEFT JOIN StockGeneral sg ON sg.id_material=m.id_material LEFT JOIN Container c ON c.stock_general_id=sg.stock_general_id AND c.id_proyecto=@proyecto_id WHERE m.id_material=@material_id GROUP BY m.nombre,u.nombre`);
    if(!r.recordset.length)return 0;const x=r.recordset[0],minimo=Number(parametros.minimo||0);if(!(Number(x.stock)<minimo))return 0;
    return insertar(pool,{proyecto_id:regla.proyecto_id,categoria:'BOM',severidad:'ADVERTENCIA',mensaje:render(regla.mensaje,{material:x.nombre,nombre:x.nombre,stock:Number(x.stock),minimo,unidad:x.unidad||''}),recurso_tipo:'MATERIAL',recurso_id:materialId,url_destino:`/proyectos/${regla.proyecto_id}/stock`,clave:`REGLA:${regla.regla_id}:MATERIAL:${materialId}:MINIMO:${minimo}`});
  }
  if(regla.tipo==='PREAVISO_PEDIDO'){
    const dias=Number(parametros.dias||0),r=await pool.request().input('proyecto_id',sql.BigInt,regla.proyecto_id).input('material_id',sql.BigInt,materialId).query(`SELECT DISTINCT o.operacion_id,o.secuencia,o.nombre operacion_nombre,o.fecha_inicio_estimada,m.nombre material_nombre,DATEDIFF(DAY,CONVERT(date,GETDATE()),CONVERT(date,o.fecha_inicio_estimada)) dias_restantes FROM BomOperacion b JOIN Operacion o ON o.operacion_id=b.operacion_id JOIN Materiales m ON m.id_material=b.material_id WHERE b.proyecto_id=@proyecto_id AND b.material_id=@material_id AND ISNULL(o.archivada,0)=0`);let creadas=0;
    for(const x of r.recordset){if(Number(x.dias_restantes)!==dias)continue;creadas+=await insertar(pool,{proyecto_id:regla.proyecto_id,categoria:'BOM',severidad:'ADVERTENCIA',mensaje:render(regla.mensaje,{material:x.material_nombre,nombre:x.operacion_nombre,N:dias,fecha:fechaTexto(x.fecha_inicio_estimada)}),recurso_tipo:'OPERACION',recurso_id:x.operacion_id,url_destino:`/proyectos/${regla.proyecto_id}/bom`,clave:`REGLA:${regla.regla_id}:MATERIAL:${materialId}:OP:${x.operacion_id}:FECHA:${new Date(x.fecha_inicio_estimada).toISOString().slice(0,10)}`});}return creadas;
  }
  return 0;
}

async function evaluarCertificaciones(pool,regla,parametros,entidades){
  const dias=Number(parametros.dias||0),seleccionadas=new Set(entidades.map(Number));let creadas=0;
  if(regla.tipo==='EMISION_PROXIMA'){
    const r=await pool.request().input('proyecto_id',sql.BigInt,regla.proyecto_id).query(`
      SELECT o.numero_certificado_planificado certificado_numero,MIN(o.cronograma_certificacion_fecha) fecha_prevista,
        COUNT(*) operaciones,DATEDIFF(DAY,CONVERT(date,GETDATE()),MIN(o.cronograma_certificacion_fecha)) dias_restantes
      FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
      WHERE o.proyecto_id=@proyecto_id AND ISNULL(o.archivada,0)=0
        AND o.numero_certificado_planificado IS NOT NULL AND o.cronograma_certificacion_fecha IS NOT NULL
      GROUP BY o.numero_certificado_planificado`);
    for(const x of r.recordset){
      if(regla.alcance!=='TODAS'&&!seleccionadas.has(Number(x.certificado_numero)))continue;
      if(Number(x.dias_restantes)!==dias)continue;
      creadas+=await insertar(pool,{proyecto_id:regla.proyecto_id,categoria:'CERTIFICACIONES',severidad:'ADVERTENCIA',mensaje:render(regla.mensaje,{nombre:`#${x.certificado_numero}`,certificado:`#${x.certificado_numero}`,N:dias,fecha:fechaTexto(x.fecha_prevista),operaciones:x.operaciones}),recurso_tipo:'CERTIFICACION_PLAN_CLIENTE',recurso_id:x.certificado_numero,url_destino:`/proyectos/${regla.proyecto_id}/costos`,clave:`REGLA:${regla.regla_id}:PLAN_CLIENTE:${x.certificado_numero}:FECHA:${new Date(x.fecha_prevista).toISOString().slice(0,10)}`});
    }
    return creadas;
  }
  const cliente=regla.tipo==='SIN_COBRO';
  if(!cliente&&regla.tipo!=='RESPONSABLE_SIN_PAGO')return 0;
  const tabla=cliente?'CertificadoCliente':'CertificadoResponsable',idCampo=cliente?'certificado_cliente_id':'certificado_responsable_id',movCampo=idCampo;
  const r=await pool.request().input('proyecto_id',sql.BigInt,regla.proyecto_id).query(`
    SELECT c.${idCampo} certificado_id,c.fecha_certificacion,c.total,
      ISNULL(SUM(CASE WHEN m.estado='ACTIVO' THEN m.importe ELSE 0 END),0) pagado,
      c.total-ISNULL(SUM(CASE WHEN m.estado='ACTIVO' THEN m.importe ELSE 0 END),0) saldo,
      DATEDIFF(DAY,CONVERT(date,c.fecha_certificacion),CONVERT(date,GETDATE())) dias_mora
    FROM ${tabla} c LEFT JOIN MovimientoFinancieroProyecto m ON m.${movCampo}=c.${idCampo}
    WHERE c.proyecto_id=@proyecto_id AND c.estado='EMITIDO'
    GROUP BY c.${idCampo},c.fecha_certificacion,c.total`);
  for(const x of r.recordset){
    if(regla.alcance!=='TODAS'&&!seleccionadas.has(Number(x.certificado_id)))continue;
    if(!(Number(x.saldo)>0&&Number(x.dias_mora)>dias))continue;
    const recurso=cliente?'CERTIFICADO_CLIENTE':'CERTIFICADO_RESPONSABLE';
    creadas+=await insertar(pool,{proyecto_id:regla.proyecto_id,categoria:'CERTIFICACIONES',severidad:'CRITICA',mensaje:render(regla.mensaje,{nombre:`#${x.certificado_id}`,certificado:`#${x.certificado_id}`,N:dias,dias:x.dias_mora,total:Number(x.total),pagado:Number(x.pagado),saldo:Number(x.saldo)}),recurso_tipo:recurso,recurso_id:x.certificado_id,url_destino:`/proyectos/${regla.proyecto_id}/costos`,clave:`REGLA:${regla.regla_id}:${recurso}:${x.certificado_id}:MORA:${dias}`});
  }
  return creadas;
}

async function evaluarAlarmas(pool,{proyectoId=null,operacionId=null}={}){
  const reglas=await pool.request().input('proyecto_id',sql.BigInt,proyectoId).query(`SELECT regla_id,proyecto_id,categoria,tipo,mensaje,alcance,parametros_json,entidades_json FROM ReglaAlarmaProyecto WHERE estado='ACTIVA' AND categoria IN ('OPERACIONES','BOM','CERTIFICACIONES') AND (@proyecto_id IS NULL OR proyecto_id=@proyecto_id)`);
  let creadas=0,evaluadas=0;
  for(const regla of reglas.recordset){
    const parametros=json(regla.parametros_json,{}),entidades=json(regla.entidades_json,[]);
    if(['INICIO_PROXIMO','FIN_PROXIMO'].includes(regla.tipo)){creadas+=await evaluarFechas(pool,regla,parametros,entidades,operacionId);evaluadas++;}
    if(regla.tipo==='CONSUMO_SUPERA_TEORICO'){creadas+=await evaluarSobreconsumo(pool,regla,parametros,entidades,operacionId);evaluadas++;}
    if(regla.categoria==='BOM'&&['STOCK_MINIMO','PREAVISO_PEDIDO'].includes(regla.tipo)){creadas+=await evaluarBom(pool,regla,parametros,entidades);evaluadas++;}
    if(regla.categoria==='CERTIFICACIONES'&&['EMISION_PROXIMA','SIN_COBRO','RESPONSABLE_SIN_PAGO'].includes(regla.tipo)){creadas+=await evaluarCertificaciones(pool,regla,parametros,entidades);evaluadas++;}
  }
  return {reglas_evaluadas:evaluadas,alarmas_creadas:creadas};
}

module.exports={evaluarAlarmas};
