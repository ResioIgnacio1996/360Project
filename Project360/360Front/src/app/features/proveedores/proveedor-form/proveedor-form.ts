import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ProveedorService } from '../../../core/services/proveedor/proveedor';
import { RubroProveedor } from '../../../shared/interfaces/proveedor.interface';

@Component({
  selector: 'app-proveedor-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './proveedor-form.html',
  styleUrl: './proveedor-form.css'
})
export class ProveedorForm implements OnInit {   

  proveedorForm!: FormGroup;

  rubros: RubroProveedor[] = [];

  idProveedor: number | null = null;
  esEdicion = false;

  cargandoProveedor = false;
  cargandoRubros = false;
  guardando = false;

  error = '';
  mensaje = '';

  constructor(
    private fb: FormBuilder,
    private proveedorService: ProveedorService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.inicializarFormulario();
    this.cargarRubros();

    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.idProveedor = Number(id);
      this.esEdicion = true;
      this.cargarProveedor(this.idProveedor);
    }
  }

  inicializarFormulario(): void {
    this.proveedorForm = this.fb.group({
      razon_social: ['', [Validators.required]],
      cuit: [''],
      telefono: [''],
      email: ['', [Validators.email]],
      direccion: [''],
      ubicacion: [''],
      rubro_id: ['', [Validators.required]],
      activo: [true]
    });
  }

  cargarRubros(): void {
    this.cargandoRubros = true;
    this.error = '';

    this.proveedorService.getRubrosProveedor().subscribe({
      next: (data) => {
        this.rubros = data;
        this.cargandoRubros = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al cargar rubros';
        this.cargandoRubros = false;
      }
    });
  }

  cargarProveedor(id: number): void {
    this.cargandoProveedor = true;
    this.error = '';

    this.proveedorService.getProveedor(id).subscribe({
      next: (proveedor) => {
        this.proveedorForm.patchValue({
          razon_social: proveedor.razon_social,
          cuit: proveedor.cuit,
          telefono: proveedor.telefono,
          email: proveedor.email,
          direccion: proveedor.direccion,
          ubicacion: proveedor.ubicacion,
          rubro_id: proveedor.rubro_id,
          activo: proveedor.activo
        });

        this.cargandoProveedor = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al cargar proveedor';
        this.cargandoProveedor = false;
      }
    });
  }

  guardar(): void {
    this.error = '';
    this.mensaje = '';

    if (this.proveedorForm.invalid) {
      this.proveedorForm.markAllAsTouched();
      return;
    }

    this.guardando = true;

    const proveedor = {
      razon_social: this.proveedorForm.value.razon_social,
      cuit: this.proveedorForm.value.cuit,
      telefono: this.proveedorForm.value.telefono,
      email: this.proveedorForm.value.email,
      direccion: this.proveedorForm.value.direccion,
      ubicacion: this.proveedorForm.value.ubicacion,
      rubro_id: Number(this.proveedorForm.value.rubro_id),
      activo: this.proveedorForm.value.activo
    };

    if (this.esEdicion && this.idProveedor) {
      this.proveedorService.actualizarProveedor(this.idProveedor, proveedor).subscribe({
        next: () => {
          this.mensaje = 'Proveedor actualizado correctamente';
          this.guardando = false;
          this.router.navigate(['/proveedores']);
        },
        error: (err) => {
          this.error = err?.error?.message || 'Error al actualizar proveedor';
          this.guardando = false;
        }
      });

      return;
    }

    this.proveedorService.crearProveedor(proveedor).subscribe({
      next: () => {
        this.mensaje = 'Proveedor creado correctamente';
        this.guardando = false;
        this.router.navigate(['/proveedores']);
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al crear proveedor';
        this.guardando = false;
      }
    });
  }

  cancelar(): void {
    this.router.navigate(['/proveedores']);
  }

  campoInvalido(campo: string): boolean {
    const control = this.proveedorForm.get(campo);
    return !!control && control.invalid && control.touched;
  }
  formatearCuit(event: Event): void {
    const input = event.target as HTMLInputElement;

    let valor = input.value.replace(/\D/g, '');

    if (valor.length > 11) {
      valor = valor.substring(0, 11);
    }

    let formateado = '';

    if (valor.length > 0) {
      formateado = valor.substring(0, 2);
    }

    if (valor.length > 2) {
      formateado += '-' + valor.substring(2, 10);
    }

    if (valor.length > 10) {
      formateado += '-' + valor.substring(10, 11);
    }

    this.proveedorForm.get('cuit')?.setValue(formateado, {
      emitEvent: false
    });
  }
}