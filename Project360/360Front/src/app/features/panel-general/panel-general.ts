import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PanelGeneralService } from '../../core/services/panel-general/panel-general';
import { Alarma, AlarmasService } from '../../core/services/alarmas/alarmas.service';

@Component({selector:'app-panel-general',standalone:true,imports:[CommonModule,FormsModule,RouterLink,MatIconModule],templateUrl:'./panel-general.html',styleUrls:['./panel-general.css','./panel-general-certificaciones.css','./panel-general-alarmas.css']})
export class PanelGeneral implements OnInit{
  proyectoId=0;data:any=null;cargando=true;error='';vista:'resumen'|'operativo'='resumen';
  fechaCorte=this.hoy();etapaId:number|null=null;responsableId:number|null=null;ventanaDias=30;
  etapas:any[]=[];responsables:any[]=[];alarmasConfiguradas:Alarma[]=[];filtroEstadoAlarmas:'ACTIVA'|'ACEPTADA'|'TODAS'='ACTIVA';cargandoAlarmas=false;errorAlarmas='';
  constructor(private route:ActivatedRoute,private router:Router,private api:PanelGeneralService,private alarmasApi:AlarmasService){}
  ngOnInit(){this.proyectoId=Number(this.route.snapshot.paramMap.get('id'));this.cargar();this.cargarAlarmas();}
  hoy(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  cargar(){if(!this.proyectoId)return;this.cargando=true;this.error='';this.api.obtener(this.proyectoId,{fecha_corte:this.fechaCorte,etapa_id:this.etapaId,responsable_id:this.responsableId,ventana_dias:this.ventanaDias}).subscribe({next:r=>{this.data=r;if(!this.etapaId&&!this.responsableId){this.etapas=r.avance_por_etapa||[];this.responsables=r.responsables||[];}this.cargando=false;},error:e=>{this.error=e?.error?.message||'No se pudo cargar el Panel General';this.cargando=false;}});}
  limpiarFiltros(){this.etapaId=null;this.responsableId=null;this.fechaCorte=this.hoy();this.cargar();}
  formatearFecha(v:any){if(!v)return'—';const p=String(v).slice(0,10).split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:'—';}
  numero(v:any,d=0){return Number(v||0).toLocaleString('es-AR',{minimumFractionDigits:d,maximumFractionDigits:d});}
  moneda(v:any){return Number(v||0).toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});}
  maxEstado(){const e=this.data?.operaciones_por_estado||{};return Math.max(1,e.completas||0,e.en_curso||0,e.pendientes||0,e.atrasadas||0);}
  altoEstado(v:number){return Math.max(4,Number(v||0)*100/this.maxEstado());}
  maxEtapa(){return Math.max(1,...(this.data?.avance_por_etapa||[]).map((e:any)=>Math.max(Number(e.avance_real||0),100)) );}
  progresoCertificacion(campo:string){const curva=this.data?.curva_certificacion||[];const max=Math.max(1,...curva.flatMap((p:any)=>[Number(p.plan_cliente_acumulado||0),Number(p.real_cliente_acumulado||0),Number(p.plan_responsable_acumulado||0),Number(p.real_responsable_acumulado||0)]));return curva.map((p:any,i:number)=>`${curva.length===1?390:25+i*730/(curva.length-1)},${235-Number(p[campo]||0)*190/max}`).join(' ');}
  colorEtapa(i:number){return['#00c5a5','#3b82f6','#8b5cf6','#f59e0b','#f97316','#10b981'][i%6];}
  cargarAlarmas(){this.cargandoAlarmas=true;this.errorAlarmas='';this.alarmasApi.listar(this.proyectoId,100,this.filtroEstadoAlarmas).subscribe({next:r=>{this.alarmasConfiguradas=r.alarmas;this.cargandoAlarmas=false;},error:e=>{this.errorAlarmas=e?.error?.message||'No se pudieron cargar las alarmas configuradas';this.cargandoAlarmas=false;}});}
  estaLeida(a:Alarma){return Boolean(a.leida);}
  marcarTodas(){this.alarmasApi.marcarTodasLeidas(this.proyectoId).subscribe({next:()=>this.cargarAlarmas(),error:e=>this.errorAlarmas=e?.error?.message||'No se pudieron marcar las alarmas'});}
  abrirAlarma(a:Alarma){const navegar=()=>{if(a.url_destino)this.router.navigateByUrl(a.url_destino);};if(a.leida){navegar();return;}this.alarmasApi.marcarLeida(a.alarma_id).subscribe({next:()=>{a.leida=true;navegar();},error:()=>navegar()});}
}
