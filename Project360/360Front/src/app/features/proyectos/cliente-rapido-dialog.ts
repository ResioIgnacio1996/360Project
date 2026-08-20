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
  private fb = inject(FormBuilder);
  guardando = false;
  error = '';
  form = this.fb.group({
    razon_social: ['', [Validators.required, Validators.maxLength(150)]],
    cuil: ['', [Validators.required, Validators.pattern(/^\d{2}-\d{8}-\d$/)]],
    telefono: ['', Validators.maxLength(50)],
    ubicacion: ['', Validators.maxLength(150)],
    email: ['', [Validators.email, Validators.maxLength(100)]]
  });

  constructor(private dialogRef: MatDialogRef<ClienteRapidoDialog>, private clienteService: ClienteService) {}
  formatearCuil(event: Event): void {
    const valor = (event.target as HTMLInputElement).value.replace(/\D/g, '').substring(0, 11);
    let resultado = valor.substring(0, 2);
    if (valor.length > 2) resultado += '-' + valor.substring(2, 10);
    if (valor.length > 10) resultado += '-' + valor.substring(10);
    this.form.controls.cuil.setValue(resultado, { emitEvent: false });
  }
  guardar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando = true;
    this.error = '';
    this.clienteService.crearCliente(this.form.getRawValue() as any).subscribe({
      next: response => this.dialogRef.close(Number(response.id_cliente)),
      error: err => { this.error = err?.error?.message || 'No se pudo crear el cliente'; this.guardando = false; }
    });
  }
}
