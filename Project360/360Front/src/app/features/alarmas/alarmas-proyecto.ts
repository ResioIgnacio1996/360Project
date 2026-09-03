import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Alarma, AlarmasService, CategoriaAlarma, ReglaAlarma } from '../../core/services/alarmas/alarmas.service';
import { OperacionProgramada, ProgramacionService } from '../../core/services/programacion/programacion';
import { BomService } from '../../core/services/bom/bom';

@Component({ selector:'app-alarmas-proyecto', standalone:true, imports:[CommonModule,FormsModule,RouterLink], templateUrl:'./alarmas-proyecto.html', styleUrl:'./alarmas-proyecto.css' })
export class AlarmasProyecto implements OnInit {
  proyectoId:number; reglas:ReglaAlarma[]=[]; operaciones:OperacionProgramada[]=[]; materialesBom:any[]=[]; opcionesCertificacion:any={plan_cliente:[],certificados_cliente:[],certificados_responsable:[]}; alarmas:Alarma[]=[]; tab:'CONFIGURACION'|'ALARMAS'='CONFIGURACION'; filtroEstado:'ACTIVA'|'ACEPTADA'|'TODAS'='ACTIVA'; filtroOperaciones=''; filtroMaterialBom=''; filtroCertificaciones=''; cargando=true; cargandoAlarmas=false; error=''; errorFormulario=''; modal=false; modalAceptar=false; alarmaAceptar:Alarma|null=null; comentarioAceptacion=''; guardando=false;
  categorias = [
    { clave:'OPERACIONES' as CategoriaAlarma,titulo:'Operaciones',icono:'engineering',descripcion:'Fechas, estados, responsables, avances y consumos.' },
    { clave:'BOM' as CategoriaAlarma,titulo:'BOM',icono:'inventory_2',descripcion:'Stock, materiales sin código y preavisos.' },
    { clave:'CERTIFICACIONES' as CategoriaAlarma,titulo:'Certificaciones',icono:'request_quote',descripcion:'Emisiones, cobros, pagos y caja.' },
    { clave:'COMPRAS' as CategoriaAlarma,titulo:'Ingreso de materiales',icono:'local_shipping',descripcion:'Órdenes, entregas, vencimientos y remitos.' }
  ];
  tipos:Record<CategoriaAlarma,{valor:string;texto:string;mensaje:string}[]> = {
    OPERACIONES:[
      {valor:'INICIO_PROXIMO',texto:'Inicio próximo',mensaje:'La operación {nombre} comienza en {N} días.'},
      {valor:'FIN_PROXIMO',texto:'Fin próximo',mensaje:'La operación {nombre} vence en {N} días.'},
      {valor:'CONSUMO_SUPERA_TEORICO',texto:'Consumo supera el teórico',mensaje:'{nombre}: el consumo de {material} superó el {porcentaje}% del teórico.'},
      {valor:'CAMBIO_ESTADO_RIESGO',texto:'Cambio a estado de riesgo o atraso',mensaje:'La operación {nombre} pasó a estado {estado}.'},
      {valor:'SIN_AVANCE',texto:'Sin avance registrado',mensaje:'La operación {nombre} no registra avance hace {N} días.'}
    ],
    BOM:[{valor:'STOCK_MINIMO',texto:'Stock mínimo de material',mensaje:'{material}: stock disponible ({stock}) por debajo del mínimo ({minimo}).'},{valor:'PREAVISO_PEDIDO',texto:'Pre-aviso de pedido',mensaje:'{material} debe pedirse: una operación que lo utiliza comienza en {N} días.'}],
    CERTIFICACIONES:[{valor:'EMISION_PROXIMA',texto:'Certificación próxima a emitir',mensaje:'El certificado planificado {nombre} debe emitirse en {N} días.'},{valor:'SIN_COBRO',texto:'Certificado emitido sin cobro registrado',mensaje:'El certificado al cliente {nombre} superó {N} días y mantiene un saldo pendiente de {saldo}.'},{valor:'RESPONSABLE_SIN_PAGO',texto:'Certificado a responsable emitido sin pago',mensaje:'El certificado a responsable {nombre} superó {N} días y mantiene un saldo pendiente de {saldo}.'}],
    COMPRAS:[{valor:'ENTREGA_PROXIMA',texto:'Entrega próxima',mensaje:'{nombre}: entrega en {N} días.'},{valor:'PAGO_PROXIMO',texto:'Vencimiento de pago',mensaje:'{nombre}: vence el pago en {N} días.'}],
    PROYECTO:[]
  };
  regla:ReglaAlarma;
  constructor(route:ActivatedRoute,private api:AlarmasService,private programacionApi:ProgramacionService,private bomApi:BomService){this.proyectoId=Number(route.snapshot.paramMap.get('id'));this.regla=this.nuevaRegla('OPERACIONES');}
  ngOnInit(){this.cargar();this.cargarOperaciones();this.cargarMaterialesBom();this.cargarOpcionesCertificaciones();}
  nuevaRegla(categoria:CategoriaAlarma):ReglaAlarma { const tipo=this.tipos[categoria][0]; return {categoria,tipo:tipo?.valor||'',nombre:tipo?.texto||'',mensaje:tipo?.mensaje||'',parametros:{dias:3,porcentaje:110,minimo:0,estados:['EN_RIESGO','ATRASADA']},alcance:categoria==='OPERACIONES'?'SELECCIONADAS':'TODAS',entidades:[],estado:'ACTIVA'}; }
  cargarMaterialesBom(){this.bomApi.listar(this.proyectoId).subscribe(lineas=>{const mapa=new Map<number,any>();for(const l of lineas)if(l.material_id&&!mapa.has(Number(l.material_id)))mapa.set(Number(l.material_id),{material_id:Number(l.material_id),nombre:l.descripcion_libre,unidad:l.unidad});this.materialesBom=[...mapa.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre));});}
  cargarOpcionesCertificaciones(){this.api.opcionesCertificaciones(this.proyectoId).subscribe({next:r=>this.opcionesCertificacion=r,error:()=>this.error='No se pudieron cargar las certificaciones del proyecto'});}
  materialesBomFiltrados(){const q=this.filtroMaterialBom.trim().toLocaleLowerCase();return q?this.materialesBom.filter(m=>String(m.nombre).toLocaleLowerCase().includes(q)):this.materialesBom;}
  cambiarTab(tab:'CONFIGURACION'|'ALARMAS'){this.tab=tab;if(tab==='ALARMAS')this.cargarAlarmas();}
  cargarAlarmas(){this.cargandoAlarmas=true;this.api.listar(this.proyectoId,100,this.filtroEstado).subscribe({next:r=>{this.alarmas=r.alarmas;this.cargandoAlarmas=false;},error:e=>{this.error=e?.error?.message||'No se pudieron cargar las alarmas';this.cargandoAlarmas=false;}});}
  abrirAceptar(a:Alarma){this.alarmaAceptar=a;this.comentarioAceptacion='';this.modalAceptar=true;}
  aceptarAlarma(){if(!this.alarmaAceptar||!this.comentarioAceptacion.trim())return;this.guardando=true;this.api.aceptar(this.alarmaAceptar.alarma_id,this.comentarioAceptacion.trim()).subscribe({next:()=>{this.guardando=false;this.modalAceptar=false;this.cargarAlarmas();},error:e=>{this.guardando=false;this.error=e?.error?.message||'No se pudo aceptar la alarma';}});}
  cargarOperaciones(){this.programacionApi.obtener(this.proyectoId).subscribe({next:r=>this.operaciones=(r?.operaciones||[]).filter((o:OperacionProgramada)=>!o.archivada),error:()=>this.error='No se pudieron cargar las operaciones del proyecto'});}
  cargar(){this.cargando=true;this.api.listarReglas(this.proyectoId).subscribe({next:r=>{this.reglas=r;this.cargando=false;this.error='';},error:e=>{this.error=e?.error?.message||'No se pudieron cargar las reglas';this.cargando=false;}});}
  cantidad(c:CategoriaAlarma){return this.reglas.filter(r=>r.categoria===c&&r.estado==='ACTIVA').length;}
  abrirNueva(c:CategoriaAlarma='OPERACIONES'){this.regla=this.nuevaRegla(c);this.filtroOperaciones='';this.filtroCertificaciones='';this.modal=true;this.error='';this.errorFormulario='';}
  editar(r:ReglaAlarma){const entidades=r.categoria==='OPERACIONES'&&r.alcance==='TODAS'?this.operaciones.map(o=>Number(o.operacion_id)):[...(r.entidades||[])];this.regla={...r,parametros:{...(r.parametros||{})},entidades};this.filtroOperaciones='';this.modal=true;this.errorFormulario='';}
  cerrar(){this.modal=false;}
  cambioCategoria(c:CategoriaAlarma){this.regla=this.nuevaRegla(c);}
  cambioTipo(){const t=this.tipos[this.regla.categoria].find(x=>x.valor===this.regla.tipo);if(t){this.regla.nombre=t.texto;this.regla.mensaje=t.mensaje;}if(this.regla.categoria==='CERTIFICACIONES'){this.regla.entidades=[];if(this.regla.tipo==='RESPONSABLE_SIN_PAGO')this.regla.alcance='TODAS';}this.errorFormulario='';}
  certificacionesDisponibles(){return this.regla.tipo==='EMISION_PROXIMA'?this.opcionesCertificacion.plan_cliente:this.regla.tipo==='SIN_COBRO'?this.opcionesCertificacion.certificados_cliente:this.opcionesCertificacion.certificados_responsable;}
  idCertificacion(x:any){return Number(x.certificado_numero??x.certificado_cliente_id??x.certificado_responsable_id);}
  certificacionesFiltradas(){const q=this.filtroCertificaciones.trim().toLocaleLowerCase();return this.certificacionesDisponibles().filter((x:any)=>!q||[this.idCertificacion(x),x.responsable_nombre,x.estado_pago,x.fecha_prevista,x.fecha_certificacion].some(v=>String(v||'').toLocaleLowerCase().includes(q)));}
  certificacionSeleccionada(x:any){return this.regla.entidades.map(Number).includes(this.idCertificacion(x));}
  alternarCertificacion(x:any,seleccionada:boolean){const ids=new Set(this.regla.entidades.map(Number)),id=this.idCertificacion(x);seleccionada?ids.add(id):ids.delete(id);this.regla.entidades=[...ids];this.errorFormulario='';}
  alternarTodasCertificaciones(seleccionar:boolean){this.regla.entidades=seleccionar?this.certificacionesDisponibles().map((x:any)=>this.idCertificacion(x)):[];this.errorFormulario='';}
  todasCertificacionesSeleccionadas(){return !!this.certificacionesDisponibles().length&&this.regla.entidades.length===this.certificacionesDisponibles().length;}
  guardar(){
    this.errorFormulario='';
    if(!this.regla.nombre.trim()||!this.regla.tipo||!this.regla.mensaje.trim()){this.errorFormulario='Completá nombre, tipo y mensaje.';return;}
    if(this.regla.categoria==='OPERACIONES'&&this.regla.alcance==='SELECCIONADAS'&&!this.regla.entidades.length){this.errorFormulario='Seleccioná al menos una operación.';return;}
    if(this.regla.categoria==='BOM'&&this.regla.entidades.length!==1){this.errorFormulario='Seleccioná un material del BOM.';return;}
    if(this.regla.categoria==='CERTIFICACIONES'&&this.regla.alcance==='SELECCIONADAS'&&!this.regla.entidades.length){this.errorFormulario='Seleccioná al menos una certificación.';return;}
    this.guardando=true;const op=this.regla.regla_id?this.api.actualizarRegla(this.proyectoId,this.regla):this.api.crearRegla(this.proyectoId,this.regla);op.subscribe({next:()=>{this.guardando=false;this.modal=false;this.cargar();},error:e=>{this.guardando=false;this.errorFormulario=e?.error?.message||'No se pudo guardar la regla';}});
  }
  alternarEstado(estado:string,activo:boolean){const actuales=new Set<string>(this.regla.parametros['estados']||[]);activo?actuales.add(estado):actuales.delete(estado);this.regla.parametros['estados']=[...actuales];}
  estadoSeleccionado(estado:string){return (this.regla.parametros['estados']||[]).includes(estado);}
  operacionesFiltradas(){const q=this.filtroOperaciones.trim().toLocaleLowerCase();if(!q)return this.operaciones;return this.operaciones.filter(o=>[o.secuencia,`op-${o.secuencia}`,o.nombre,o.etapa_nombre,o.responsable_nombre,o.estado_label,o.estado_codigo].some(v=>String(v||'').toLocaleLowerCase().includes(q)));}
  operacionSeleccionada(id:number){return this.regla.entidades.map(Number).includes(Number(id));}
  alternarOperacion(id:number,seleccionada:boolean){const ids=new Set(this.regla.entidades.map(Number));seleccionada?ids.add(Number(id)):ids.delete(Number(id));this.regla.entidades=[...ids];this.regla.alcance=this.operaciones.length>0&&this.regla.entidades.length===this.operaciones.length?'TODAS':'SELECCIONADAS';this.errorFormulario='';}
  alternarTodasOperaciones(seleccionar:boolean){this.regla.entidades=seleccionar?this.operaciones.map(o=>Number(o.operacion_id)):[];this.regla.alcance=seleccionar?'TODAS':'SELECCIONADAS';this.errorFormulario='';}
  todasOperacionesSeleccionadas(){return !!this.operaciones.length&&this.regla.entidades.length===this.operaciones.length;}
  nombresOperaciones(r:ReglaAlarma){if(r.alcance==='TODAS')return 'Todas las operaciones';const ids=new Set(r.entidades.map(Number));const nombres=this.operaciones.filter(o=>ids.has(Number(o.operacion_id))).map(o=>`OP-${o.secuencia} ${o.nombre}`);return nombres.length?nombres.join(', '):`${r.entidades.length} operación/es seleccionada/s`;}
  pausar(r:ReglaAlarma){const actualizada={...r,estado:(r.estado==='ACTIVA'?'PAUSADA':'ACTIVA') as 'ACTIVA'|'PAUSADA'};this.api.actualizarRegla(this.proyectoId,actualizada).subscribe(()=>this.cargar());}
  eliminar(r:ReglaAlarma){if(!r.regla_id||!confirm(`¿Eliminar la regla "${r.nombre}"?`))return;this.api.eliminarRegla(this.proyectoId,r.regla_id).subscribe(()=>this.cargar());}
}
