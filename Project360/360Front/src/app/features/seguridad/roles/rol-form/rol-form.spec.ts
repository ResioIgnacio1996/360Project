import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RolFormComponent } from './rol-form';

describe('RolFormComponent', () => {
  let component: RolFormComponent;
  let fixture: ComponentFixture<RolFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RolFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RolFormComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
