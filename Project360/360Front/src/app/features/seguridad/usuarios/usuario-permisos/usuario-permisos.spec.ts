import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsuarioPermisos } from './usuario-permisos';

describe('UsuarioPermisos', () => {
  let component: UsuarioPermisos;
  let fixture: ComponentFixture<UsuarioPermisos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsuarioPermisos],
    }).compileComponents();

    fixture = TestBed.createComponent(UsuarioPermisos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
