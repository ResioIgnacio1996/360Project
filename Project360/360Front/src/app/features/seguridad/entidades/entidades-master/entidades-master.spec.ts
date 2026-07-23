import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntidadesMaster } from './entidades-master';

describe('EntidadesMaster', () => {
  let component: EntidadesMaster;
  let fixture: ComponentFixture<EntidadesMaster>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntidadesMaster],
    }).compileComponents();

    fixture = TestBed.createComponent(EntidadesMaster);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
