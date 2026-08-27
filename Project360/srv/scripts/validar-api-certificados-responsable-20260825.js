require('dotenv').config();
const assert=require('node:assert/strict');
const axios=require('axios');
const jwt=require('jsonwebtoken');
const {conectarDB}=require('../DB/dbConection');

(async()=>{
  const pool=await conectarDB();
  try{
    const datos=await pool.request().query(`
      SELECT TOP 1 u.usuario_id,u.empresa_id,u.usuario,u.rol_id,r.nombre rol_nombre
      FROM Usuario u JOIN Rol r ON r.rol_id=u.rol_id WHERE u.activo=1 AND UPPER(r.nombre) IN ('ADMIN','ADMINISTRADOR') ORDER BY u.usuario_id;
      SELECT TOP 1 cr.certificado_responsable_id,cr.responsable_id,cr.total
      FROM CertificadoResponsable cr WHERE cr.proyecto_id=7 AND cr.estado='EMITIDO'
      ORDER BY cr.fecha_certificacion DESC,cr.certificado_responsable_id DESC;
      SELECT TOP 1 o.operacion_id,o.responsable_id FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
      WHERE o.proyecto_id=7 AND ISNULL(o.archivada,0)=0 AND o.responsable_id IS NOT NULL ORDER BY o.secuencia DESC`);
    const usuario=datos.recordsets[0][0],certificado=datos.recordsets[1][0],corte=datos.recordsets[2][0];
    assert.ok(usuario&&certificado&&corte,'Faltan datos integrales para validar la API');
    const token=jwt.sign(usuario,process.env.JWT_SECRET,{expiresIn:'5m'});
    const baseURL=process.env.TEST_API_BASE||'http://localhost:3101/api';
    const api=axios.create({baseURL,headers:{Authorization:`Bearer ${token}`}});
    await assert.rejects(axios.get(`${baseURL}/certificados-responsable/proyectos/7`),e=>e.response?.status===401);
    const permisos=await api.get('/economia-operaciones/permisos');
    for(const codigo of ['CERTIFICADO_RESPONSABLE_PREVIEW','CERTIFICADO_RESPONSABLE_EMITIR','CERTIFICADO_RESPONSABLE_VER','CERTIFICADO_RESPONSABLE_ELIMINAR'])assert.ok(permisos.data.includes(codigo),`Falta permiso ${codigo}`);
    const economia=await api.get('/economia-operaciones/proyectos/7/operaciones');
    assert.ok(economia.data.operaciones.some(o=>o.responsable_id),'Economia no devuelve responsables');
    const preview=await api.post('/certificados-responsable/proyectos/7/preview',{responsable_id:Number(corte.responsable_id),metodo_corte:'POR_OPERACION',operacion_corte_id:Number(corte.operacion_id),fecha_certificacion:'2026-08-25'});
    assert.equal(preview.status,200);assert.ok(preview.data.lineas.every(l=>Number(l.responsable_id)===Number(corte.responsable_id)));
    const lista=await api.get('/certificados-responsable/proyectos/7');
    assert.ok(lista.data.some(c=>Number(c.certificado_responsable_id)===Number(certificado.certificado_responsable_id)));
    const detalle=await api.get(`/certificados-responsable/proyectos/7/${certificado.certificado_responsable_id}`);
    assert.equal(detalle.data.certificado.estado_pago,'PAGADO_PARCIAL');assert.ok(detalle.data.pagos.length);
    const finanzas=await api.get('/movimientos-financieros/proyectos/7');
    assert.equal(finanzas.data.certificados_responsable_disponibles,true);
    assert.ok(finanzas.data.certificados_responsable.some(c=>Number(c.certificado_responsable_id)===Number(certificado.certificado_responsable_id)));
    await assert.rejects(api.post('/movimientos-financieros/proyectos/7',{tipo:'EGRESO',vinculo_tipo:'CERTIFICADO_RESPONSABLE',certificado_responsable_id:Number(certificado.certificado_responsable_id),fecha:'2026-08-25',importe:Number(certificado.total)+1,descripcion:'Debe rechazarse'}),e=>e.response?.status===422&&/supera el saldo/.test(e.response?.data?.message||''));
    await assert.rejects(api.delete(`/certificados-responsable/proyectos/7/${certificado.certificado_responsable_id}`,{data:{motivo:'Debe rechazarse por pago asociado'}}),e=>e.response?.status===409&&/egresos asociados/.test(e.response?.data?.message||''));
    console.log(JSON.stringify({ok:true,proyecto_id:7,certificado_responsable_id:certificado.certificado_responsable_id,endpoints:{sin_token:401,permisos:permisos.status,economia:economia.status,preview:preview.status,listado:lista.status,detalle:detalle.status,finanzas:finanzas.status,sobrepago:422,eliminar_con_pago:409}},null,2));
  }finally{await pool.close();}
})().catch(error=>{console.error(error.response?.data||error);process.exitCode=1;});
