import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideRouter } from '@angular/router';
import { Auth } from '../../core/services/auth/auth';

import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  let component: Sidebar;
  let fixture: ComponentFixture<Sidebar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: { logout: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return to the previous screen and close the sidebar', () => {
    const location = TestBed.inject(Location);
    const backSpy = vi.spyOn(location, 'back');
    const closeSpy = vi.spyOn(component.closeSidebar, 'emit');

    component.volverAtras();

    expect(closeSpy).toHaveBeenCalled();
    expect(backSpy).toHaveBeenCalled();
  });
});
