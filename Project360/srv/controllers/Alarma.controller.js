const { conectarDB, sql } = require('../DB/dbConection');
const { evaluarAlarmas } = require('../services/AlarmasEvaluador.service');

const listar = async (req, res) => {
  try {
    const usuarioId = Number(req.usuario?.usuario_id);
    const proyectoId = req.query.proyecto_id ? Number(req.query.proyecto_id) : null;
    const limite = Math.min(Math.max(Number(req.query.limite) || 30, 1), 100);
    const estado = String(req.query.estado || 'ACTIVA').toUpperCase();
    if (!usuarioId) return res.status(401).json({ message: 'Usuario inválido' });
    if (req.query.proyecto_id && !proyectoId) return res.status(400).json({ message: 'Proyecto inválido' });

    const pool = await conectarDB();
    await evaluarAlarmas(pool,{proyectoId});
    const result = await pool.request()
      .input('usuario_id', sql.BigInt, usuarioId)
      .input('proyecto_id', sql.BigInt, proyectoId)
      .input('limite', sql.Int, limite)
      .input('estado', sql.VarChar(15), estado)
      .query(`
        SELECT TOP (@limite)
          a.alarma_id, a.proyecto_id, p.nombre AS proyecto_nombre,
          a.categoria, a.severidad, a.mensaje, a.recurso_tipo,
          a.recurso_id, a.url_destino, a.fecha_disparo,a.estado_gestion,a.comentario_aceptacion,a.fecha_aceptacion,
          ua.nombre AS aceptada_por_nombre,
          CAST(CASE WHEN l.alarma_id IS NULL THEN 0 ELSE 1 END AS bit) AS leida
        FROM AlarmaProyecto a
        INNER JOIN Proyecto p ON p.proyecto_id = a.proyecto_id AND ISNULL(p.eliminado, 0) = 0
        LEFT JOIN AlarmaLectura l ON l.alarma_id = a.alarma_id AND l.usuario_id = @usuario_id
        LEFT JOIN Usuario ua ON ua.usuario_id=a.aceptada_por
        WHERE a.activa = 1 AND (@estado='TODAS' OR a.estado_gestion=@estado) AND (@proyecto_id IS NULL OR a.proyecto_id = @proyecto_id)
        ORDER BY CASE WHEN l.alarma_id IS NULL THEN 0 ELSE 1 END, a.fecha_disparo DESC;

        SELECT COUNT_BIG(1) AS no_leidas
        FROM AlarmaProyecto a
        INNER JOIN Proyecto p ON p.proyecto_id = a.proyecto_id AND ISNULL(p.eliminado, 0) = 0
        LEFT JOIN AlarmaLectura l ON l.alarma_id = a.alarma_id AND l.usuario_id = @usuario_id
        WHERE a.activa = 1 AND a.estado_gestion='ACTIVA' AND l.alarma_id IS NULL
          AND (@proyecto_id IS NULL OR a.proyecto_id = @proyecto_id);
      `);

    res.json({ alarmas: result.recordsets[0], no_leidas: Number(result.recordsets[1][0].no_leidas) });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener las alarmas', error: error.message });
  }
};

const aceptar = async (req,res) => {
  const alarmaId=Number(req.params.id),usuarioId=Number(req.usuario?.usuario_id),comentario=String(req.body?.comentario||'').trim();
  if(!alarmaId||!usuarioId)return res.status(400).json({message:'Datos inválidos'});
  if(!comentario)return res.status(400).json({message:'El comentario es obligatorio'});
  if(comentario.length>1000)return res.status(400).json({message:'El comentario admite hasta 1000 caracteres'});
  try{const pool=await conectarDB();const result=await pool.request().input('alarma_id',sql.BigInt,alarmaId).input('usuario_id',sql.BigInt,usuarioId).input('comentario',sql.NVarChar(1000),comentario).query(`UPDATE AlarmaProyecto SET estado_gestion='ACEPTADA',aceptada_por=@usuario_id,comentario_aceptacion=@comentario,fecha_aceptacion=SYSUTCDATETIME() OUTPUT INSERTED.alarma_id WHERE alarma_id=@alarma_id AND activa=1 AND estado_gestion='ACTIVA'`);if(!result.recordset.length)return res.status(409).json({message:'La alarma no existe o ya fue aceptada'});res.json({message:'Alarma aceptada'});}catch(error){res.status(500).json({message:'No se pudo aceptar la alarma',error:error.message});}
};

const marcarLeida = async (req, res) => {
  try {
    const usuarioId = Number(req.usuario?.usuario_id);
    const alarmaId = Number(req.params.id);
    if (!usuarioId || !alarmaId) return res.status(400).json({ message: 'Datos inválidos' });
    const pool = await conectarDB();
    const result = await pool.request()
      .input('usuario_id', sql.BigInt, usuarioId)
      .input('alarma_id', sql.BigInt, alarmaId)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM AlarmaProyecto WHERE alarma_id = @alarma_id AND activa = 1)
          THROW 50001, 'Alarma no encontrada', 1;
        IF NOT EXISTS (SELECT 1 FROM AlarmaLectura WHERE alarma_id = @alarma_id AND usuario_id = @usuario_id)
          INSERT INTO AlarmaLectura (alarma_id, usuario_id) VALUES (@alarma_id, @usuario_id);
        SELECT fecha_lectura FROM AlarmaLectura WHERE alarma_id = @alarma_id AND usuario_id = @usuario_id;
      `);
    res.json({ message: 'Alarma marcada como leída', fecha_lectura: result.recordset[0]?.fecha_lectura });
  } catch (error) {
    const status = error.number === 50001 ? 404 : 500;
    res.status(status).json({ message: status === 404 ? 'Alarma no encontrada' : 'Error al actualizar la alarma', error: error.message });
  }
};

const marcarTodasLeidas = async (req, res) => {
  try {
    const usuarioId = Number(req.usuario?.usuario_id);
    const proyectoId = req.body?.proyecto_id ? Number(req.body.proyecto_id) : null;
    if (!usuarioId) return res.status(401).json({ message: 'Usuario inválido' });
    if (req.body?.proyecto_id && !proyectoId) return res.status(400).json({ message: 'Proyecto inválido' });
    const pool = await conectarDB();
    const result = await pool.request()
      .input('usuario_id', sql.BigInt, usuarioId)
      .input('proyecto_id', sql.BigInt, proyectoId)
      .query(`
        INSERT INTO AlarmaLectura (alarma_id, usuario_id)
        SELECT a.alarma_id, @usuario_id
        FROM AlarmaProyecto a
        WHERE a.activa = 1 AND (@proyecto_id IS NULL OR a.proyecto_id = @proyecto_id)
          AND NOT EXISTS (SELECT 1 FROM AlarmaLectura l WHERE l.alarma_id = a.alarma_id AND l.usuario_id = @usuario_id);
        SELECT @@ROWCOUNT AS actualizadas;
      `);
    res.json({ message: 'Alarmas marcadas como leídas', actualizadas: result.recordset[0].actualizadas });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar las alarmas', error: error.message });
  }
};

const CATEGORIAS = new Set(['OPERACIONES', 'BOM', 'CERTIFICACIONES', 'COMPRAS', 'PROYECTO']);
const ESTADOS = new Set(['ACTIVA', 'PAUSADA']);
const TIPOS_CERTIFICACION = new Set(['EMISION_PROXIMA','SIN_COBRO','RESPONSABLE_SIN_PAGO']);

const listarReglas = async (req, res) => {
  try {
    const proyectoId = Number(req.params.proyectoId);
    if (!proyectoId) return res.status(400).json({ message: 'Proyecto inválido' });
    const pool = await conectarDB();
    const result = await pool.request().input('proyecto_id', sql.BigInt, proyectoId).query(`
      SELECT regla_id, proyecto_id, categoria, tipo, nombre, mensaje, parametros_json,
        alcance, entidades_json, estado, fecha_creacion, fecha_actualizacion
      FROM ReglaAlarmaProyecto WHERE proyecto_id=@proyecto_id ORDER BY fecha_actualizacion DESC, regla_id DESC
    `);
    res.json(result.recordset.map(r => ({ ...r, parametros: r.parametros_json ? JSON.parse(r.parametros_json) : {}, entidades: r.entidades_json ? JSON.parse(r.entidades_json) : [] })));
  } catch (error) { res.status(500).json({ message: 'Error al obtener las reglas', error: error.message }); }
};

const datosRegla = body => ({
  categoria: String(body.categoria || '').toUpperCase(), tipo: String(body.tipo || '').trim(),
  nombre: String(body.nombre || '').trim(), mensaje: String(body.mensaje || '').trim(),
  parametros: body.parametros && typeof body.parametros === 'object' ? body.parametros : {},
  alcance: body.alcance === 'SELECCIONADAS' ? 'SELECCIONADAS' : 'TODAS',
  entidades: Array.isArray(body.entidades) ? body.entidades : [],
  estado: String(body.estado || 'ACTIVA').toUpperCase()
});

const validarRegla = d => {
  if (!CATEGORIAS.has(d.categoria)) return 'Categoría inválida';
  if (!d.tipo || !d.nombre || !d.mensaje) return 'Tipo, nombre y mensaje son obligatorios';
  if (!ESTADOS.has(d.estado)) return 'Estado inválido';
  if (d.categoria === 'CERTIFICACIONES' && !TIPOS_CERTIFICACION.has(d.tipo)) return 'Tipo de alarma de certificación inválido';
  if (d.categoria === 'CERTIFICACIONES' && (!Number.isFinite(Number(d.parametros.dias)) || Number(d.parametros.dias)<0)) return 'Ingresá una cantidad de días válida';
  if (d.categoria === 'OPERACIONES' && d.alcance === 'SELECCIONADAS' && !d.entidades.length) return 'Seleccioná al menos una operación';
  if (d.nombre.length > 150 || d.mensaje.length > 500) return 'Nombre o mensaje demasiado largo';
  return null;
};

const operacionesValidas = async (pool, proyectoId, entidades) => {
  if (!entidades.length) return false;
  const result = await pool.request().input('proyecto_id',sql.BigInt,proyectoId).input('entidades',sql.NVarChar(sql.MAX),JSON.stringify(entidades)).query(`
    SELECT COUNT(DISTINCT j.id) solicitadas, COUNT(DISTINCT o.operacion_id) validas
    FROM OPENJSON(@entidades) WITH (id BIGINT '$') j
    LEFT JOIN Operacion o ON o.operacion_id=j.id AND o.proyecto_id=@proyecto_id AND ISNULL(o.archivada,0)=0
      AND o.version_id=(SELECT TOP 1 version_id FROM VersionPlan WHERE proyecto_id=@proyecto_id AND es_activa=1)
  `);
  const r=result.recordset[0];
  return Number(r.solicitadas)>0 && Number(r.solicitadas)===Number(r.validas);
};
const materialBomValido = async (pool,proyectoId,entidades) => { if(entidades.length!==1)return false;const r=await pool.request().input('proyecto_id',sql.BigInt,proyectoId).input('material_id',sql.BigInt,Number(entidades[0])).query('SELECT TOP 1 1 ok FROM BomOperacion WHERE proyecto_id=@proyecto_id AND material_id=@material_id');return !!r.recordset.length; };
const certificacionesValidas = async(pool,proyectoId,tipo,entidades) => {
  if(!entidades.length)return false;
  const fuente=tipo==='EMISION_PROXIMA'
    ? `SELECT DISTINCT numero_certificado_planificado id FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1 WHERE o.proyecto_id=@proyecto_id AND ISNULL(o.archivada,0)=0 AND numero_certificado_planificado IS NOT NULL`
    : tipo==='SIN_COBRO' ? `SELECT certificado_cliente_id id FROM CertificadoCliente WHERE proyecto_id=@proyecto_id AND estado<>'ELIMINADO'`
    : `SELECT certificado_responsable_id id FROM CertificadoResponsable WHERE proyecto_id=@proyecto_id AND estado<>'ELIMINADO'`;
  const r=await pool.request().input('proyecto_id',sql.BigInt,proyectoId).input('entidades',sql.NVarChar(sql.MAX),JSON.stringify(entidades)).query(`SELECT COUNT(DISTINCT j.id) solicitadas,COUNT(DISTINCT f.id) validas FROM OPENJSON(@entidades) WITH(id BIGINT '$') j LEFT JOIN (${fuente}) f ON f.id=j.id`);
  return Number(r.recordset[0].solicitadas)>0&&Number(r.recordset[0].solicitadas)===Number(r.recordset[0].validas);
};

const listarOpcionesCertificaciones=async(req,res)=>{try{const proyectoId=Number(req.params.proyectoId);if(!proyectoId)return res.status(400).json({message:'Proyecto inválido'});const pool=await conectarDB();const r=await pool.request().input('proyecto_id',sql.BigInt,proyectoId).query(`
  SELECT o.numero_certificado_planificado certificado_numero,MIN(o.cronograma_certificacion_fecha) fecha_prevista,COUNT(*) operaciones FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1 WHERE o.proyecto_id=@proyecto_id AND ISNULL(o.archivada,0)=0 AND o.numero_certificado_planificado IS NOT NULL AND o.cronograma_certificacion_fecha IS NOT NULL GROUP BY o.numero_certificado_planificado ORDER BY o.numero_certificado_planificado;
  SELECT cc.certificado_cliente_id,cc.fecha_certificacion,cc.total,cc.total-ISNULL(m.pagado,0) saldo,CASE WHEN ISNULL(m.pagado,0)>=cc.total THEN 'COBRADO' WHEN ISNULL(m.pagado,0)>0 THEN 'COBRADO PARCIAL' ELSE 'EMITIDO' END estado_pago FROM CertificadoCliente cc OUTER APPLY(SELECT SUM(importe) pagado FROM MovimientoFinancieroProyecto WHERE certificado_cliente_id=cc.certificado_cliente_id AND estado='ACTIVO')m WHERE cc.proyecto_id=@proyecto_id AND cc.estado<>'ELIMINADO' ORDER BY cc.fecha_certificacion DESC;
  SELECT cr.certificado_responsable_id,cr.fecha_certificacion,cr.total,ro.nombre responsable_nombre,cr.total-ISNULL(m.pagado,0) saldo,CASE WHEN ISNULL(m.pagado,0)>=cr.total THEN 'PAGADO' WHEN ISNULL(m.pagado,0)>0 THEN 'PAGADO PARCIAL' ELSE 'EMITIDO' END estado_pago FROM CertificadoResponsable cr LEFT JOIN ResponsableOperacion ro ON ro.responsable_id=cr.responsable_id OUTER APPLY(SELECT SUM(importe) pagado FROM MovimientoFinancieroProyecto WHERE certificado_responsable_id=cr.certificado_responsable_id AND estado='ACTIVO')m WHERE cr.proyecto_id=@proyecto_id AND cr.estado<>'ELIMINADO' ORDER BY cr.fecha_certificacion DESC`);res.json({plan_cliente:r.recordsets[0],certificados_cliente:r.recordsets[1],certificados_responsable:r.recordsets[2]});}catch(error){res.status(500).json({message:'No se pudieron cargar las certificaciones',error:error.message});}};

const crearRegla = async (req, res) => {
  const proyectoId = Number(req.params.proyectoId), usuarioId = Number(req.usuario?.usuario_id), d = datosRegla(req.body);
  const errorValidacion = validarRegla(d);
  if (!proyectoId || !usuarioId) return res.status(400).json({ message: 'Datos inválidos' });
  if (errorValidacion) return res.status(400).json({ message: errorValidacion });
  try {
    const pool = await conectarDB();
    if (d.categoria === 'OPERACIONES' && d.alcance === 'SELECCIONADAS' && !(await operacionesValidas(pool, proyectoId, d.entidades))) return res.status(400).json({message:'Una o más operaciones no pertenecen al plan activo del proyecto'});
    if (d.categoria === 'BOM' && !(await materialBomValido(pool,proyectoId,d.entidades))) return res.status(400).json({message:'Seleccioná un material perteneciente al BOM del proyecto'});
    if (d.categoria === 'CERTIFICACIONES' && d.alcance === 'SELECCIONADAS' && !(await certificacionesValidas(pool,proyectoId,d.tipo,d.entidades))) return res.status(400).json({message:'Una o más certificaciones seleccionadas no pertenecen al proyecto'});
    const result = await pool.request().input('proyecto_id',sql.BigInt,proyectoId).input('categoria',sql.VarChar(30),d.categoria).input('tipo',sql.VarChar(80),d.tipo).input('nombre',sql.NVarChar(150),d.nombre).input('mensaje',sql.NVarChar(500),d.mensaje).input('parametros',sql.NVarChar(sql.MAX),JSON.stringify(d.parametros)).input('alcance',sql.VarChar(20),d.alcance).input('entidades',sql.NVarChar(sql.MAX),JSON.stringify(d.entidades)).input('estado',sql.VarChar(15),d.estado).input('usuario_id',sql.BigInt,usuarioId).query(`
      INSERT INTO ReglaAlarmaProyecto(proyecto_id,categoria,tipo,nombre,mensaje,parametros_json,alcance,entidades_json,estado,creada_por)
      OUTPUT INSERTED.* VALUES(@proyecto_id,@categoria,@tipo,@nombre,@mensaje,@parametros,@alcance,@entidades,@estado,@usuario_id)
    `);
    res.status(201).json({ message: 'Regla creada correctamente', regla: result.recordset[0] });
  } catch (error) { res.status(500).json({ message: 'Error al crear la regla', error: error.message }); }
};

const actualizarRegla = async (req, res) => {
  const proyectoId=Number(req.params.proyectoId), reglaId=Number(req.params.reglaId), d=datosRegla(req.body), errorValidacion=validarRegla(d);
  if (!proyectoId || !reglaId) return res.status(400).json({ message:'Datos inválidos' });
  if (errorValidacion) return res.status(400).json({ message:errorValidacion });
  try {
    const pool=await conectarDB();
    if (d.categoria === 'OPERACIONES' && d.alcance === 'SELECCIONADAS' && !(await operacionesValidas(pool, proyectoId, d.entidades))) return res.status(400).json({message:'Una o más operaciones no pertenecen al plan activo del proyecto'});
    if (d.categoria === 'BOM' && !(await materialBomValido(pool,proyectoId,d.entidades))) return res.status(400).json({message:'Seleccioná un material perteneciente al BOM del proyecto'});
    if (d.categoria === 'CERTIFICACIONES' && d.alcance === 'SELECCIONADAS' && !(await certificacionesValidas(pool,proyectoId,d.tipo,d.entidades))) return res.status(400).json({message:'Una o más certificaciones seleccionadas no pertenecen al proyecto'});
    const result=await pool.request().input('proyecto_id',sql.BigInt,proyectoId).input('regla_id',sql.BigInt,reglaId).input('categoria',sql.VarChar(30),d.categoria).input('tipo',sql.VarChar(80),d.tipo).input('nombre',sql.NVarChar(150),d.nombre).input('mensaje',sql.NVarChar(500),d.mensaje).input('parametros',sql.NVarChar(sql.MAX),JSON.stringify(d.parametros)).input('alcance',sql.VarChar(20),d.alcance).input('entidades',sql.NVarChar(sql.MAX),JSON.stringify(d.entidades)).input('estado',sql.VarChar(15),d.estado).query(`UPDATE ReglaAlarmaProyecto SET categoria=@categoria,tipo=@tipo,nombre=@nombre,mensaje=@mensaje,parametros_json=@parametros,alcance=@alcance,entidades_json=@entidades,estado=@estado,fecha_actualizacion=SYSUTCDATETIME() OUTPUT INSERTED.* WHERE regla_id=@regla_id AND proyecto_id=@proyecto_id`);
    if(!result.recordset.length)return res.status(404).json({message:'Regla no encontrada'});
    res.json({message:'Regla actualizada correctamente',regla:result.recordset[0]});
  } catch(error){res.status(500).json({message:'Error al actualizar la regla',error:error.message});}
};

const eliminarRegla = async (req,res) => { try { const pool=await conectarDB(); const result=await pool.request().input('proyecto_id',sql.BigInt,Number(req.params.proyectoId)).input('regla_id',sql.BigInt,Number(req.params.reglaId)).query('DELETE FROM ReglaAlarmaProyecto WHERE regla_id=@regla_id AND proyecto_id=@proyecto_id'); if(!result.rowsAffected[0])return res.status(404).json({message:'Regla no encontrada'}); res.json({message:'Regla eliminada correctamente'}); } catch(error){res.status(500).json({message:'Error al eliminar la regla',error:error.message});} };

module.exports = { listar, marcarLeida, marcarTodasLeidas, aceptar, listarReglas, listarOpcionesCertificaciones, crearRegla, actualizarRegla, eliminarRegla };
