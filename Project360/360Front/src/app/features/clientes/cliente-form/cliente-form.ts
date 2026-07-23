import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { ClienteService } from '../../../core/services/Cliente/cliente';

@Component({ selector: 'app-cliente-form', standalone: true, imports: [CommonModule, ReactiveFormsModule, MatIconModule], templateUrl: './cliente-form.html', styleUrl: './cliente-form.css' })
export class ClienteForm implements OnInit {
  clienteForm!: FormGroup; idCliente: number | null = null; esEdicion = false; cargando = false; guardando = false; error = ''; mensaje = '';
  constructor(private fb: FormBuilder, private clienteService: ClienteService, private route: ActivatedRoute, private router: Router) {}
  ngOnInit(): void { this.clienteForm = this.fb.group({ nombre: ['', [Validators.required, Validators.maxLength(50)]], apellido: ['', [Validators.required, Validators.maxLength(50)]], cuil: ['', Validators.maxLength(50)] }); const id = Number(this.route.snapshot.paramMap.get('id')); if (id) { this.idCliente = id; this.esEdicion = true; this.cargarCliente(id); } }
  cargarCliente(id: number): void { this.cargando = true; this.clienteService.getCliente(id).subscribe({ next: c => { this.clienteForm.patchValue(c); this.cargando = false; }, error: err => { this.error = err?.error?.message || 'Error al cargar cliente'; this.cargando = false; } }); }
  guardar(): void { if (this.clienteForm.invalid) { this.clienteForm.markAllAsTouched(); return; } this.guardando = true; this.error = ''; const data = this.clienteForm.getRawValue(); const req = this.esEdicion && this.idCliente ? this.clienteService.actualizarCliente(this.idCliente, data) : this.clienteService.crearCliente(data); req.subscribe({ next: () => this.router.navigate(['/clientes']), error: err => { this.error = err?.error?.message || 'Error al guardar cliente'; this.guardando = false; } }); }
  cancelar(): void { this.router.navigate(['/clientes']); }
  campoInvalido(campo: string): boolean { const control = this.clienteForm.get(campo); return !!control && control.invalid && control.touched; }
  formatearCuil(event: Event): void { let valor = (event.target as HTMLInputElement).value.replace(/\D/g, '').substring(0, 11); let resultado = valor.substring(0, 2); if (valor.length > 2) resultado += '-' + valor.substring(2, 10); if (valor.length > 10) resultado += '-' + valor.substring(10); this.clienteForm.get('cuil')?.setValue(resultado, { emitEvent: false }); }
}
