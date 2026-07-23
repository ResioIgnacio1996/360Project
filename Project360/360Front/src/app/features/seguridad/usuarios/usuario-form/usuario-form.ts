import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UsuarioService } from '../../../../core/services/usuario/usuario';
import { RolService } from '../../../../core/services/rol/rol';
import { Rol } from '../../../../shared/interfaces/rol.interface';

@Component({
  selector: 'app-usuario-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './usuario-form.html',
  styleUrl: './usuario-form.css',
})
export class UsuarioForm implements OnInit {

  form!: FormGroup;
  esEdicion = false;
  usuarioId!: number;

  roles: Rol[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private usuarioService: UsuarioService,
    private rolService: RolService
  ) {}

  ngOnInit(): void {
    this.usuarioId = Number(this.route.snapshot.paramMap.get('id'));
    this.esEdicion = !!this.usuarioId;

    this.form = this.fb.group({
      usuario: ['', Validators.required],
      nombre: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      rol_id: ['', Validators.required],
      password: [''],
      confirmarPassword: ['']
    });

    if (!this.esEdicion) {
      this.form.get('password')?.setValidators([Validators.required]);
      this.form.get('confirmarPassword')?.setValidators([Validators.required]);
    }

    this.form.get('password')?.updateValueAndValidity();
    this.form.get('confirmarPassword')?.updateValueAndValidity();

    this.cargarRoles();

    if (this.esEdicion) {
      this.cargarUsuario();
    }
  }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
      },
      error: (err) => {
        console.error('Error al cargar roles', err);
      }
    });
  }

  cargarUsuario(): void {
    this.usuarioService.obtenerPorId(this.usuarioId).subscribe({
      next: (usuario: any) => {
        this.form.patchValue({
          usuario: usuario.usuario,
          nombre: usuario.nombre,
          email: usuario.email,
          rol_id: usuario.rol_id
        });
      },
      error: (err) => {
        console.error('Error al cargar usuario', err);
      }
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const data = this.form.value;

    if (!this.esEdicion && data.password !== data.confirmarPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    const body: any = {
      usuario: data.usuario,
      nombre: data.nombre,
      email: data.email,
      rol_id: Number(data.rol_id)
    };

    if (!this.esEdicion) {
      body.password = data.password;
      body.activo = true;
    }

    if (this.esEdicion) {
      this.usuarioService.actualizarUsuario(this.usuarioId, body).subscribe({
        next: () => this.router.navigate(['/seguridad/usuarios']),
        error: (err) => console.error('Error al actualizar usuario', err)
      });
    } else {
      this.usuarioService.crearUsuario(body).subscribe({
        next: () => this.router.navigate(['/seguridad/usuarios']),
        error: (err) => console.error('Error al crear usuario', err)
      });
    }
  }


  
}
