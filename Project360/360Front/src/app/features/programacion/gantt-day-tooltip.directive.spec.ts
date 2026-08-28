import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GanttDayTooltipDirective } from './gantt-day-tooltip.directive';

@Component({
  standalone: true,
  imports: [GanttDayTooltipDirective],
  template: `<div class="track" [appGanttDayTooltip]="detalles"></div>`,
})
class HostComponent {
  detalles = ['Día no laborable', 'Jornada completa', 'FERIADO · 0 hs · Aniversario'];
}

describe('GanttDayTooltipDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let track: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    track = fixture.nativeElement.querySelector('.track');
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 100, right: 400, width: 300, top: 0, bottom: 36, height: 36, x: 100, y: 0,
      toJSON: () => ({}),
    });
  });

  it('resuelve el detalle del día apuntado sin crear nodos por día', () => {
    expect(track.children.length).toBe(0);

    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 110, bubbles: true }));
    expect(track.title).toBe('Día no laborable');

    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 250, bubbles: true }));
    expect(track.title).toBe('Jornada completa');

    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 399, bubbles: true }));
    expect(track.title).toBe('FERIADO · 0 hs · Aniversario');
    expect(track.children.length).toBe(0);
  });

  it('limita posiciones fuera del ancho al primer y último día', () => {
    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 50 }));
    expect(track.title).toBe('Día no laborable');
    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 450 }));
    expect(track.title).toBe('FERIADO · 0 hs · Aniversario');
  });
});
