import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ImportacionProgramacionService } from '../../../core/services/programacion/importacion-programacion';

type Tipo='etapas'|'responsables'|'operaciones'|'materiales'|'calendario'|'excepciones';
@Component({selector:'app-importacion-programacion',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./importacion-programacion.html',styleUrl:'./importacion-programacion.css'})
export class ImportacionProgramacion implements OnInit {
  readonly proyectoId:number;
  paso=1; version='v1'; fechaInicioProgramacion=''; archivos:Partial<Record<Tipo,File>>={}; datos:any={etapas:[],responsables:[],operaciones:[],materiales:[],calendario:[],excepciones:[]};
  errores:any[]=[]; advertencias:any[]=[]; tab:Tipo='operaciones'; procesando=false; mensaje='';
  readonly tipos:{key:Tipo;titulo:string;archivo:string;icono:string}[]=[
    {key:'etapas',titulo:'Etapas',archivo:'BOP_Etapas.csv',icono:'layers'},
    {key:'responsables',titulo:'Responsables',archivo:'BOP_Responsables.csv',icono:'groups'},
    {key:'operaciones',titulo:'Operaciones',archivo:'BOP_Operaciones.csv',icono:'account_tree'},
    {key:'materiales',titulo:'Materiales BOM',archivo:'BOM_Materiales.csv',icono:'inventory_2'},
    {key:'calendario',titulo:'Calendario',archivo:'BOP_Calendario.csv',icono:'calendar_month'},
    {key:'excepciones',titulo:'Excepciones',archivo:'BOP_Excepciones_Calendario.csv',icono:'event_busy'}
  ];
  columnas:Record<Tipo,string[]>={
    etapas:['codigo','nombre','orden','peso_pct'],
    responsables:['codigo','nombre','tipo'],
    operaciones:['etapa','secuencia','nombre','depende_de','desfase_inicio_hs','responsable','duracion_hs','unidad_avance','cantidad_meta','peso_pct','cant_materiales','criterio_cierre','descripcion'],
    materiales:['etapa','secuencia_op','nro_linea','descripcion_libre','cantidad_teorica','unidad'],
    calendario:['campo','valor','descripcion'],
    excepciones:['fecha','tipo','hs_disponibles','motivo','recuperable']
  };
  constructor(private route:ActivatedRoute,private router:Router,private service:ImportacionProgramacionService){
    this.proyectoId=Number(this.route.snapshot.paramMap.get('id'));
  }
  ngOnInit():void{this.service.contexto(this.proyectoId).subscribe({next:r=>{
    this.fechaInicioProgramacion=(r.calendario?.fecha_inicio_programacion||r.proyecto?.fecha_inicio||'').substring(0,10);
    const actual=String(r.proyecto?.version_codigo||'');
    const numero=Number(actual.match(/\d+/)?.[0]||0);
    this.version=`v${numero+1}`;
  }})}
  seleccionar(tipo:Tipo,event:Event):void{const f=(event.target as HTMLInputElement).files?.[0];if(f)this.archivos[tipo]=f}
  get completos():boolean{return this.tipos.every(t=>!!this.archivos[t.key])}
  analizar():void{
    if(!this.completos)return;this.procesando=true;this.mensaje='';
    this.service.previsualizar(this.proyectoId,this.archivos as Record<string,File>).subscribe({
      next:r=>{this.datos=r.datos;this.errores=r.errores||[];this.advertencias=r.advertencias||[];this.paso=2;this.procesando=false},
      error:e=>{this.mensaje=e?.error?.message||'No se pudieron analizar los archivos';this.procesando=false}
    });
  }
  modoManual():void{this.datos={etapas:[],responsables:[],operaciones:[],materiales:[],calendario:[],excepciones:[]};this.errores=[];this.advertencias=[];this.paso=2}
  agregar(tipo:Tipo):void{const fila:any={};this.columnas[tipo].forEach(c=>fila[c]='');this.datos[tipo].push(fila)}
  eliminar(tipo:Tipo,index:number):void{this.datos[tipo].splice(index,1)}
  sincronizarCantidadMateriales():void{
    const cantidades=new Map<number,number>();
    this.datos.materiales.forEach((material:any)=>{
      const secuencia=Number(material.secuencia_op);
      if(Number.isInteger(secuencia))cantidades.set(secuencia,(cantidades.get(secuencia)||0)+1);
    });
    this.datos.operaciones.forEach((operacion:any)=>{
      operacion.cant_materiales=cantidades.get(Number(operacion.secuencia))||0;
    });
  }
  sincronizarNumerosLineaMateriales():void{
    const maximos=new Map<number,number>();
    this.datos.materiales.forEach((material:any)=>{
      const secuencia=Number(material.secuencia_op),linea=Number(material.nro_linea);
      if(Number.isInteger(secuencia)&&Number.isInteger(linea)&&linea>0)
        maximos.set(secuencia,Math.max(maximos.get(secuencia)||0,linea));
    });
    const usados=new Map<number,Set<number>>();
    this.datos.materiales.forEach((material:any)=>{
      const secuencia=Number(material.secuencia_op);
      if(!Number.isInteger(secuencia))return;
      const lineas=usados.get(secuencia)||new Set<number>();
      let linea=Number(material.nro_linea);
      if(!Number.isInteger(linea)||linea<=0||lineas.has(linea)){
        linea=(maximos.get(secuencia)||0)+1;
        maximos.set(secuencia,linea);
        material.nro_linea=linea;
      }
      lineas.add(linea);
      usados.set(secuencia,lineas);
    });
  }
  revalidar():void{
    this.errores=[];this.advertencias=[];
    this.sincronizarCantidadMateriales();
    this.sincronizarNumerosLineaMateriales();
    const etapas=new Set(this.datos.etapas.map((x:any)=>x.codigo)),resp=new Set(this.datos.responsables.map((x:any)=>x.codigo)),seq=new Set<number>();
    this.datos.operaciones.forEach((o:any,i:number)=>{const f=i+2;if(!etapas.has(o.etapa))this.err('operaciones',f,'etapa',`La etapa ${o.etapa} no existe`);const n=Number(o.secuencia);if(seq.has(n))this.err('operaciones',f,'secuencia',`Secuencia duplicada ${n}`);seq.add(n);if(!resp.has(o.responsable))this.err('operaciones',f,'responsable',`El responsable ${o.responsable} no existe`);if(!(Number(o.duracion_hs)>0))this.err('operaciones',f,'duracion_hs','Debe ser mayor a cero');if(o.unidad_avance==='CANTIDAD'&&!(Number(o.cantidad_meta)>0))this.err('operaciones',f,'cantidad_meta','Obligatoria para CANTIDAD')});
    this.datos.materiales.forEach((m:any,i:number)=>{if(!seq.has(Number(m.secuencia_op)))this.err('materiales',i+2,'secuencia_op',`La operación ${m.secuencia_op} no existe`)});
    const suma=this.datos.etapas.reduce((s:number,e:any)=>s+Number(e.peso_pct||0),0);if(Math.abs(suma-100)>.1)this.advertencias.push({archivo:'etapas',columna:'peso_pct',mensaje:`La suma es ${suma}%. Se normalizará al importar.`});
    if(!this.errores.length)this.paso=3;
  }
  err(archivo:string,fila:number,columna:string,mensaje:string):void{this.errores.push({archivo,fila,columna,mensaje})}
  importar():void{
    if(!this.version.trim()||!this.fechaInicioProgramacion||this.errores.length)return;
    this.sincronizarCantidadMateriales();
    this.sincronizarNumerosLineaMateriales();
    this.procesando=true;
    this.service.importar(this.proyectoId,this.version,this.fechaInicioProgramacion,this.datos).subscribe({
      next:r=>{this.paso=4;this.mensaje=`${r.message}. ${r.resumen.operaciones} operaciones y ${r.resumen.materiales} materiales cargados.`;this.procesando=false},
      error:e=>{
        this.mensaje=[e?.error?.message,e?.error?.error].filter(Boolean).join(': ')||'No se pudo importar';
        this.errores=e?.error?.errores||[];
        this.advertencias=e?.error?.advertencias||[];
        if(this.errores.length)this.paso=2;
        this.procesando=false;
      }
    });
  }
  volver():void{this.router.navigate(['/proyectos',this.proyectoId,'programacion'])}
}
