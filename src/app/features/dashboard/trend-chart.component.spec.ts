import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { contribution } from '../../core/testing';
import { TrendChartComponent } from './trend-chart.component';

describe('TrendChartComponent (shagun over time)', () => {
  let fixture: ComponentFixture<TrendChartComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TrendChartComponent], providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(TrendChartComponent);
    const now = Date.now();
    fixture.componentRef.setInput('contributions', [
      contribution('g1', 2100, { createdAt: now - 3 * 86_400_000 }),
      contribution('g1', 5100, { createdAt: now - 86_400_000 }),
    ]);
    el = fixture.nativeElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    el.remove();
  });

  function pointer(target: Element, type: string, pointerType: string): void {
    const r = target.getBoundingClientRect();
    target.dispatchEvent(new PointerEvent(type, { pointerType, clientX: r.right - 5, clientY: r.top + r.height / 2, bubbles: true }));
    fixture.detectChanges();
  }

  const tip = () => el.querySelector('.tip[role=status]');

  it('keeps the tooltip on the tapped day after the finger lifts', () => {
    const svg = el.querySelector('svg')!;
    pointer(svg, 'pointerdown', 'touch');
    expect(tip()?.textContent).toContain('so far');
    pointer(el.querySelector('.chart')!, 'pointerleave', 'touch');
    expect(tip()).not.toBeNull();
  });

  it('hides the tooltip when the mouse leaves', () => {
    const svg = el.querySelector('svg')!;
    pointer(svg, 'pointermove', 'mouse');
    expect(tip()).not.toBeNull();
    pointer(el.querySelector('.chart')!, 'pointerleave', 'mouse');
    expect(tip()).toBeNull();
  });
});
