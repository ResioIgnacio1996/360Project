import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  usuario = '';
  password = '';
  error = '';

  constructor(
    private authService: Auth,
    private router: Router
  ) {}

  iniciarSesion(): void {

    this.error = '';

    if (!this.usuario || !this.password) {
      this.error = 'Debe ingresar usuario y contraseña';
      return;
    }

    this.authService.login({
      usuario: this.usuario,
      password: this.password
    }).subscribe({
    next: async (response) => {
  console.log('LOGIN OK EN FRONT:', response);
  console.log('TOKEN STORAGE:', localStorage.getItem('token'));

  const resultado = await this.router.navigateByUrl('/dashboard');

  console.log('RESULTADO NAVEGACION:', resultado);
},
error: (err) => {
  console.error('ERROR LOGIN FRONT:', err);
  this.error = 'Usuario o contraseña incorrectos';
}
    });

  }
}