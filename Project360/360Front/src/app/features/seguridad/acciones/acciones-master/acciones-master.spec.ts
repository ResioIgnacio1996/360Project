import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccionesMaster } from './acciones-master';

describe('AccionesMaster', () => {
  let component: AccionesMaster;
  let fixture: ComponentFixture<AccionesMaster>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccionesMaster],
    }).compileComponents();

    fixture = TestBed.createComponent(AccionesMaster);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
