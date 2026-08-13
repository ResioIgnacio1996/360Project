import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { OperacionProgramada, ProgramacionService } from '../../core/services/programacion/programacion';

interface NodoDependencia extends OperacionProgramada { x:number; y:number; nivel:number; predecesoras:number[]; estadoVisual:string; }
interface BandaEtapa { codigo:string; nombre:string; y:number; alto:number; }

@Component({ selector:'app-dependencias-operaciones', standalone:true, imports:[CommonModule,MatIconModule], templateUrl:'./dependencias-operaciones.html', styleUrls:['./dependencias-operaciones.css','./dependencias-interaccion.css'] })
export class DependenciasOperaciones implements OnInit {
  readonly proyectoId:number; proyecto:any=null; version:any=null; nodos:NodoDependencia[]=[]; bandas:BandaEtapa[]=[];
  seleccionada:NodoDependencia|null=null; cargando=true; error=''; ancho=1100; alto=500; readonly anchoNodo=230; readonly altoNodo=92;
  private arrastre:{nodo:NodoDependencia;offsetX:number;offsetY:number;pointerId:number}|null=null;
  private posicionesIniciales=new Map<number,{x:number;y:number}>();
  constructor(private route:ActivatedRoute,private router:Router,private service:ProgramacionService){this.proyectoId=Number(this.route.snapshot.paramMap.get('id'));}
  ngOnInit():void{this.cargar();}
  cargar():void{this.cargando=true;this.error='';this.service.obtener(this.proyectoId).subscribe({next:data=>{this.proyecto=data.proyecto;this.version=data.version||data.version_activa||data.plan||null;this.construirGrafo((data.operaciones||[]).filter((op:OperacionProgramada)=>!op.archivada));this.cargando=false;},error:err=>{this.error=err?.error?.message||'No se pudieron cargar las dependencias';this.cargando=false;}});}
  construirGrafo(operaciones:OperacionProgramada[]):void{
    const ordenadas=[...operaciones].sort((a,b)=>String(a.etapa_codigo).localeCompare(String(b.etapa_codigo),undefined,{numeric:true})||Number(a.secuencia)-Number(b.secuencia));
    const porSecuencia=new Map(ordenadas.map(op=>[Number(op.secuencia),op]));const niveles=new Map<number,number>();const visitando=new Set<number>();
    const nivelDe=(secuencia:number):number=>{if(niveles.has(secuencia))return niveles.get(secuencia)!;if(visitando.has(secuencia))return 0;visitando.add(secuencia);const op=porSecuencia.get(secuencia);const deps=this.parsearDependencias(op?.dependencias_secuencia).filter(d=>porSecuencia.has(d));const nivel=deps.length?Math.max(...deps.map(d=>nivelDe(d)))+1:0;visitando.delete(secuencia);niveles.set(secuencia,nivel);return nivel;};
    let cursorY=62;const nodos:NodoDependencia[]=[];const grupos=new Map<string,OperacionProgramada[]>();
    for(const op of ordenadas){const clave=`${op.etapa_codigo}|${op.etapa_nombre}`;if(!grupos.has(clave))grupos.set(clave,[]);grupos.get(clave)!.push(op);}
    this.bandas=[];for(const [clave,ops] of grupos){const inicio=cursorY-36;for(const op of ops){const predecesoras=this.parsearDependencias(op.dependencias_secuencia).filter(d=>porSecuencia.has(d));const nivel=nivelDe(Number(op.secuencia));nodos.push({...op,predecesoras,nivel,x:190+nivel*295,y:cursorY,estadoVisual:this.estadoVisual(op,predecesoras,porSecuencia)});cursorY+=122;}const [codigo,nombre]=clave.split('|');this.bandas.push({codigo,nombre,y:inicio,alto:cursorY-inicio-18});cursorY+=36;}
    this.nodos=nodos;this.posicionesIniciales=new Map(nodos.map(n=>[n.operacion_id,{x:n.x,y:n.y}]));this.ancho=Math.max(1100,190+(Math.max(0,...nodos.map(n=>n.nivel))+1)*295+70);this.alto=Math.max(500,cursorY+20);
  }
  parsearDependencias(valor?:string):number[]{return String(valor||'').split(/[,;|]/).map(v=>Number(v.trim())).filter(Number.isFinite);}
  estadoVisual(op:OperacionProgramada,deps:number[],mapa:Map<number,OperacionProgramada>):string{const codigo=String(op.estado_codigo||'').toUpperCase();if(['FINALIZADA','COMPLETADA','COMPLETA'].includes(codigo)||Number(op.pct_avance_actual)>=100)return'completa';if(codigo==='EN_CURSO'||(Number(op.pct_avance_actual)>0&&Number(op.pct_avance_actual)<100))return'en-curso';if(codigo==='ATRASADA')return'atrasada';const bloqueada=deps.some(d=>{const pred=mapa.get(d);const estado=String(pred?.estado_codigo||'').toUpperCase();return pred&&!['FINALIZADA','COMPLETADA','COMPLETA'].includes(estado)&&Number(pred.pct_avance_actual)<100;});if(bloqueada||codigo==='BLOQUEADA')return'bloqueada';if(codigo==='HABILITADA'||deps.length===0||deps.every(d=>mapa.has(d)))return'habilitada';return'pendiente';}
  nodoPorSecuencia(secuencia:number):NodoDependencia|undefined{return this.nodos.find(n=>Number(n.secuencia)===secuencia);}
  sucesoras(nodo:NodoDependencia):NodoDependencia[]{return this.nodos.filter(n=>n.predecesoras.includes(Number(nodo.secuencia)));}
  nombreCorto(nombre:string):string{return nombre.length>28?`${nombre.slice(0,27)}…`:nombre;}
  colorEstado(estado:string):string{return ({completa:'#2f9e5b','en-curso':'#31a7cf',habilitada:'#397dc2',pendiente:'#7f8b96',bloqueada:'#e59a2f',atrasada:'#e26c2d'} as any)[estado]||'#7f8b96';}
  etiquetaEstado(estado:string):string{return estado.replace('-',' ').toUpperCase();}
  iniciarArrastre(evento:PointerEvent,nodo:NodoDependencia):void{
    if(evento.button!==0)return;evento.preventDefault();this.seleccionada=nodo;
    const punto=this.puntoSvg(evento);this.arrastre={nodo,offsetX:punto.x-nodo.x,offsetY:punto.y-nodo.y,pointerId:evento.pointerId};
    (evento.currentTarget as SVGElement).setPointerCapture?.(evento.pointerId);
  }
  moverArrastre(evento:PointerEvent):void{
    if(!this.arrastre||evento.pointerId!==this.arrastre.pointerId)return;
    evento.preventDefault();const {nodo,offsetX,offsetY}=this.arrastre;const punto=this.puntoSvg(evento);const separacion=54;const margen=42;
    const predecesoras=nodo.predecesoras.map(dep=>this.nodoPorSecuencia(dep)).filter((n):n is NodoDependencia=>!!n);const sucesoras=this.sucesoras(nodo);
    const minimoX=predecesoras.length?Math.max(...predecesoras.map(n=>n.x+this.anchoNodo+separacion)):margen;
    const limiteSucesoras=sucesoras.length?Math.min(...sucesoras.map(n=>n.x-this.anchoNodo-separacion)):this.ancho-this.anchoNodo-margen;
    const maximoX=Math.max(minimoX,Math.min(this.ancho-this.anchoNodo-margen,limiteSucesoras));
    const banda=this.bandas.find(b=>b.codigo===nodo.etapa_codigo&&b.nombre===nodo.etapa_nombre);const minimoY=(banda?.y??20)+12;
    const maximoY=Math.max(minimoY,(banda?banda.y+banda.alto:this.alto)-this.altoNodo-12);
    nodo.x=Math.max(minimoX,Math.min(maximoX,punto.x-offsetX));nodo.y=Math.max(minimoY,Math.min(maximoY,punto.y-offsetY));
  }
  finalizarArrastre(evento?:PointerEvent):void{
    if(!this.arrastre)return;
    if(evento&&(evento.currentTarget as SVGElement).hasPointerCapture?.(this.arrastre.pointerId))(evento.currentTarget as SVGElement).releasePointerCapture(this.arrastre.pointerId);
    this.arrastre=null;
  }
  restablecerVista():void{for(const nodo of this.nodos){const posicion=this.posicionesIniciales.get(nodo.operacion_id);if(posicion){nodo.x=posicion.x;nodo.y=posicion.y;}}}
  private puntoSvg(evento:PointerEvent):{x:number;y:number}{const svg=(evento.currentTarget as SVGElement).ownerSVGElement||(evento.currentTarget as SVGSVGElement);const rect=svg.getBoundingClientRect();return{x:(evento.clientX-rect.left)*(this.ancho/rect.width),y:(evento.clientY-rect.top)*(this.alto/rect.height)};}
  volver():void{this.router.navigate(['/proyectos',this.proyectoId]);}verProgramacion():void{this.router.navigate(['/proyectos',this.proyectoId,'programacion']);}
}
