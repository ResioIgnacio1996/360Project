const { sql } = require('../DB/dbConection');

const VINCULOS_INGRESO = new Set(['LIBRE', 'CERTIFICADO_CLIENTE']);
const VINCULOS_EGRESO = new Set(['LIBRE', 'OC', 'FAC', 'CERTIFICADO_RESPONSABLE']);

function fallo(message, status = 400) { const error = new Error(message); error.status = status; return error; }
function texto(value, limite, nombre, obligatorio = false) {
  const resultado = String(value || '').trim();
  if (obligatorio && !resultado) throw fallo(`${nombre} es obligatorio`, 422);
  if (resultado.length > limite) throw fallo(`${nombre} no puede superar ${limite} caracteres`, 422);
  return resultado || null;
}
function fechaValida(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function validarMovimiento(body = {}) {
  const tipo = String(body.tipo || '').trim().toUpperCase();
  const vinculo_tipo = String(body.vinculo_tipo || 'LIBRE').trim().toUpperCase();
  const importe = Number(body.importe);
  const fecha = String(body.fecha || '').trim();
  if (!['INGRESO', 'EGRESO'].includes(tipo)) throw fallo('Tipo de movimiento invalido', 422);
  if (!(tipo === 'INGRESO' ? VINCULOS_INGRESO : VINCULOS_EGRESO).has(vinculo_tipo)) throw fallo('El vinculo no corresponde al tipo de movimiento', 422);
  if (!fechaValida(fecha)) throw fallo('Fecha efectiva invalida', 422);
  if (!Number.isFinite(importe) || importe <= 0 || importe > 999999999999999.9999) throw fallo('Importe invalido', 422);
  const id = value => value === null || value === undefined || value === '' ? null : Number(value);
  const certificado_cliente_id = id(body.certificado_cliente_id);
  const registro_compra_id = id(body.registro_compra_id);
  const certificado_responsable_id = id(body.certificado_responsable_id);
  if (vinculo_tipo === 'CERTIFICADO_CLIENTE' && !Number.isInteger(certificado_cliente_id)) throw fallo('Seleccione un certificado a cliente', 422);
  if (['OC', 'FAC'].includes(vinculo_tipo) && !Number.isInteger(registro_compra_id)) throw fallo(`Seleccione una ${vinculo_tipo}`, 422);
  if (vinculo_tipo === 'CERTIFICADO_RESPONSABLE' && !Number.isInteger(certificado_responsable_id)) throw fallo('Seleccione un certificado a responsable', 422);
  return { tipo, vinculo_tipo, fecha, importe, descripcion:texto(body.descripcion,500,'La descripcion',true), medio_pago:texto(body.medio_pago,50,'El medio de pago'), referencia:texto(body.referencia,100,'La referencia'), certificado_cliente_id:vinculo_tipo==='CERTIFICADO_CLIENTE'?certificado_cliente_id:null, registro_compra_id:['OC','FAC'].includes(vinculo_tipo)?registro_compra_id:null, certificado_responsable_id:vinculo_tipo==='CERTIFICADO_RESPONSABLE'?certificado_responsable_id:null };
}

async function validarProyecto(request, proyectoId) {
  const r = await request.input('proyecto',sql.BigInt,proyectoId).query("SELECT proyecto_id FROM Proyecto WHERE proyecto_id=@proyecto AND activo=1 AND eliminado=0 AND estado='ACTIVO'");
  if (!r.recordset.length) throw fallo('El proyecto debe estar activo', 409);
}

async function listar(pool, proyectoId, opciones) {
  if (!Number.isInteger(proyectoId)) throw fallo('Proyecto invalido');
  const paginado=!!opciones,page=opciones?.page||0,pageSize=opciones?.pageSize||50,offset=page*pageSize;
  await validarProyecto(pool.request(), proyectoId);
  const r = await pool.request().input('proyecto',sql.BigInt,proyectoId).query(`
    SELECT m.*,u.nombre creado_por_nombre,ua.nombre anulado_por_nombre,
      cc.total certificado_total,cr.total certificado_responsable_total,resp.nombre certificado_responsable_nombre,
      rc.numero registro_numero,rc.tipo registro_tipo,p.razon_social proveedor_nombre
    FROM MovimientoFinancieroProyecto m JOIN Usuario u ON u.usuario_id=m.creado_por
    LEFT JOIN Usuario ua ON ua.usuario_id=m.anulado_por
    LEFT JOIN CertificadoCliente cc ON cc.certificado_cliente_id=m.certificado_cliente_id
    LEFT JOIN CertificadoResponsable cr ON cr.certificado_responsable_id=m.certificado_responsable_id
    LEFT JOIN ResponsableOperacion resp ON resp.responsable_id=cr.responsable_id
    LEFT JOIN registroDecompra rc ON rc.registro_compra_id=m.registro_compra_id
    LEFT JOIN Proveedor p ON p.proveedor_id=rc.proveedor_id
    WHERE m.proyecto_id=@proyecto ORDER BY m.fecha DESC,m.movimiento_id DESC${paginado?` OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`:''};
    ${paginado?'SELECT COUNT_BIG(*) total FROM MovimientoFinancieroProyecto WHERE proyecto_id=@proyecto;':''}

    SELECT cc.certificado_cliente_id,cc.fecha_certificacion,cc.total,
      ISNULL(c.cobrado,0) total_cobrado,cc.total-ISNULL(c.cobrado,0) saldo,
      CASE WHEN cc.total<=ISNULL(c.cobrado,0) THEN 'PAGADO'
           WHEN ISNULL(c.cobrado,0)>0 THEN 'PAGADO_PARCIAL' ELSE 'PENDIENTE' END estado_pago
    FROM CertificadoCliente cc
    OUTER APPLY(SELECT SUM(m.importe) cobrado FROM MovimientoFinancieroProyecto m
      WHERE m.certificado_cliente_id=cc.certificado_cliente_id AND m.estado='ACTIVO') c
    WHERE cc.proyecto_id=@proyecto AND cc.estado='EMITIDO'
    ORDER BY cc.fecha_certificacion DESC,cc.certificado_cliente_id DESC;

    SELECT rc.registro_compra_id,rc.numero,UPPER(LTRIM(RTRIM(rc.tipo))) tipo,rc.fecha,p.razon_social proveedor_nombre
    FROM registroDecompra rc LEFT JOIN Proveedor p ON p.proveedor_id=rc.proveedor_id
    WHERE ISNULL(rc.activo,1)=1 AND UPPER(rc.tipo) IN ('OC','FAC') ORDER BY rc.fecha DESC,rc.registro_compra_id DESC;

    SELECT cr.certificado_responsable_id,cr.responsable_id,r.nombre responsable_nombre,r.codigo responsable_codigo,
      cr.fecha_certificacion,cr.total,ISNULL(p.pagado,0) total_pagado,cr.total-ISNULL(p.pagado,0) saldo,
      CASE WHEN cr.total<=ISNULL(p.pagado,0) THEN 'PAGADO'
           WHEN ISNULL(p.pagado,0)>0 THEN 'PAGADO_PARCIAL' ELSE 'PENDIENTE' END estado_pago
    FROM CertificadoResponsable cr JOIN ResponsableOperacion r ON r.responsable_id=cr.responsable_id
    OUTER APPLY(SELECT SUM(m.importe) pagado FROM MovimientoFinancieroProyecto m
      WHERE m.certificado_responsable_id=cr.certificado_responsable_id AND m.estado='ACTIVO') p
    WHERE cr.proyecto_id=@proyecto AND cr.estado='EMITIDO'
    ORDER BY cr.fecha_certificacion DESC,cr.certificado_responsable_id DESC;

    SELECT ISNULL(SUM(CASE WHEN tipo='INGRESO' AND estado='ACTIVO' THEN importe ELSE 0 END),0) ingresos,
      ISNULL(SUM(CASE WHEN tipo='EGRESO' AND estado='ACTIVO' THEN importe ELSE 0 END),0) egresos
    FROM MovimientoFinancieroProyecto WHERE proyecto_id=@proyecto;
  `);
  const desplazamiento=paginado?1:0,resumen=r.recordsets[4+desplazamiento][0];
  const data={movimientos:r.recordsets[0],certificados_cliente:r.recordsets[1+desplazamiento],registros_compra:r.recordsets[2+desplazamiento],
    certificados_responsable:r.recordsets[3+desplazamiento],certificados_responsable_disponibles:true,
    resumen:{ingresos:Number(resumen.ingresos),egresos:Number(resumen.egresos),saldo:Number(resumen.ingresos)-Number(resumen.egresos)}};
  if(!paginado)return data;
  const total=Number(r.recordsets[1][0].total);
  return{data,page:{index:page,size:pageSize,total,totalPages:Math.ceil(total/pageSize)}};
}

async function crear(pool, proyectoId, body, usuarioId) {
  if (!Number.isInteger(proyectoId)) throw fallo('Proyecto invalido');
  const dato=validarMovimiento(body);
  const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await validarProyecto(new sql.Request(tx),proyectoId);
    if(dato.certificado_cliente_id){
      const c=await new sql.Request(tx).input('id',sql.BigInt,dato.certificado_cliente_id).input('p',sql.BigInt,proyectoId).query(`SELECT cc.certificado_cliente_id,cc.total,ISNULL(SUM(CASE WHEN m.estado='ACTIVO' THEN m.importe ELSE 0 END),0) cobrado FROM CertificadoCliente cc WITH(UPDLOCK,HOLDLOCK) LEFT JOIN MovimientoFinancieroProyecto m WITH(UPDLOCK,HOLDLOCK) ON m.certificado_cliente_id=cc.certificado_cliente_id WHERE cc.certificado_cliente_id=@id AND cc.proyecto_id=@p AND cc.estado='EMITIDO' GROUP BY cc.certificado_cliente_id,cc.total`);
      if(!c.recordset.length)throw fallo('Certificado a cliente inexistente o no vigente',404);
      const certificado=c.recordset[0],saldo=Number(certificado.total)-Number(certificado.cobrado);
      if(dato.importe>saldo+0.00005)throw fallo(`El ingreso supera el saldo pendiente del certificado (${saldo.toFixed(4)})`,422);
    }
    if(dato.certificado_responsable_id){
      const c=await new sql.Request(tx).input('id',sql.BigInt,dato.certificado_responsable_id).input('p',sql.BigInt,proyectoId).query(`SELECT cr.certificado_responsable_id,cr.total,
        ISNULL(SUM(CASE WHEN m.estado='ACTIVO' THEN m.importe ELSE 0 END),0) pagado
        FROM CertificadoResponsable cr WITH(UPDLOCK,HOLDLOCK)
        LEFT JOIN MovimientoFinancieroProyecto m WITH(UPDLOCK,HOLDLOCK) ON m.certificado_responsable_id=cr.certificado_responsable_id
        WHERE cr.certificado_responsable_id=@id AND cr.proyecto_id=@p AND cr.estado='EMITIDO'
        GROUP BY cr.certificado_responsable_id,cr.total`);
      if(!c.recordset.length)throw fallo('Certificado a responsable inexistente o no vigente',404);
      const certificado=c.recordset[0],saldo=Number(certificado.total)-Number(certificado.pagado);
      if(dato.importe>saldo+0.00005)throw fallo(`El egreso supera el saldo pendiente del certificado (${saldo.toFixed(4)})`,422);
    }
    if(dato.registro_compra_id){
      const rc=await new sql.Request(tx).input('id',sql.BigInt,dato.registro_compra_id).input('tipo',sql.VarChar(3),dato.vinculo_tipo).query(`SELECT registro_compra_id FROM registroDecompra WHERE registro_compra_id=@id AND ISNULL(activo,1)=1 AND UPPER(tipo)=@tipo`);
      if(!rc.recordset.length)throw fallo(`${dato.vinculo_tipo} inexistente, inactiva o de otro tipo`,404);
    }
    const r=await new sql.Request(tx).input('p',sql.BigInt,proyectoId).input('tipo',sql.VarChar(10),dato.tipo).input('fecha',sql.Date,dato.fecha).input('importe',sql.Decimal(19,4),dato.importe).input('descripcion',sql.NVarChar(500),dato.descripcion).input('medio',sql.NVarChar(50),dato.medio_pago).input('ref',sql.NVarChar(100),dato.referencia).input('vinculo',sql.VarChar(30),dato.vinculo_tipo).input('cert_cliente',sql.BigInt,dato.certificado_cliente_id).input('registro',sql.BigInt,dato.registro_compra_id).input('cert_resp',sql.BigInt,dato.certificado_responsable_id).input('usuario',sql.BigInt,usuarioId).query(`INSERT INTO MovimientoFinancieroProyecto(proyecto_id,tipo,fecha,importe,descripcion,medio_pago,referencia,vinculo_tipo,certificado_cliente_id,registro_compra_id,certificado_responsable_id,creado_por) OUTPUT INSERTED.movimiento_id VALUES(@p,@tipo,@fecha,@importe,@descripcion,@medio,@ref,@vinculo,@cert_cliente,@registro,@cert_resp,@usuario)`);
    await tx.commit();return {message:'Movimiento registrado correctamente',movimiento_id:r.recordset[0].movimiento_id};
  }catch(e){try{await tx.rollback();}catch{}throw e;}
}

async function anular(pool, proyectoId, movimientoId, motivoValue, usuarioId){
  const motivo=texto(motivoValue,500,'El motivo',true);if(!Number.isInteger(proyectoId)||!Number.isInteger(movimientoId))throw fallo('Movimiento invalido');
  const r=await pool.request().input('p',sql.BigInt,proyectoId).input('id',sql.BigInt,movimientoId).input('u',sql.BigInt,usuarioId).input('motivo',sql.NVarChar(500),motivo).query(`UPDATE MovimientoFinancieroProyecto SET estado='ANULADO',anulado_por=@u,fecha_anulacion=SYSDATETIME(),motivo_anulacion=@motivo WHERE movimiento_id=@id AND proyecto_id=@p AND estado='ACTIVO';SELECT @@ROWCOUNT afectados;`);
  if(!Number(r.recordset[0].afectados))throw fallo('Movimiento inexistente o ya anulado',409);return {message:'Movimiento anulado correctamente'};
}

module.exports={listar,crear,anular,validarMovimiento};
