import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeguridadHome } from './seguridad-home';

describe('SeguridadHome', () => {
  let component: SeguridadHome;
  let fixture: ComponentFixture<SeguridadHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeguridadHome],
    }).compileComponents();

    fixture = TestBed.createComponent(SeguridadHome);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
