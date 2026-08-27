const { conectarDB,sql }=require('../DB/dbConection');
const service=require('../services/CertificacionCliente.service');
const pdfService=require('../services/CertificadoPdf.service');
const error=(res,e)=>res.status(e.status||500).json({message:e.status?e.message:'No se pudo procesar el certificado',...(e.status?{}:{error:e.message})});
exports.preview=async(req,res)=>{try{res.json(await service.generarPreview(await conectarDB(),Number(req.params.proyectoId),req.body));}catch(e){error(res,e);}};
exports.emitir=async(req,res)=>{try{res.status(201).json(await service.emitir(await conectarDB(),Number(req.params.proyectoId),req.body,req.usuario.usuario_id));}catch(e){error(res,e);}};
exports.eliminar=async(req,res)=>{try{res.json(await service.eliminar(await conectarDB(),Number(req.params.proyectoId),Number(req.params.certificadoId),req.body.motivo,req.usuario.usuario_id));}catch(e){error(res,e);}};
exports.pdf=async(req,res)=>{try{const id=Number(req.params.certificadoId);const documento=await pdfService.generarCliente(await conectarDB(),Number(req.params.proyectoId),id);res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="certificado-cliente-${id}.pdf"`,'Content-Length':documento.length});res.send(documento);}catch(e){error(res,e);}};
exports.listar=async(req,res)=>{try{const pool=await conectarDB();const r=await pool.request().input('p',sql.BigInt,req.params.proyectoId).query(`SELECT cc.certificado_cliente_id,cc.proyecto_id,cc.metodo_corte,cc.operacion_corte_id,
  corte.secuencia operacion_corte_secuencia,corte.nombre operacion_corte_nombre,cc.fecha_certificacion,cc.total,cc.estado,
  cc.observaciones,cc.fecha_creacion,u.nombre creado_por_nombre,ISNULL(cobros.total_cobrado,0) total_cobrado,
  cc.total-ISNULL(cobros.total_cobrado,0) saldo_cobro,ISNULL(cobros.cantidad_pagos,0) cantidad_pagos,
  CASE WHEN cc.total<=ISNULL(cobros.total_cobrado,0) THEN 'PAGADO'
       WHEN ISNULL(cobros.total_cobrado,0)>0 THEN 'PAGADO_PARCIAL' ELSE 'PENDIENTE' END estado_pago,
  CASE WHEN cc.estado='EMITIDO' AND cc.certificado_cliente_id=(SELECT TOP 1 vigente.certificado_cliente_id
    FROM CertificadoCliente vigente WHERE vigente.proyecto_id=cc.proyecto_id AND vigente.estado='EMITIDO'
    ORDER BY vigente.fecha_certificacion DESC,vigente.certificado_cliente_id DESC) THEN 1 ELSE 0 END es_ultimo_emitido
  FROM CertificadoCliente cc JOIN Usuario u ON u.usuario_id=cc.creado_por
  OUTER APPLY(SELECT SUM(m.importe) total_cobrado,COUNT(*) cantidad_pagos FROM MovimientoFinancieroProyecto m
    WHERE m.certificado_cliente_id=cc.certificado_cliente_id AND m.estado='ACTIVO') cobros
  LEFT JOIN Operacion corte ON corte.operacion_id=cc.operacion_corte_id
  WHERE cc.proyecto_id=@p AND cc.estado<>'ELIMINADO' ORDER BY cc.fecha_certificacion DESC,cc.certificado_cliente_id DESC`);res.json(r.recordset);}catch(e){error(res,e);}};
exports.detalle=async(req,res)=>{try{const pool=await conectarDB();const r=await pool.request().input('p',sql.BigInt,req.params.proyectoId).input('id',sql.BigInt,req.params.certificadoId).query(`SELECT cc.*,u.nombre creado_por_nombre,p.nombre proyecto_nombre,ISNULL(cobros.total_cobrado,0) total_cobrado,
  cc.total-ISNULL(cobros.total_cobrado,0) saldo_cobro,ISNULL(cobros.cantidad_pagos,0) cantidad_pagos,
  CASE WHEN cc.total<=ISNULL(cobros.total_cobrado,0) THEN 'PAGADO' WHEN ISNULL(cobros.total_cobrado,0)>0 THEN 'PAGADO_PARCIAL' ELSE 'PENDIENTE' END estado_pago,
  CASE WHEN cc.estado='EMITIDO' AND cc.certificado_cliente_id=(SELECT TOP 1 vigente.certificado_cliente_id
    FROM CertificadoCliente vigente WHERE vigente.proyecto_id=cc.proyecto_id AND vigente.estado='EMITIDO'
    ORDER BY vigente.fecha_certificacion DESC,vigente.certificado_cliente_id DESC) THEN 1 ELSE 0 END es_ultimo_emitido,
  corte.secuencia operacion_corte_secuencia,corte.nombre operacion_corte_nombre
  FROM CertificadoCliente cc JOIN Usuario u ON u.usuario_id=cc.creado_por
  JOIN Proyecto p ON p.proyecto_id=cc.proyecto_id LEFT JOIN Operacion corte ON corte.operacion_id=cc.operacion_corte_id
  OUTER APPLY(SELECT SUM(m.importe) total_cobrado,COUNT(*) cantidad_pagos FROM MovimientoFinancieroProyecto m WHERE m.certificado_cliente_id=cc.certificado_cliente_id AND m.estado='ACTIVO') cobros
  WHERE cc.certificado_cliente_id=@id AND cc.proyecto_id=@p AND cc.estado<>'ELIMINADO';
  SELECT d.*,o.nombre operacion_nombre,
    COALESCE(d.peso_operacion_aplicado,o.peso_pct) peso_operacion,
    COALESCE(d.etapa_id_aplicada,e.etapa_id) etapa_id,
    COALESCE(d.etapa_nombre_aplicada,e.nombre) etapa_nombre,
    COALESCE(d.etapa_orden_aplicado,e.orden) etapa_orden,
    r.nombre responsable_nombre
  FROM CertificadoClienteDetalle d JOIN Operacion o ON o.operacion_id=d.operacion_id
  JOIN EtapaOperacion e ON e.etapa_id=o.etapa_id LEFT JOIN ResponsableOperacion r ON r.responsable_id=o.responsable_id
  WHERE d.certificado_cliente_id=@id ORDER BY d.secuencia_aplicada;
  SELECT m.movimiento_id,m.fecha,m.importe,m.medio_pago,m.referencia,m.descripcion,u.nombre creado_por_nombre
  FROM MovimientoFinancieroProyecto m JOIN Usuario u ON u.usuario_id=m.creado_por
  WHERE m.certificado_cliente_id=@id AND m.estado='ACTIVO' ORDER BY m.fecha,m.movimiento_id`);if(!r.recordsets[0].length)return res.status(404).json({message:'Certificado no encontrado'});const detalles=r.recordsets[1];res.json({certificado:r.recordsets[0][0],etapas:service.calcularAvanceEtapas(detalles),detalles,pagos:r.recordsets[2]});}catch(e){error(res,e);}};
