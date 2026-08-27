const PDFDocument = require('pdfkit');
const { sql } = require('../DB/dbConection');
const { calcularAvanceEtapas } = require('./CertificacionCliente.service');

const COLORES = { oscuro:'#0b1324', primario:'#00cdb5', borde:'#ccd5e1', suave:'#f3f6fa', texto:'#182235', secundario:'#5d6b82' };
const dinero = value => new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0));
const porcentaje = value => `${new Intl.NumberFormat('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(value||0))}%`;
const fecha = value => { const iso=value instanceof Date?value.toISOString().slice(0,10):String(value||'').slice(0,10); const p=iso.split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:'-'; };

async function datosCliente(pool,proyectoId,certificadoId){
  const r=await pool.request().input('p',sql.BigInt,proyectoId).input('id',sql.BigInt,certificadoId).query(`
    SELECT cc.*,p.nombre proyecto_nombre,
      COALESCE(NULLIF(c.razon_social,''),LTRIM(RTRIM(CONCAT(c.apellido,' ',c.nombre)))) destinatario_nombre,
      u.nombre creado_por_nombre,corte.secuencia operacion_corte_secuencia,corte.nombre operacion_corte_nombre,
      ISNULL(cobros.total_pagado,0) total_pagado,cc.total-ISNULL(cobros.total_pagado,0) saldo,
      CASE WHEN cc.total<=ISNULL(cobros.total_pagado,0) THEN 'PAGADO' WHEN ISNULL(cobros.total_pagado,0)>0 THEN 'PAGADO_PARCIAL' ELSE 'PENDIENTE' END estado_pago
    FROM CertificadoCliente cc JOIN Proyecto p ON p.proyecto_id=cc.proyecto_id
    LEFT JOIN Cliente c ON c.id_cliente=p.cliente_id JOIN Usuario u ON u.usuario_id=cc.creado_por
    LEFT JOIN Operacion corte ON corte.operacion_id=cc.operacion_corte_id
    OUTER APPLY(SELECT SUM(m.importe) total_pagado FROM MovimientoFinancieroProyecto m WHERE m.certificado_cliente_id=cc.certificado_cliente_id AND m.estado='ACTIVO') cobros
    WHERE cc.proyecto_id=@p AND cc.certificado_cliente_id=@id AND cc.estado<>'ELIMINADO';
    SELECT d.*,o.nombre operacion_nombre,COALESCE(d.peso_operacion_aplicado,o.peso_pct) peso_operacion,
      COALESCE(d.etapa_id_aplicada,e.etapa_id) etapa_id,COALESCE(d.etapa_nombre_aplicada,e.nombre) etapa_nombre,
      COALESCE(d.etapa_orden_aplicado,e.orden) etapa_orden
    FROM CertificadoClienteDetalle d JOIN Operacion o ON o.operacion_id=d.operacion_id JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id
    WHERE d.certificado_cliente_id=@id ORDER BY d.secuencia_aplicada;
    SELECT m.fecha,m.importe,m.medio_pago,m.referencia,m.descripcion FROM MovimientoFinancieroProyecto m
    WHERE m.certificado_cliente_id=@id AND m.estado='ACTIVO' ORDER BY m.fecha,m.movimiento_id`);
  if(!r.recordsets[0].length){const e=new Error('Certificado a cliente no encontrado');e.status=404;throw e;}
  return{tipo:'CLIENTE',certificado:r.recordsets[0][0],detalles:r.recordsets[1],pagos:r.recordsets[2]};
}

async function datosResponsable(pool,proyectoId,certificadoId){
  const r=await pool.request().input('p',sql.BigInt,proyectoId).input('id',sql.BigInt,certificadoId).query(`
    SELECT cr.*,p.nombre proyecto_nombre,r.nombre destinatario_nombre,r.codigo responsable_codigo,u.nombre creado_por_nombre,
      corte.secuencia operacion_corte_secuencia,corte.nombre operacion_corte_nombre,
      ISNULL(pagos.total_pagado,0) total_pagado,cr.total-ISNULL(pagos.total_pagado,0) saldo,
      CASE WHEN cr.total<=ISNULL(pagos.total_pagado,0) THEN 'PAGADO' WHEN ISNULL(pagos.total_pagado,0)>0 THEN 'PAGADO_PARCIAL' ELSE 'PENDIENTE' END estado_pago
    FROM CertificadoResponsable cr JOIN Proyecto p ON p.proyecto_id=cr.proyecto_id
    JOIN ResponsableOperacion r ON r.responsable_id=cr.responsable_id JOIN Usuario u ON u.usuario_id=cr.creado_por
    LEFT JOIN Operacion corte ON corte.operacion_id=cr.operacion_corte_id
    OUTER APPLY(SELECT SUM(m.importe) total_pagado FROM MovimientoFinancieroProyecto m WHERE m.certificado_responsable_id=cr.certificado_responsable_id AND m.estado='ACTIVO') pagos
    WHERE cr.proyecto_id=@p AND cr.certificado_responsable_id=@id AND cr.estado<>'ELIMINADO';
    SELECT d.*,o.nombre operacion_nombre,COALESCE(d.peso_operacion_aplicado,o.peso_pct) peso_operacion,
      COALESCE(d.etapa_id_aplicada,e.etapa_id) etapa_id,COALESCE(d.etapa_nombre_aplicada,e.nombre) etapa_nombre,
      COALESCE(d.etapa_orden_aplicado,e.orden) etapa_orden
    FROM CertificadoResponsableDetalle d JOIN Operacion o ON o.operacion_id=d.operacion_id JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id
    WHERE d.certificado_responsable_id=@id ORDER BY d.secuencia_aplicada;
    SELECT m.fecha,m.importe,m.medio_pago,m.referencia,m.descripcion FROM MovimientoFinancieroProyecto m
    WHERE m.certificado_responsable_id=@id AND m.estado='ACTIVO' ORDER BY m.fecha,m.movimiento_id`);
  if(!r.recordsets[0].length){const e=new Error('Certificado a responsable no encontrado');e.status=404;throw e;}
  return{tipo:'RESPONSABLE',certificado:r.recordsets[0][0],detalles:r.recordsets[1],pagos:r.recordsets[2]};
}

function nuevaPaginaSiHaceFalta(doc,alto){if(doc.y+alto>doc.page.height-55)doc.addPage();}
function tituloSeccion(doc,titulo){nuevaPaginaSiHaceFalta(doc,34);doc.moveDown(.6).font('Helvetica-Bold').fontSize(9).fillColor(COLORES.primario).text(titulo.toUpperCase());doc.moveTo(doc.x,doc.y+3).lineTo(doc.page.width-36,doc.y+3).strokeColor(COLORES.borde).stroke();doc.moveDown(.7);}
function dato(doc,etiqueta,valor,x,y,w){doc.font('Helvetica').fontSize(7).fillColor(COLORES.secundario).text(etiqueta,x,y,{width:w});doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORES.texto).text(String(valor??'-'),x,y+11,{width:w});}

function tabla(doc,columnas,filas){
  const inicioX=36, anchoTotal=doc.page.width-72, altoCabecera=22;
  const anchos=columnas.map(c=>anchoTotal*c.proporcion);
  const cabecera=()=>{nuevaPaginaSiHaceFalta(doc,altoCabecera+30);const y=doc.y;doc.rect(inicioX,y,anchoTotal,altoCabecera).fill(COLORES.oscuro);let x=inicioX;columnas.forEach((c,i)=>{doc.font('Helvetica-Bold').fontSize(6.7).fillColor('#ffffff').text(c.titulo,x+4,y+7,{width:anchos[i]-8,align:c.align||'left'});x+=anchos[i];});doc.y=y+altoCabecera;};
  cabecera();
  filas.forEach((fila,indice)=>{const alto=30;if(doc.y+alto>doc.page.height-55){doc.addPage();cabecera();}const y=doc.y;if(indice%2===0)doc.rect(inicioX,y,anchoTotal,alto).fill(COLORES.suave);let x=inicioX;columnas.forEach((c,i)=>{doc.font(c.negrita?'Helvetica-Bold':'Helvetica').fontSize(7).fillColor(COLORES.texto).text(String(fila[c.campo]??'-'),x+4,y+6,{width:anchos[i]-8,height:alto-9,ellipsis:true,align:c.align||'left'});x+=anchos[i];});doc.moveTo(inicioX,y+alto).lineTo(inicioX+anchoTotal,y+alto).strokeColor(COLORES.borde).stroke();doc.y=y+alto;});
}

function construirPdf(datos){
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:36,bufferPages:true,info:{Title:`Certificado ${datos.tipo} #${datos.id}`}}),partes=[];
    doc.on('data',c=>partes.push(c));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(partes)));
    const c=datos.certificado,id=datos.tipo==='CLIENTE'?c.certificado_cliente_id:c.certificado_responsable_id;
    doc.rect(0,0,doc.page.width,92).fill(COLORES.oscuro);
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff').text('CERTIFICADO DE COSTOS',36,28);
    doc.font('Helvetica').fontSize(8).fillColor(COLORES.primario).text(datos.tipo==='CLIENTE'?'CERTIFICACIÓN A CLIENTE':'CERTIFICACIÓN A RESPONSABLE',36,54);
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff').text(`#${id}`,doc.page.width-150,30,{width:114,align:'right'});
    doc.y=110;dato(doc,'PROYECTO',c.proyecto_nombre,36,108,250);dato(doc,datos.tipo==='CLIENTE'?'CLIENTE':'RESPONSABLE',c.destinatario_nombre||'Sin informar',310,108,249);
    dato(doc,'FECHA',fecha(c.fecha_certificacion),36,145,120);dato(doc,'METODOLOGÍA',c.metodo_corte==='POR_OPERACION'?'Por operación':'Por fecha',170,145,160);dato(doc,'ESTADO DE PAGO',String(c.estado_pago||'PENDIENTE').replace('_',' '),350,145,209);
    doc.y=184;
    if(c.operacion_corte_nombre)doc.font('Helvetica').fontSize(8).fillColor(COLORES.secundario).text(`Operación de corte: ${c.operacion_corte_secuencia} - ${c.operacion_corte_nombre}`);
    tituloSeccion(doc,'Certificación por etapa');
    const etapas=calcularAvanceEtapas(datos.detalles);
    tabla(doc,[{titulo:'ETAPA',campo:'nombre',proporcion:.72},{titulo:'CERTIFICADO',campo:'porcentaje',proporcion:.28,align:'right',negrita:true}],etapas.map(e=>({nombre:e.etapa_nombre,porcentaje:porcentaje(e.porcentaje_certificado)})));
    tituloSeccion(doc,'Detalle de operaciones');
    const valorCampo=datos.tipo==='CLIENTE'?'precio_cliente_aplicado':'costo_responsable_aplicado';
    const detallesConDelta=datos.detalles.filter(d=>Number(d.delta)>0);
    tabla(doc,[
      {titulo:'SEC.',campo:'secuencia',proporcion:.08},{titulo:'OPERACIÓN',campo:'operacion',proporcion:.31},
      {titulo:'ANT.',campo:'anterior',proporcion:.09,align:'right'},{titulo:'ACTUAL',campo:'actual',proporcion:.09,align:'right'},
      {titulo:'DELTA',campo:'delta',proporcion:.09,align:'right'},{titulo:datos.tipo==='CLIENTE'?'PRECIO':'COSTO',campo:'valor',proporcion:.16,align:'right'},
      {titulo:'IMPORTE',campo:'importe',proporcion:.18,align:'right',negrita:true}
    ],detallesConDelta.map(d=>({secuencia:d.secuencia_aplicada,operacion:d.operacion_nombre,anterior:porcentaje(d.porcentaje_anterior),actual:porcentaje(d.porcentaje_actual),delta:porcentaje(d.delta),valor:dinero(d[valorCampo]),importe:dinero(d.importe)})));
    tituloSeccion(doc,datos.tipo==='CLIENTE'?'Cobros asociados':'Pagos asociados');
    if(datos.pagos.length)tabla(doc,[{titulo:'FECHA',campo:'fecha',proporcion:.18},{titulo:'MEDIO / REFERENCIA',campo:'referencia',proporcion:.52},{titulo:'IMPORTE',campo:'importe',proporcion:.30,align:'right',negrita:true}],datos.pagos.map(p=>({fecha:fecha(p.fecha),referencia:[p.medio_pago,p.referencia].filter(Boolean).join(' - ')||'Sin referencia',importe:dinero(p.importe)})));
    else doc.font('Helvetica').fontSize(8).fillColor(COLORES.secundario).text('Sin movimientos asociados.');
    nuevaPaginaSiHaceFalta(doc,95);doc.moveDown();const yTotal=doc.y;doc.rect(310,yTotal,249,76).fill(COLORES.oscuro);doc.font('Helvetica').fontSize(7).fillColor('#aab8ce').text('TOTAL CERTIFICADO',326,yTotal+13);doc.font('Helvetica-Bold').fontSize(17).fillColor('#ffffff').text(dinero(c.total),326,yTotal+26,{width:217,align:'right'});doc.font('Helvetica').fontSize(7).fillColor(COLORES.primario).text(`Pagado: ${dinero(c.total_pagado)}   Saldo: ${dinero(c.saldo)}`,326,yTotal+55,{width:217,align:'right'});
    if(c.observaciones){doc.y=yTotal+90;tituloSeccion(doc,'Observaciones');doc.font('Helvetica').fontSize(8).fillColor(COLORES.texto).text(c.observaciones);}
    const paginas=doc.bufferedPageRange();for(let i=paginas.start;i<paginas.start+paginas.count;i++){doc.switchToPage(i);doc.font('Helvetica').fontSize(7).fillColor(COLORES.secundario).text(`Generado por OBRA360 - Página ${i+1} de ${paginas.count}`,36,doc.page.height-31,{width:doc.page.width-72,align:'center'});}
    doc.end();
  });
}

async function generarCliente(pool,proyectoId,certificadoId){const datos=await datosCliente(pool,proyectoId,certificadoId);datos.id=certificadoId;return construirPdf(datos);}
async function generarResponsable(pool,proyectoId,certificadoId){const datos=await datosResponsable(pool,proyectoId,certificadoId);datos.id=certificadoId;return construirPdf(datos);}

module.exports={generarCliente,generarResponsable};
