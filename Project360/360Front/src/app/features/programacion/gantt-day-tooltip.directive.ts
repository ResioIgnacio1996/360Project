import { Directive, ElementRef, Input, NgZone, OnDestroy, OnInit } from '@angular/core';

@Directive({
  selector: '[appGanttDayTooltip]',
  standalone: true,
})
export class GanttDayTooltipDirective implements OnInit, OnDestroy {
  @Input({ required: true }) appGanttDayTooltip: readonly string[] = [];

  private ultimoDia = -1;
  private readonly actualizar = (evento: PointerEvent): void => {
    const elemento = this.elemento.nativeElement;
    const rect = elemento.getBoundingClientRect();
    if (!rect.width || !this.appGanttDayTooltip.length) return;

    const proporcion = Math.max(0, Math.min(0.999999, (evento.clientX - rect.left) / rect.width));
    const dia = Math.floor(proporcion * this.appGanttDayTooltip.length);
    if (dia === this.ultimoDia) return;

    this.ultimoDia = dia;
    const detalle = this.appGanttDayTooltip[dia] || '';
    if (detalle) elemento.title = detalle;
    else elemento.removeAttribute('title');
  };

  constructor(
    private readonly elemento: ElementRef<HTMLElement>,
    private readonly zona: NgZone,
  ) {}

  ngOnInit(): void {
    this.zona.runOutsideAngular(() => {
      this.elemento.nativeElement.addEventListener('pointermove', this.actualizar, { passive: true });
    });
  }

  ngOnDestroy(): void {
    this.elemento.nativeElement.removeEventListener('pointermove', this.actualizar);
  }
}
