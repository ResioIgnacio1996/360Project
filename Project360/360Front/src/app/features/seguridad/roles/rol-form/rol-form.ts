import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Rol } from '../../../../shared/interfaces/rol.interface';
import { RolService } from '../../../../core/services/rol/rol';

@Component({
  selector: 'app-rol-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './rol-form.html',
  styleUrl: './rol-form.css'
})
export class RolFormComponent implements OnInit {

  form!: FormGroup;

  rolId?: number;
  esEdicion = false;
  guardando = false;
  cargando = false;

  entidades: any[] = [];
  acciones: any[] = [];
  permisos: any[] = [];
  mensajeExito = '';
mensajeError = '';

  constructor(
    private fb: FormBuilder,
    private rolService: RolService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.crearFormulario();

    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.rolId = Number(id);
      this.esEdicion = true;
    }

    this.cargarDatosBase();
  }

  crearFormulario(): void {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(50)]],
      descripcion: ['', [Validators.required, Validators.maxLength(150)]]
    });
  }

  cargarDatosBase(): void {
    this.cargando = true;

    this.rolService.getEntidades().subscribe({
      next: (entidades: any[]) => {
        this.entidades = entidades;

        this.rolService.getAcciones().subscribe({
          next: (acciones: any[]) => {
            this.acciones = acciones;

            this.inicializarPermisos();

            if (this.esEdicion && this.rolId) {
              this.cargarRolCompleto(this.rolId);
            } else {
              this.cargando = false;
            }
          },
          error: (err: any) => {
            console.error('Error al cargar acciones', err);
            this.cargando = false;
          }
        });
      },
      error: (err: any) => {
        console.error('Error al cargar entidades', err);
        this.cargando = false;
      }
    });
  }

  inicializarPermisos(): void {
    this.permisos = [];

    for (const entidad of this.entidades) {
      for (const accion of this.acciones) {
        this.permisos.push({
          accion_id: accion.accion_id,
          entidad_id: entidad.entidad_id,
          permitido: false
        });
      }
    }
  }

  cargarRolCompleto(id: number): void {
    this.rolService.getRolById(id).subscribe({
      next: (rol: any) => {
        this.form.patchValue({
          nombre: rol.nombre,
          descripcion: rol.descripcion
        });

        this.cargarPermisosRol(id);
      },
      error: (err: any) => {
        console.error('Error al cargar rol', err);
        this.cargando = false;
      }
    });
  }

  cargarPermisosRol(id: number): void {
    this.rolService.getPermisosRol(id).subscribe({
      next: (response: any) => {
        const permisosBackend = response.permisos || response || [];

        for (const permiso of permisosBackend) {
          const permisoLocal = this.permisos.find(p =>
            Number(p.entidad_id) === Number(permiso.entidad_id) &&
            Number(p.accion_id) === Number(permiso.accion_id)
          );

          if (permisoLocal) {
            permisoLocal.permitido = permiso.permitido;
          }
        }

        this.cargando = false;
      },
      error: (err: any) => {
        console.error('Error al cargar permisos del rol', err);
        this.cargando = false;
      }
    });
  }

  estaPermitido(entidadId: number, accionId: number): boolean {
    const permiso = this.permisos.find(p =>
      Number(p.entidad_id) === Number(entidadId) &&
      Number(p.accion_id) === Number(accionId)
    );

    return permiso ? permiso.permitido : false;
  }

  cambiarPermiso(entidadId: number, accionId: number, event: Event): void {
    const input = event.target as HTMLInputElement;

    const permiso = this.permisos.find(p =>
      Number(p.entidad_id) === Number(entidadId) &&
      Number(p.accion_id) === Number(accionId)
    );

    if (permiso) {
      permiso.permitido = input.checked;
    }
  }

 guardar(): void {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  this.guardando = true;
  this.mensajeExito = '';
  this.mensajeError = '';

  const rolData = {
    nombre: this.form.value.nombre,
    descripcion: this.form.value.descripcion,
    activo: true,
    permisos: this.permisos
  };

  const request$ = this.esEdicion && this.rolId
    ? this.rolService.actualizarRol(this.rolId, rolData)
    : this.rolService.crearRol(rolData);

  request$.subscribe({
    next: () => {
      this.guardando = false;
      this.mensajeExito = this.esEdicion
        ? 'Rol actualizado correctamente.'
        : 'Rol creado correctamente.';

      setTimeout(() => {
        this.router.navigate(['/seguridad/roles']);
      }, 1200);
    },
    error: (err: any) => {
      console.error('Error al guardar rol', err);
      this.guardando = false;
      this.mensajeError = 'No se pudo guardar el rol. Revisá los datos o intentá nuevamente.';
    }
  });
}
  guardarPermisos(rolId: number): void {
    this.rolService.guardarPermisosRol(rolId, this.permisos).subscribe({
      next: () => {
        this.guardando = false;
        this.router.navigate(['/seguridad/roles']);
      },
      error: (err: any) => {
        console.error('Error al guardar permisos del rol', err);
        this.guardando = false;
      }
    });
  }

  cancelar(): void {
    this.router.navigate(['/seguridad/roles']);
  }

  campoInvalido(campo: string): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

 
}