import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RolesMasterComponent } from './roles-master';

describe('RolesMasterComponent', () => {
  let component: RolesMasterComponent;
  let fixture: ComponentFixture<RolesMasterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RolesMasterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RolesMasterComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
