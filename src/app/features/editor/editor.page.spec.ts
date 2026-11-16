import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService, DemoAuthService } from '../../core/auth/auth.service';
import { LocalStorageWeddingRepository } from '../../core/data/local-storage.repository';
import { WeddingRepository } from '../../core/data/wedding.repository';
import { LocalProfileRepository, ProfileRepository } from '../../core/profile/profile.repository';
import { EditorPage } from './editor.page';

/** Regression: Save on #/create must work once the required fields are filled in like a user would. */
describe('EditorPage (create)', () => {
  let fixture: ComponentFixture<EditorPage>;
  let el: HTMLElement;
  let repo: WeddingRepository;

  const clear = () => Object.keys(localStorage).filter((k) => k.startsWith('sg.')).forEach((k) => localStorage.removeItem(k));
  const settle = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
    TestBed.tick();
    fixture.detectChanges();
  };
  const type = (selector: string, value: string, index = 0) => {
    const input = el.querySelectorAll<HTMLInputElement>(selector)[index];
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  };

  beforeEach(async () => {
    clear();
    TestBed.configureTestingModule({
      imports: [EditorPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: WeddingRepository, useClass: LocalStorageWeddingRepository },
        { provide: AuthService, useClass: DemoAuthService },
        { provide: ProfileRepository, useClass: LocalProfileRepository },
      ],
    });
    repo = TestBed.inject(WeddingRepository);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(EditorPage);
    el = fixture.nativeElement;
    await settle();
  });
  afterEach(() => {
    fixture.destroy();
    clear();
  });

  it('keeps Save enabled and saves once the required fields are filled, leaving the optional ones empty', async () => {
    const save = el.querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(save.disabled).toBeFalse();
    type('[formcontrolname=partner1]', 'Konica Maheshwari');
    type('[formcontrolname=partner2]', 'Aarav Joshi');
    type('[formcontrolname=date]', '2027-02-14');
    type('[formcontrolname=venue]', 'Jagmandir Island Palace');
    type('[formcontrolname=upiId]', 'konica.m@okaxis');
    type('[formcontrolname=payeeName]', 'Konica Maheshwari');
    type('[formcontrolname=title]', 'Honeymoon', 0);
    type('[formcontrolname=target]', '200000', 0);
    type('[formcontrolname=title]', 'First home', 1);
    type('[formcontrolname=target]', '500000', 1);
    fixture.detectChanges();
    expect(save.disabled).toBeFalse();
    save.click();
    await settle();
    const saved = (await repo.listWeddings()).find((w) => w.partner1 === 'Konica Maheshwari');
    expect(saved).withContext(el.querySelector('.alert')?.textContent ?? 'not saved').toBeDefined();
    expect(saved!.goals.length).toBe(2);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/w', saved!.slug, 'dashboard']);
  });

  it('does not save an incomplete page, and the button stays usable', async () => {
    const save = el.querySelector<HTMLButtonElement>('button[type=submit]')!;
    type('[formcontrolname=partner1]', 'Konica');
    save.click();
    await settle();
    expect((await repo.listWeddings()).some((w) => w.partner1 === 'Konica')).toBeFalse();
    expect(save.disabled).toBeFalse();
  });
});
