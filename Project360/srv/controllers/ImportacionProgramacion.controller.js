const { conectarDB, sql } = require('../DB/dbConection');

const requeridos = {
  etapas: ['codigo', 'nombre', 'orden', 'peso_pct'],
  responsables: ['codigo', 'nombre', 'tipo'],
  operaciones: ['etapa', 'secuencia', 'nombre', 'depende_de', 'desfase_inicio_hs', 'responsable', 'duracion_hs', 'unidad_avance', 'cantidad_meta', 'peso_pct', 'criterio_cierre', 'descripcion', 'cant_materiales'],
  materiales: ['etapa', 'secuencia_op', 'nro_linea', 'descripcion_libre', 'cantidad_teorica', 'unidad'],
  calendario: ['campo', 'valor', 'descripcion'],
  excepciones: ['fecha', 'tipo', 'hs_disponibles', 'motivo', 'recuperable']
};

function parseCsv(buffer) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return { headers: [], data: [] };
  const headers = rows[0].map(v => v.trim().toLowerCase());
  return { headers, data: rows.slice(1).map((values, index) => Object.fromEntries(headers.map((h, i) => [h, (values[i] || '').trim()]))).map((r, i) => ({ ...r, _fila: i + 2 })) };
}

const numero = value => value === '' || value == null ? null : Number(value);
const limpiarFilas = rows => rows.map(({ _fila, ...row }) => row);

function normalizar(files) {
  const parsed = {};
  for (const key of Object.keys(requeridos)) {
    if (!files[key]?.[0]) throw new Error(`Falta el archivo ${key}.csv`);
    parsed[key] = parseCsv(files[key][0].buffer);
  }
  return {
    parsed,
    datos: {
      etapas: parsed.etapas.data.map(r => ({ codigo:r.codigo, nombre:r.nombre, orden:numero(r.orden), peso_pct:numero(r.peso_pct), _fila:r._fila })),
      responsables: parsed.responsables.data.map(r => ({ codigo:r.codigo, nombre:r.nombre, tipo:r.tipo, _fila:r._fila })),
      operaciones: parsed.operaciones.data.map(r => ({
        etapa:r.etapa, secuencia:numero(r.secuencia), nombre:r.nombre, depende_de:r.depende_de,
        desfase_inicio_hs:numero(r.desfase_inicio_hs) || 0, responsable:r.responsable,
        duracion_hs:numero(r.duracion_hs), unidad_avance:r.unidad_avance,
        cantidad_meta:numero(r.cantidad_meta), peso_pct:numero(r.peso_pct),
        criterio_cierre:r.criterio_cierre, descripcion:r.descripcion,
        cant_materiales:numero(r.cant_materiales) || 0, _fila:r._fila
      })),
      materiales: parsed.materiales.data.map(r => ({
        etapa:r.etapa, secuencia_op:numero(r.secuencia_op), nro_linea:numero(r.nro_linea),
        descripcion_libre:r.descripcion_libre, cantidad_teorica:numero(r.cantidad_teorica),
        unidad:r.unidad, _fila:r._fila
      })),
      calendario: parsed.calendario.data.map(r => ({ campo:r.campo, valor:r.valor, descripcion:r.descripcion, _fila:r._fila })),
      excepciones: parsed.excepciones.data.map(r => ({
        fecha:r.fecha, tipo:r.tipo, hs_disponibles:numero(r.hs_disponibles),
        motivo:r.motivo, recuperable:r.recuperable, _fila:r._fila
      }))
    }
  };
}

function validar(datos, parsed, unidadesDb = []) {
  const errores = [], advertencias = [];
  const error = (archivo, fila, columna, mensaje) => errores.push({ archivo, fila, columna, mensaje });
  for (const [key, headers] of Object.entries(requeridos)) {
    for (const h of headers) if (!parsed[key].headers.includes(h)) error(`${key}.csv`, 1, h, `Falta la columna obligatoria "${h}"`);
  }
  const etapaCodes = new Set(), respCodes = new Set(), secuencias = new Set();
  for (const e of datos.etapas) {
    if (!e.codigo) error('etapas.csv',e._fila,'codigo','Código obligatorio');
    if (etapaCodes.has(e.codigo)) error('etapas.csv',e._fila,'codigo',`Código duplicado ${e.codigo}`);
    etapaCodes.add(e.codigo);
    if (!e.nombre) error('etapas.csv',e._fila,'nombre','Nombre obligatorio');
    if (!(e.peso_pct >= 0 && e.peso_pct <= 100)) error('etapas.csv',e._fila,'peso_pct','Debe estar entre 0 y 100');
  }
  const pesoEtapas = datos.etapas.reduce((s,e)=>s+(e.peso_pct||0),0);
  if (Math.abs(pesoEtapas-100)>.1) advertencias.push({archivo:'etapas.csv',fila:null,columna:'peso_pct',mensaje:`La suma es ${pesoEtapas}%. Se normalizará a 100%.`});
  for (const r of datos.responsables) {
    if (!r.codigo) error('responsables.csv',r._fila,'codigo','Código obligatorio');
    if (respCodes.has(r.codigo)) error('responsables.csv',r._fila,'codigo',`Código duplicado ${r.codigo}`);
    respCodes.add(r.codigo);
    if (!['CUADRILLA_PROPIA','SUBCONTRATISTA'].includes(r.tipo)) error('responsables.csv',r._fila,'tipo','Use CUADRILLA_PROPIA o SUBCONTRATISTA');
  }
  for (const o of datos.operaciones) {
    if (!etapaCodes.has(o.etapa)) error('operaciones.csv',o._fila,'etapa',`La etapa ${o.etapa} no existe`);
    if (!Number.isInteger(o.secuencia)) error('operaciones.csv',o._fila,'secuencia','Debe ser un entero');
    if (secuencias.has(o.secuencia)) error('operaciones.csv',o._fila,'secuencia',`Secuencia duplicada ${o.secuencia}`);
    secuencias.add(o.secuencia);
    if (!o.nombre) error('operaciones.csv',o._fila,'nombre','Nombre obligatorio');
    if (!(o.duracion_hs > 0)) error('operaciones.csv',o._fila,'duracion_hs','Debe ser mayor a cero');
    if (!respCodes.has(o.responsable)) error('operaciones.csv',o._fila,'responsable',`El responsable ${o.responsable} no existe`);
    if (!['PORCENTAJE','CANTIDAD','BINARIO'].includes(o.unidad_avance)) error('operaciones.csv',o._fila,'unidad_avance','Unidad de avance inválida');
    if (o.unidad_avance==='CANTIDAD' && !(o.cantidad_meta>0)) error('operaciones.csv',o._fila,'cantidad_meta','Es obligatoria y mayor a cero para CANTIDAD');
    for (const dep of String(o.depende_de||'').split(';').filter(Boolean)) if (!datos.operaciones.some(x=>x.secuencia===Number(dep))) error('operaciones.csv',o._fila,'depende_de',`La secuencia ${dep} no existe`);
  }
  const aliases = { UNID:'UN',UNIDAD:'UN',BOLSAS:'BOLSA',LT:'L,LITRO',LITROS:'L',KG:'KG',TN:'TN',M2:'M2',M3:'M3',ML:'ML' };
  const unidades = new Set(unidadesDb.map(u=>u.nombre.toUpperCase()));
  for (const m of datos.materiales) {
    if (!secuencias.has(m.secuencia_op)) error('materiales.csv',m._fila,'secuencia_op',`La operación ${m.secuencia_op} no existe`);
    if (!(m.cantidad_teorica>0)) error('materiales.csv',m._fila,'cantidad_teorica','Debe ser mayor a cero');
    const u = (aliases[String(m.unidad).toUpperCase()] || String(m.unidad).toUpperCase()).split(',')[0];
    if (unidades.size && !unidades.has(u)) error('materiales.csv',m._fila,'unidad',`La unidad ${m.unidad} no existe en UoM`);
  }
  for (const o of datos.operaciones) {
    const cantidad = datos.materiales.filter(m=>m.secuencia_op===o.secuencia).length;
    if (cantidad!==o.cant_materiales) error('operaciones.csv',o._fila,'cant_materiales',`Declara ${o.cant_materiales}, pero BOM contiene ${cantidad}`);
  }
  const cal=Object.fromEntries(datos.calendario.map(r=>[r.campo,r.valor]));
  const camposCal=['nombre','zona_horaria','dia_lunes','dia_martes','dia_miercoles','dia_jueves','dia_viernes','dia_sabado','dia_domingo','hs_jornada_estandar','hora_inicio','hora_fin','hs_almuerzo','hs_jornada_parcial','hora_inicio_parcial','hora_fin_parcial'];
  for(const campo of camposCal)if(cal[campo]==null||cal[campo]==='')error('calendario.csv',null,'campo',`Falta la configuración ${campo}`);
  for(const dia of ['dia_lunes','dia_martes','dia_miercoles','dia_jueves','dia_viernes','dia_sabado','dia_domingo'])
    if(!['0','1','2'].includes(String(cal[dia])))error('calendario.csv',null,dia,'Use 0=no laborable, 1=completa o 2=parcial');
  if(!(Number(cal.hs_jornada_estandar)>0))error('calendario.csv',null,'hs_jornada_estandar','Debe ser mayor a cero');
  if(Object.values(cal).includes('2')&&!(Number(cal.hs_jornada_parcial)>0))error('calendario.csv',null,'hs_jornada_parcial','Debe ser mayor a cero si existe una jornada parcial');
  const fechasEx=new Set();
  for(const ex of datos.excepciones){
    const iso=parseFecha(ex.fecha);
    if(!iso)error('excepciones.csv',ex._fila,'fecha','Use DD/MM/AAAA o AAAA-MM-DD');
    if(iso&&fechasEx.has(iso))error('excepciones.csv',ex._fila,'fecha',`Fecha duplicada ${ex.fecha}`);
    if(iso)fechasEx.add(iso);
    if(!['FERIADO','JORNADA_REDUCIDA','JORNADA_EXTENDIDA'].includes(ex.tipo))error('excepciones.csv',ex._fila,'tipo','Tipo de excepción inválido');
    if(!(ex.hs_disponibles>=0))error('excepciones.csv',ex._fila,'hs_disponibles','Debe ser cero o mayor');
  }
  // Kahn: detectar ciclos.
  const grados = new Map(datos.operaciones.map(o=>[o.secuencia,0])), hijos = new Map();
  for (const o of datos.operaciones) for (const dep of String(o.depende_de||'').split(';').filter(Boolean).map(Number)) {
    grados.set(o.secuencia,(grados.get(o.secuencia)||0)+1);
    hijos.set(dep,[...(hijos.get(dep)||[]),o.secuencia]);
  }
  const cola=[...grados].filter(([,g])=>g===0).map(([s])=>s); let vistos=0;
  while(cola.length){const s=cola.shift();vistos++;for(const h of hijos.get(s)||[]){grados.set(h,grados.get(h)-1);if(grados.get(h)===0)cola.push(h)}}
  if(vistos!==datos.operaciones.length) error('operaciones.csv',null,'depende_de','Se detectó un ciclo de dependencias');
  return { errores, advertencias };
}

async function previsualizar(req,res) {
  try {
    const pool=await conectarDB();
    const uom=await pool.request().query('SELECT uom_id,nombre FROM UoM');
    const {parsed,datos}=normalizar(req.files||{});
    const resultado=validar(datos,parsed,uom.recordset);
    res.json({datos:Object.fromEntries(Object.entries(datos).map(([k,v])=>[k,limpiarFilas(v)])),...resultado});
  } catch(error){res.status(400).json({message:error.message})}
}

function fechaISO(d){return d.toISOString().slice(0,10)}
function parseFecha(value){
  const s=String(value||'').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m)return null;
  const iso=`${m[3]}-${m[2]}-${m[1]}`,d=new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())||fechaISO(d)!==iso?null:iso;
}
function configCalendario(rows){
  const raw=Object.fromEntries(rows.map(r=>[r.campo,r.valor]));
  return {
    ...raw,
    tipos:[Number(raw.dia_domingo),Number(raw.dia_lunes),Number(raw.dia_martes),Number(raw.dia_miercoles),Number(raw.dia_jueves),Number(raw.dia_viernes),Number(raw.dia_sabado)],
    hs_jornada_estandar:Number(raw.hs_jornada_estandar),
    hs_jornada_parcial:Number(raw.hs_jornada_parcial)
  };
}
function sumarLaboral(inicio,horas,cal,excepciones){
  const d=new Date(`${inicio}T12:00:00Z`);let restante=Number(horas),guard=3660;
  while(restante>0&&guard-->0){
    const iso=fechaISO(d),ex=excepciones.get(iso);
    const tipo=cal.tipos[d.getUTCDay()];
    const disponibles=ex?Number(ex.hs_disponibles):(tipo===1?cal.hs_jornada_estandar:tipo===2?cal.hs_jornada_parcial:0);
    if(disponibles>0)restante-=disponibles;
    if(restante>0)d.setUTCDate(d.getUTCDate()+1);
  }
  if(guard<=0)throw new Error('El calendario no ofrece horas laborables suficientes');
  return fechaISO(d);
}
function calcularFechas(ops,inicio,cal,excepciones){
  const mapa=new Map(ops.map(o=>[o.secuencia,o])), pendientes=new Set(mapa.keys());
  while(pendientes.size){
    let avance=false;
    for(const s of [...pendientes]){
      const o=mapa.get(s),deps=String(o.depende_de||'').split(';').filter(Boolean).map(Number);
      if(deps.some(d=>pendientes.has(d)))continue;
      let ini=inicio;
      if(deps.length)ini=deps.map(d=>mapa.get(d).fecha_fin_estimada).sort().at(-1);
      if(o.desfase_inicio_hs)ini=sumarLaboral(ini,o.desfase_inicio_hs,cal,excepciones);
      o.fecha_inicio_estimada=ini;o.fecha_fin_estimada=sumarLaboral(ini,o.duracion_hs,cal,excepciones);
      pendientes.delete(s);avance=true;
    }
    if(!avance)throw new Error('No se pueden calcular fechas por un ciclo de dependencias');
  }
}

async function importar(req,res){
  const datos=req.body.datos, codigo=String(req.body.version||'').trim(),fechaInicio=parseFecha(req.body.fecha_inicio_programacion);
  if(!datos||!codigo||!fechaInicio)return res.status(400).json({message:'Versión, fecha de inicio y datos son obligatorios'});
  const pool=await conectarDB();
  const tx=new sql.Transaction(pool);
  try{
    const cats=await pool.request().query('SELECT * FROM UoM; SELECT * FROM unidad_avance; SELECT * FROM estado_operacion; SELECT * FROM estado_etapa; SELECT * FROM tipo_restriccion');
    const fake=Object.fromEntries(Object.keys(requeridos).map(k=>[k,{headers:requeridos[k]}]));
    const normal=Object.fromEntries(Object.keys(requeridos).map(k=>[k,(datos[k]||[]).map((x,i)=>({...x,_fila:i+2}))]));
    const valid=validar(normal,fake,cats.recordsets[0]);
    if(valid.errores.length)return res.status(422).json({message:'Hay errores de validación',...valid});
    const proyecto=await pool.request().input('id',sql.BigInt,req.params.id).query('SELECT * FROM Proyecto WHERE proyecto_id=@id');
    if(!proyecto.recordset.length)return res.status(404).json({message:'Proyecto no encontrado'});
    const cal=configCalendario(normal.calendario);
    const excepciones=new Map(normal.excepciones.map(e=>[parseFecha(e.fecha),e]));
    calcularFechas(normal.operaciones,fechaInicio,cal,excepciones);
    await tx.begin();
    const rq=()=>new sql.Request(tx);
    await rq().input('p',sql.BigInt,req.params.id).input('n',sql.NVarChar(100),cal.nombre).input('z',sql.NVarChar(60),cal.zona_horaria)
      .input('fi',sql.Date,fechaInicio).input('lu',sql.TinyInt,cal.tipos[1]).input('ma',sql.TinyInt,cal.tipos[2]).input('mi',sql.TinyInt,cal.tipos[3]).input('ju',sql.TinyInt,cal.tipos[4]).input('vi',sql.TinyInt,cal.tipos[5]).input('sa',sql.TinyInt,cal.tipos[6]).input('do',sql.TinyInt,cal.tipos[0])
      .input('he',sql.Decimal(4,2),cal.hs_jornada_estandar).input('hi',sql.VarChar(8),cal.hora_inicio).input('hf',sql.VarChar(8),cal.hora_fin).input('ha',sql.Decimal(3,2),Number(cal.hs_almuerzo||0))
      .input('hp',sql.Decimal(4,2),cal.hs_jornada_parcial).input('hip',sql.VarChar(8),cal.hora_inicio_parcial).input('hfp',sql.VarChar(8),cal.hora_fin_parcial)
      .query(`MERGE CalendarioProyecto dst USING(SELECT @p proyecto_id) src ON dst.proyecto_id=src.proyecto_id
        WHEN MATCHED THEN UPDATE SET nombre=@n,zona_horaria=@z,fecha_inicio_programacion=@fi,
          lunes=IIF(@lu>0,1,0),martes=IIF(@ma>0,1,0),miercoles=IIF(@mi>0,1,0),jueves=IIF(@ju>0,1,0),viernes=IIF(@vi>0,1,0),sabado=IIF(@sa>0,1,0),domingo=IIF(@do>0,1,0),
          tipo_lunes=@lu,tipo_martes=@ma,tipo_miercoles=@mi,tipo_jueves=@ju,tipo_viernes=@vi,tipo_sabado=@sa,tipo_domingo=@do,
          hs_jornada_estandar=@he,hora_inicio=@hi,hora_fin=@hf,hs_almuerzo=@ha,hs_jornada_parcial=@hp,hora_inicio_parcial=@hip,hora_fin_parcial=@hfp,fecha_actualizacion=SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT(proyecto_id,nombre,zona_horaria,fecha_inicio_programacion,lunes,martes,miercoles,jueves,viernes,sabado,domingo,tipo_lunes,tipo_martes,tipo_miercoles,tipo_jueves,tipo_viernes,tipo_sabado,tipo_domingo,hs_jornada_estandar,hora_inicio,hora_fin,hs_almuerzo,hs_jornada_parcial,hora_inicio_parcial,hora_fin_parcial)
          VALUES(@p,@n,@z,@fi,IIF(@lu>0,1,0),IIF(@ma>0,1,0),IIF(@mi>0,1,0),IIF(@ju>0,1,0),IIF(@vi>0,1,0),IIF(@sa>0,1,0),IIF(@do>0,1,0),@lu,@ma,@mi,@ju,@vi,@sa,@do,@he,@hi,@hf,@ha,@hp,@hip,@hfp);`);
    const calendarioRow=await rq().input('p',sql.BigInt,req.params.id).query('SELECT calendario_id FROM CalendarioProyecto WHERE proyecto_id=@p');
    const calendarioId=calendarioRow.recordset[0].calendario_id;
    await rq().input('c',sql.BigInt,calendarioId).query('DELETE FROM ExcepcionCalendario WHERE calendario_id=@c');
    for(const ex of normal.excepciones)await rq().input('c',sql.BigInt,calendarioId).input('f',sql.Date,parseFecha(ex.fecha)).input('t',sql.NVarChar(30),ex.tipo).input('h',sql.Decimal(4,2),ex.hs_disponibles).input('m',sql.NVarChar(200),ex.motivo||null).input('r',sql.Bit,String(ex.recuperable).toLowerCase()==='si'||String(ex.recuperable).toLowerCase()==='sí')
      .query('INSERT INTO ExcepcionCalendario(calendario_id,fecha,tipo,hs_disponibles,motivo,recuperable) VALUES(@c,@f,@t,@h,@m,@r)');
    const existente=await rq().input('p',sql.BigInt,req.params.id).input('c',sql.NVarChar(20),codigo).query('SELECT version_id FROM VersionPlan WHERE proyecto_id=@p AND codigo=@c');
    if(existente.recordset.length){await tx.rollback();return res.status(409).json({message:`La versión ${codigo} ya existe`})}
    const anterior=await rq().input('p',sql.BigInt,req.params.id).query(`
      SELECT o.* FROM Operacion o
      JOIN VersionPlan v ON v.version_id=o.version_id
      WHERE o.proyecto_id=@p AND v.es_activa=1`);
    const avanceAnterior=new Map(anterior.recordset.map(o=>[Number(o.secuencia),o]));
    await rq().input('p',sql.BigInt,req.params.id).query('UPDATE VersionPlan SET es_activa=0 WHERE proyecto_id=@p AND es_activa=1');
    const ver=await rq().input('p',sql.BigInt,req.params.id).input('c',sql.NVarChar(20),codigo).input('u',sql.BigInt,req.usuario.usuario_id).input('n',sql.Int,normal.operaciones.length)
      .query('INSERT INTO VersionPlan(proyecto_id,codigo,es_activa,importado_por,operaciones_nuevas) OUTPUT INSERTED.version_id VALUES(@p,@c,1,@u,@n)');
    const versionId=ver.recordset[0].version_id;
    const respMap=new Map();
    for(const r of normal.responsables){
      const rr=await rq().input('c',sql.NVarChar(20),r.codigo).input('n',sql.NVarChar(200),r.nombre).input('t',sql.NVarChar(30),r.tipo)
        .query(`MERGE ResponsableOperacion AS dst USING (SELECT @c codigo) src ON dst.codigo=src.codigo
          WHEN MATCHED THEN UPDATE SET nombre=@n,tipo=@t,activo=1
          WHEN NOT MATCHED THEN INSERT(codigo,nombre,tipo) VALUES(@c,@n,@t)
          OUTPUT INSERTED.responsable_id;`);
      respMap.set(r.codigo,rr.recordset[0].responsable_id);
    }
    const estadoEtapa=cats.recordsets[3].find(x=>x.codigo==='PENDIENTE').estado_id;
    const etapaMap=new Map(), suma=normal.etapas.reduce((s,e)=>s+Number(e.peso_pct),0);
    for(const e of normal.etapas){
      const peso=Math.abs(suma-100)>.1?Number(e.peso_pct)*100/suma:Number(e.peso_pct);
      const er=await rq().input('p',sql.BigInt,req.params.id).input('v',sql.BigInt,versionId).input('es',sql.BigInt,estadoEtapa)
        .input('c',sql.NVarChar(20),e.codigo).input('n',sql.NVarChar(200),e.nombre).input('o',sql.SmallInt,e.orden).input('pe',sql.Decimal(5,2),peso)
        .query('INSERT INTO EtapaOperacion(proyecto_id,version_id,estado_id,codigo,nombre,orden,peso_pct) OUTPUT INSERTED.etapa_id VALUES(@p,@v,@es,@c,@n,@o,@pe)');
      etapaMap.set(e.codigo,er.recordset[0].etapa_id);
    }
    const estadoOp=cats.recordsets[2].find(x=>x.codigo==='PENDIENTE').estado_id;
    const estadoCurso=cats.recordsets[2].find(x=>x.codigo==='EN_CURSO').estado_id;
    const estadoCompleta=cats.recordsets[2].find(x=>x.codigo==='COMPLETA').estado_id;
    const restr=cats.recordsets[4].find(x=>x.codigo==='LO_ANTES_POSIBLE').tipo_restriccion_id;
    const opMap=new Map();
    for(const o of normal.operaciones){
      const ua=cats.recordsets[1].find(x=>x.codigo===o.unidad_avance);
      const previa=avanceAnterior.get(Number(o.secuencia));
      const pct=Number(previa?.pct_avance_actual||0);
      const estadoConservado=pct>=100?estadoCompleta:pct>0?estadoCurso:(previa?.estado_id||estadoOp);
      const or=await rq().input('e',sql.BigInt,etapaMap.get(o.etapa)).input('p',sql.BigInt,req.params.id).input('v',sql.BigInt,versionId)
        .input('r',sql.BigInt,respMap.get(o.responsable)).input('es',sql.BigInt,estadoConservado).input('ua',sql.BigInt,ua.unidad_avance_id).input('tr',sql.BigInt,restr)
        .input('s',sql.Int,o.secuencia).input('n',sql.NVarChar(200),o.nombre).input('d',sql.NVarChar(sql.MAX),o.descripcion||null).input('cc',sql.NVarChar(sql.MAX),o.criterio_cierre||null)
        .input('dh',sql.Decimal(8,2),o.duracion_hs).input('di',sql.Int,o.desfase_inicio_hs||0).input('cm',sql.Decimal(10,2),o.cantidad_meta).input('pe',sql.Decimal(5,2),o.peso_pct)
        .input('fi',sql.Date,o.fecha_inicio_estimada).input('ff',sql.Date,o.fecha_fin_estimada).input('fir',sql.Date,previa?.fecha_inicio_real||null).input('ffr',sql.Date,previa?.fecha_fin_real||null)
        .input('pct',sql.Decimal(5,2),pct).input('ca',sql.Decimal(10,2),Number(previa?.cantidad_acumulada||0)).input('vo',sql.NVarChar(20),codigo)
        .query(`INSERT INTO Operacion(etapa_id,proyecto_id,version_id,responsable_id,estado_id,unidad_avance_id,tipo_restriccion_id,secuencia,nombre,descripcion,criterio_cierre,duracion_hs,desfase_inicio_hs,cantidad_meta,peso_pct,fecha_inicio_estimada,fecha_fin_estimada,fecha_inicio_real,fecha_fin_real,pct_avance_actual,cantidad_acumulada,version_origen)
          OUTPUT INSERTED.operacion_id VALUES(@e,@p,@v,@r,@es,@ua,@tr,@s,@n,@d,@cc,@dh,@di,@cm,@pe,@fi,@ff,@fir,@ffr,@pct,@ca,@vo)`);
      opMap.set(o.secuencia,or.recordset[0].operacion_id);
    }
    await rq().input('v',sql.BigInt,versionId).query(`
      UPDATE e SET pct_avance=ISNULL(x.avance,0),
        estado_id=CASE WHEN ISNULL(x.avance,0)>=100 THEN 3 WHEN ISNULL(x.avance,0)>0 THEN 2 ELSE 1 END
      FROM EtapaOperacion e
      OUTER APPLY (
        SELECT SUM(o.pct_avance_actual*o.peso_pct)/100.0 avance
        FROM Operacion o WHERE o.etapa_id=e.etapa_id AND o.archivada=0
      ) x WHERE e.version_id=@v`);
    for(const o of normal.operaciones)for(const dep of String(o.depende_de||'').split(';').filter(Boolean).map(Number))
      await rq().input('o',sql.BigInt,opMap.get(o.secuencia)).input('d',sql.BigInt,opMap.get(dep)).input('lag',sql.Int,o.desfase_inicio_hs||0)
        .query('INSERT INTO OperacionDependencia(operacion_id,operacion_predecesora_id,desfase_hs) VALUES(@o,@d,@lag)');
    const aliases={UNID:'UN',UNIDAD:'UN',BOLSAS:'BOLSA',LT:'L',LITROS:'L'};
    for(const m of normal.materiales){
      const nombre=aliases[String(m.unidad).toUpperCase()]||String(m.unidad).toUpperCase(),uom=cats.recordsets[0].find(x=>x.nombre.toUpperCase()===nombre);
      await rq().input('o',sql.BigInt,opMap.get(m.secuencia_op)).input('p',sql.BigInt,req.params.id).input('u',sql.BigInt,uom.uom_id).input('l',sql.SmallInt,m.nro_linea)
        .input('d',sql.NVarChar(200),m.descripcion_libre).input('c',sql.Decimal(12,3),m.cantidad_teorica)
        .query('INSERT INTO BomOperacion(operacion_id,proyecto_id,uom_id,numero_linea,descripcion_libre,cantidad_teorica,sin_codigo) VALUES(@o,@p,@u,@l,@d,@c,1)');
    }
    await tx.commit();
    res.status(201).json({message:`Versión ${codigo} importada correctamente`,resumen:{etapas:normal.etapas.length,responsables:normal.responsables.length,operaciones:normal.operaciones.length,materiales:normal.materiales.length,excepciones:normal.excepciones.length,fecha_inicio_programacion:fechaInicio}});
  }catch(error){if(tx._aborted===false)try{await tx.rollback()}catch{}res.status(500).json({message:'No se pudo importar la programación',error:error.message})}
}

module.exports={previsualizar,importar};
