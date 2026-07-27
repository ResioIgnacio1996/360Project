import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { OperacionProgramada, ProgramacionService } from '../../core/services/programacion/programacion';

@Component({ selector:'app-programacion', standalone:true, imports:[CommonModule,FormsModule], templateUrl:'./programacion.html', styleUrl:'./programacion.css' })
export class Programacion implements OnInit {
  proyecto:any=null; operaciones:OperacionProgramada[]=[]; seleccionada:OperacionProgramada|null=null;
  cargando=true; error=''; busqueda=''; filtroEstado='TODAS'; filtroEtapa='TODAS';
  capas={estimado:true,reprogramado:true,real:true}; modal:'duracion'|'nmt'|null=null;
  nuevaDuracion=0; fechaNmt=''; motivo=''; guardando=false; mensaje=''; readonly proyectoId:number;
  constructor(private route:ActivatedRoute,private router:Router,private service:ProgramacionService){this.proyectoId=Number(this.route.snapshot.paramMap.get('id'))}
  ngOnInit():void{this.cargar()}
  cargar():void{this.cargando=true;this.error='';this.service.obtener(this.proyectoId).subscribe({next:d=>{this.proyecto=d.proyecto;this.operaciones=d.operaciones||[];if(this.seleccionada)this.seleccionada=this.operaciones.find(o=>o.operacion_id===this.seleccionada?.operacion_id)||null;this.cargando=false},error:e=>{this.error=e?.error?.message||'No se pudo cargar la programación';this.cargando=false}})}
  get etapas():string[]{return[...new Set(this.operaciones.map(o=>o.etapa_nombre))]}
  get filtradas():OperacionProgramada[]{const q=this.busqueda.toLowerCase().trim();return this.operaciones.filter(o=>(this.filtroEstado==='TODAS'||o.estado_codigo===this.filtroEstado)&&(this.filtroEtapa==='TODAS'||o.etapa_nombre===this.filtroEtapa)&&(!q||`${o.secuencia} ${o.nombre} ${o.etapa_nombre} ${o.responsable_nombre||''}`.toLowerCase().includes(q)))}
  get progreso():number{return this.operaciones.length?Math.round(this.operaciones.reduce((s,o)=>s+Number(o.pct_avance_actual),0)/this.operaciones.length):0}
  get atrasadas():number{return this.operaciones.filter(o=>o.estado_codigo==='ATRASADA').length}
  get rango():{inicio:number;dias:number}{const fs=this.operaciones.flatMap(o=>[o.fecha_inicio_estimada,o.fecha_fin_estimada,o.fecha_inicio_reprog,o.fecha_fin_reprog]).filter(Boolean) as string[];const inicio=fs.length?Math.min(...fs.map(Date.parse)):Date.now();const fin=fs.length?Math.max(...fs.map(Date.parse)):inicio+13*86400000;return{inicio,dias:Math.max(14,Math.ceil((fin-inicio)/86400000)+1)}}
  dias():number[]{return Array.from({length:this.rango.dias},(_,i)=>i)}
  fechaDia(i:number):Date{return new Date(this.rango.inicio+i*86400000)}
  posicion(f?:string):number{return f?Math.max(0,((Date.parse(f)-this.rango.inicio)/86400000)/this.rango.dias*100):0}
  ancho(i?:string,f?:string):number{return i&&f?Math.max(1.2,((Date.parse(f)-Date.parse(i))/86400000+1)/this.rango.dias*100):0}
  esFinSemana(i:number):boolean{return[0,6].includes(this.fechaDia(i).getUTCDay())}
  claseEstado(o:OperacionProgramada):string{return`estado-${o.estado_codigo.toLowerCase()}`}
  seleccionar(o:OperacionProgramada):void{this.seleccionada=o}
  volver():void{this.router.navigate(['/proyectos'])}
  importarBop():void{this.router.navigate(['/proyectos',this.proyectoId,'programacion','importar'])}
  toggle(c:keyof typeof this.capas):void{this.capas[c]=!this.capas[c]}
  abrirDuracion():void{if(!this.seleccionada)return;this.nuevaDuracion=Number(this.seleccionada.duracion_hs);this.motivo='';this.modal='duracion'}
  abrirNmt():void{if(!this.seleccionada)return;this.fechaNmt=this.seleccionada.fecha_no_antes_del||'';this.motivo='';this.modal='nmt'}
  guardarDuracion():void{if(!this.seleccionada||!(this.nuevaDuracion>0)||!this.motivo.trim())return;this.guardando=true;this.service.actualizarDuracion(this.seleccionada.operacion_id,{duracion_hs:this.nuevaDuracion,motivo:this.motivo}).subscribe({next:r=>this.finalizar(r.message),error:e=>{this.guardando=false;this.error=e?.error?.message||'No se pudo guardar'}})}
  guardarNmt(quitar=false):void{if(!this.seleccionada||(!quitar&&!this.fechaNmt)||!this.motivo.trim())return;this.guardando=true;this.service.actualizarNmt(this.seleccionada.operacion_id,{fecha_no_antes_del:quitar?null:this.fechaNmt,motivo:this.motivo}).subscribe({next:r=>this.finalizar(r.message),error:e=>{this.guardando=false;this.error=e?.error?.message||'No se pudo guardar'}})}
  finalizar(t:string):void{this.guardando=false;this.modal=null;this.mensaje=t;this.cargar();setTimeout(()=>this.mensaje='',3500)}
}
