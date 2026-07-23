import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrdenCompraUpload } from './orden-compra-upload';

describe('OrdenCompraUpload', () => {
  let component: OrdenCompraUpload;
  let fixture: ComponentFixture<OrdenCompraUpload>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdenCompraUpload],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdenCompraUpload);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
