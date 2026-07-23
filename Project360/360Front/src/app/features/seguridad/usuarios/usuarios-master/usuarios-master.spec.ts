import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsuariosMaster } from './usuarios-master';

describe('UsuariosMaster', () => {
  let component: UsuariosMaster;
  let fixture: ComponentFixture<UsuariosMaster>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsuariosMaster],
    }).compileComponents();

    fixture = TestBed.createComponent(UsuariosMaster);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
