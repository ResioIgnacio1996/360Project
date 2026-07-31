import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ClienteService } from '../../core/services/Cliente/cliente';

@Component({selector:'app-cliente-rapido-dialog',standalone:true,imports:[CommonModule,ReactiveFormsModule,MatButtonModule,MatDialogModule,MatFormFieldModule,MatInputModule],templateUrl:'./cliente-rapido-dialog.html',styleUrl:'./cliente-rapido-dialog.css'})
export class ClienteRapidoDialog {
  private fb=inject(FormBuilder); guardando=false; error='';
  form=this.fb.group({razon_social:['',Validators.required],cuil:['']});
  constructor(private dialogRef:MatDialogRef<ClienteRapidoDialog>,private clienteService:ClienteService){}
  guardar(){if(this.form.invalid){this.form.markAllAsTouched();return;}this.guardando=true;this.error='';this.clienteService.crearCliente(this.form.getRawValue() as any).subscribe({next:r=>this.dialogRef.close(Number(r.id_cliente)),error:e=>{this.error=e?.error?.message||'No se pudo crear el cliente';this.guardando=false;}});}
}
