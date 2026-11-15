import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { REDUCED_MOTION, SlideDirective, SliderComponent } from './slider.component';

@Component({
  imports: [SliderComponent, SlideDirective],
  template: `
    <app-slider label="Styles" [count]="4" [labels]="names" [(index)]="index" [interval]="interval()">
      <ng-template appSlide let-i><div class="card">{{ names[i] }}</div></ng-template>
      <p class="caption">{{ names[index()] }}</p>
    </app-slider>
  `,
})
class HostComponent {
  readonly names = ['Ganesh', 'Rajasthani', 'Gujarati', 'South'];
  readonly index = signal(0);
  readonly interval = signal(1000);
}

describe('SliderComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;

  const setup = (reducedMotion = false) => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection(), { provide: REDUCED_MOTION, useValue: reducedMotion }],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  };
  const slider = () => el.querySelector('app-slider') as HTMLElement;
  const click = (selector: string) => {
    el.querySelector<HTMLElement>(selector)!.click();
    fixture.detectChanges();
  };
  const key = (k: string) => {
    slider().querySelector('.viewport')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    fixture.detectChanges();
  };
  const activeLabel = () => el.querySelector('.slide.active')!.getAttribute('aria-label');

  beforeEach(() => jasmine.clock().install());
  afterEach(() => jasmine.clock().uninstall());

  it('is an accessible carousel of labelled slides', () => {
    setup();
    expect(slider().getAttribute('role')).toBe('region');
    expect(slider().getAttribute('aria-roledescription')).toBe('carousel');
    expect(slider().getAttribute('aria-label')).toBe('Styles');
    const slides = el.querySelectorAll('.slide');
    expect(slides.length).toBe(4);
    expect(slides[0].getAttribute('aria-roledescription')).toBe('slide');
    expect(activeLabel()).toBe('Ganesh (1 of 4)');
    expect(slides[1].getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.caption')!.textContent).toBe('Ganesh');
  });

  it('moves with the arrows and wraps at both ends, announcing the change', () => {
    setup();
    click('.arrow.next');
    expect(host.index()).toBe(1);
    expect(el.querySelector('.caption')!.textContent).toBe('Rajasthani');
    click('.arrow.prev');
    click('.arrow.prev');
    expect(host.index()).toBe(3);
    expect(el.querySelector('[aria-live]')!.textContent).toBe('South, 4 of 4');
    click('.arrow.next');
    expect(host.index()).toBe(0);
  });

  it('goes to a slide from its dot and marks the current one', () => {
    setup();
    click('.dot:nth-child(3)');
    expect(host.index()).toBe(2);
    expect(el.querySelectorAll('.dot')[2].getAttribute('aria-current')).toBe('true');
    expect(el.querySelectorAll('.dot')[0].getAttribute('aria-current')).toBeNull();
  });

  it('follows the arrow, Home and End keys', () => {
    setup();
    key('ArrowRight');
    key('ArrowRight');
    expect(host.index()).toBe(2);
    key('ArrowLeft');
    expect(host.index()).toBe(1);
    key('End');
    expect(host.index()).toBe(3);
    key('Home');
    expect(host.index()).toBe(0);
    key('ArrowLeft');
    expect(host.index()).toBe(3);
  });

  it('places neighbours either side, the short way round', () => {
    setup();
    const s = fixture.debugElement.children[0].componentInstance as SliderComponent;
    expect([0, 1, 2, 3].map((i) => s.offset(i))).toEqual([0, 1, 2, -1]);
    s.go(3);
    expect([0, 1, 2, 3].map((i) => s.offset(i))).toEqual([1, -2, -1, 0]);
  });

  it('autoplays, and pauses on hover, focus and the pause button', () => {
    setup();
    jasmine.clock().tick(1001);
    expect(host.index()).toBe(1);

    slider().dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    jasmine.clock().tick(3000);
    expect(host.index()).toBe(1);
    slider().dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();
    jasmine.clock().tick(1001);
    expect(host.index()).toBe(2);

    slider().dispatchEvent(new FocusEvent('focusin'));
    fixture.detectChanges();
    jasmine.clock().tick(3000);
    expect(host.index()).toBe(2);
    slider().dispatchEvent(new FocusEvent('focusout'));
    fixture.detectChanges();

    click('.play');
    jasmine.clock().tick(3000);
    expect(host.index()).toBe(2);
    expect(el.querySelector('.play')!.getAttribute('aria-label')).toBe('Play the slideshow');
    // Autoplay moves are not announced.
    expect(el.querySelector('[aria-live]')!.textContent).toBe('');
  });

  it('pauses while a finger is on it', () => {
    setup();
    const viewport = el.querySelector('.viewport')!;
    viewport.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerType: 'touch', clientX: 100, clientY: 10, pointerId: 1 }));
    fixture.detectChanges();
    jasmine.clock().tick(3000);
    expect(host.index()).toBe(0);
  });

  it('swipes left to the next slide and right to the previous', () => {
    setup();
    const viewport = el.querySelector('.viewport')!;
    const swipe = (from: number, to: number) => {
      viewport.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerType: 'mouse', clientX: from, clientY: 10, pointerId: 2 }));
      viewport.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: (from + to) / 2, clientY: 10, pointerId: 2 }));
      viewport.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: to, clientY: 10, pointerId: 2 }));
      viewport.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse', clientX: to, clientY: 10, pointerId: 2 }));
      fixture.detectChanges();
    };
    swipe(200, 100);
    expect(host.index()).toBe(1);
    swipe(100, 200);
    expect(host.index()).toBe(0);
    swipe(100, 120); // too short to count
    expect(host.index()).toBe(0);
  });

  it('never autoplays, and hides the play button, when reduced motion is asked for', () => {
    setup(true);
    jasmine.clock().tick(5000);
    expect(host.index()).toBe(0);
    expect(el.querySelector('.play')).toBeNull();
    expect(slider().classList).toContain('reduced');
  });

  it('does not autoplay when the interval is 0', () => {
    setup();
    host.interval.set(0);
    fixture.detectChanges();
    jasmine.clock().tick(5000);
    expect(host.index()).toBe(0);
  });
});
