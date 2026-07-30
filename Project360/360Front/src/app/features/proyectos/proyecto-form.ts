import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ClienteService } from '../../core/services/Cliente/cliente';
import { ProyectoService } from '../../core/services/proyecto/proyecto';

@Component({selector:'app-proyecto-form',standalone:true,imports:[CommonModule,ReactiveFormsModule],templateUrl:'./proyecto-form.html',styleUrl:'./proyecto-form.css'})
export class ProyectoForm implements OnInit {
  private fb=inject(FormBuilder);
  id?:number; clientes:any[]=[]; guardando=false; creandoCliente=false; mostrarAltaCliente=false; error=''; errorCliente='';
  form=this.fb.group({nombre:['',Validators.required],cliente_id:[null as number|null,Validators.required],pais:['Argentina'],provincia:[''],localidad:[''],codigo_postal:[''],calle:[''],fecha_inicio:[''],fecha_fin_estimada:[''],estado:['ACTIVO',Validators.required]});
  clienteRapido=this.fb.group({nombre:['',Validators.required],apellido:['',Validators.required],cuil:['']});

  constructor(private route:ActivatedRoute,private router:Router,private proyectos:ProyectoService,private clienteService:ClienteService){}

  ngOnInit(){
    const clienteId=Number(this.route.snapshot.queryParamMap.get('clienteId'));if(clienteId)this.form.patchValue({cliente_id:clienteId});
    this.cargarClientes();
    const id=Number(this.route.snapshot.paramMap.get('id'));
    if(id){this.id=id;this.proyectos.getProyecto(id).subscribe(p=>{const ubicacion=this.separarUbicacion(p.direccion);this.form.patchValue({...p,...ubicacion,fecha_inicio:this.fechaInput(p.fecha_inicio),fecha_fin_estimada:this.fechaInput(p.fecha_fin_estimada)});});}
  }

  cargarClientes(clienteSeleccionado?:number){this.clienteService.getClientes().subscribe({next:r=>{this.clientes=r;if(clienteSeleccionado)this.form.patchValue({cliente_id:clienteSeleccionado});},error:e=>this.errorCliente=e?.error?.message||'No se pudieron cargar los clientes'});}
  alternarAltaCliente(){this.mostrarAltaCliente=!this.mostrarAltaCliente;this.errorCliente='';if(!this.mostrarAltaCliente)this.clienteRapido.reset({nombre:'',apellido:'',cuil:''});}
  crearClienteRapido(){if(this.clienteRapido.invalid){this.clienteRapido.markAllAsTouched();return;}this.creandoCliente=true;this.errorCliente='';const datos=this.clienteRapido.getRawValue() as any;this.clienteService.crearCliente(datos).subscribe({next:r=>{const id=Number(r.id_cliente);this.creandoCliente=false;this.mostrarAltaCliente=false;this.clienteRapido.reset({nombre:'',apellido:'',cuil:''});this.cargarClientes(id);},error:e=>{this.errorCliente=e?.error?.message||'No se pudo crear el cliente';this.creandoCliente=false;}});}

  guardar(){if(this.form.invalid){this.form.markAllAsTouched();return;}this.guardando=true;this.error='';const raw=this.form.getRawValue();const payload={nombre:raw.nombre,cliente_id:raw.cliente_id,direccion:this.armarUbicacion(raw),fecha_inicio:this.fechaInput(raw.fecha_inicio),fecha_fin_estimada:this.id?this.fechaInput(raw.fecha_fin_estimada):null,estado:this.id?raw.estado:'ACTIVO'};const req=this.id?this.proyectos.actualizarProyecto(this.id,payload):this.proyectos.crearProyecto(payload);req.subscribe({next:()=>this.router.navigate(['/proyectos']),error:e=>{this.error=e?.error?.message||'Error al guardar';this.guardando=false;}});}
  armarUbicacion(raw:any){return[raw.pais,raw.provincia,raw.localidad,raw.codigo_postal,raw.calle].map((v:any)=>String(v||'').trim()).join(' | ');}
  separarUbicacion(valor:any){const partes=String(valor||'').split(' | ');if(partes.length===5)return{pais:partes[0],provincia:partes[1],localidad:partes[2],codigo_postal:partes[3],calle:partes[4]};if(partes.length===4)return{pais:partes[0],provincia:partes[1],localidad:partes[2],codigo_postal:'',calle:partes[3]};return{pais:'Argentina',provincia:'',localidad:'',codigo_postal:'',calle:String(valor||'')};}
  fechaInput(valor:any):string{return valor?String(valor).substring(0,10):'';}
  cancelar(){this.router.navigate(['/proyectos']);}
}
