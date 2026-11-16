import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, WritableSignal, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { downloadText } from '../../core/csv';
import { WeddingRepository } from '../../core/data/wedding.repository';
import {
  MyWedding, PROFILE_LANGUAGES, Profile, ProfileErrors, ProfileInput, ProfileLanguage, WEDDING_ROLES, WeddingRole, accountExport, cleanProfileInput,
  exportFileName, formatPhone,
} from '../../core/profile/profile.models';
import { ProfileRepository } from '../../core/profile/profile.repository';
import { ProfileStore } from '../../core/profile/profile.store';
import { firstName } from '../../core/util';
import { AvatarComponent } from '../../shared/avatar.component';
import { IndianDatePipe } from '../../shared/pipes';
import { ToastService } from '../../shared/toast.service';
import { UpiFromQr, UpiQrReaderComponent } from '../../shared/upi-qr-reader.component';
import { AvatarCropperComponent } from './avatar-cropper.component';
import { DeleteAccountComponent } from './delete-account.component';

export const ACCOUNT_SECTIONS = [
  { id: 'profile', label: 'Profile', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c.8-4 4-6 8-6s7.2 2 8 6' },
  { id: 'payments', label: 'Payment', icon: 'M3 7h18v12H3zM3 11h18M7 15h3' },
  { id: 'weddings', label: 'Wedding pages', icon: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z' },
  { id: 'notifications', label: 'Notifications', icon: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0' },
  { id: 'security', label: 'Security', icon: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z' },
  { id: 'privacy', label: 'Privacy', icon: 'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3' },
] as const;

/** The editable fields as the forms show them. */
type Draft = { fullName: string; displayName: string; phone: string; city: string; role: WeddingRole | null; language: ProfileLanguage; upiId: string; payeeName: string };
function draftOf(p: Profile | null): Draft {
  return {
    fullName: p?.fullName ?? '', displayName: p?.displayName ?? '', phone: formatPhone(p?.phone ?? ''), city: p?.city ?? '',
    role: p?.role ?? null, language: p?.language ?? 'en', upiId: p?.upiId ?? '', payeeName: p?.payeeName ?? '',
  };
}

type Busy = '' | 'profile' | 'payments' | 'notify' | 'avatar' | 'signout' | 'global' | 'export' | 'delete';

/** Account and profile: who you are, payment defaults, your pages, notifications, security, privacy. */
@Component({
  selector: 'app-account',
  imports: [RouterLink, AvatarComponent, AvatarCropperComponent, UpiQrReaderComponent, DeleteAccountComponent, IndianDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account.page.html',
  styleUrl: './account.page.scss',
})
export class AccountPage implements AfterViewInit {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(ProfileStore);
  private readonly weddingsRepo = inject(WeddingRepository);
  private readonly profiles = inject(ProfileRepository);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly sections = ACCOUNT_SECTIONS;
  protected readonly roles = WEDDING_ROLES;
  protected readonly languages = PROFILE_LANGUAGES;
  protected readonly backend = this.profiles.mode === 'supabase';
  protected readonly formatPhone = formatPhone;
  protected readonly firstName = firstName;

  // ----- profile form (a draft until saved) -----
  protected readonly fullName = signal('');
  protected readonly displayName = signal('');
  protected readonly phone = signal('');
  protected readonly city = signal('');
  protected readonly role = signal<WeddingRole | null>(null);
  protected readonly language = signal<ProfileLanguage>('en');
  // ----- payment defaults -----
  protected readonly upiId = signal('');
  protected readonly payeeName = signal('');

  protected readonly errors = signal<ProfileErrors>({});
  protected readonly busy = signal<Busy>('');
  protected readonly saved = signal<'' | 'profile' | 'payments' | 'notify'>('');
  protected readonly sectionError = signal<{ section: Busy; message: string } | null>(null);

  // ----- avatar -----
  protected readonly avatarFile = signal<File | null>(null);

  // ----- wedding pages -----
  protected readonly weddings = signal<MyWedding[] | null>(null);
  protected readonly hasOwn = computed(() => (this.weddings() ?? []).some((m) => m.access !== 'sample'));

  // ----- section navigation -----
  protected readonly active = signal<string>('profile');
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment, { initialValue: null });

  protected readonly greeting = computed(() => this.store.name() || 'there');
  protected readonly memberSince = computed(() => {
    const at = this.store.profile()?.createdAt;
    return at ? new Date(at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '';
  });
  protected readonly percent = computed(() => {
    const c = this.store.completion();
    return Math.round((c.done / c.total) * 100);
  });

  /** The draft differs from what is saved. */
  protected readonly profileDirty = computed(() => {
    const p = this.store.profile();
    return (p?.fullName ?? '') !== this.fullName() || (p?.displayName ?? '') !== this.displayName()
      || formatPhone(p?.phone ?? '') !== this.phone() || (p?.city ?? '') !== this.city()
      || (p?.role ?? null) !== this.role() || (p?.language ?? 'en') !== this.language();
  });
  protected readonly paymentsDirty = computed(() => {
    const p = this.store.profile();
    return (p?.upiId ?? '') !== this.upiId() || (p?.payeeName ?? '') !== this.payeeName();
  });

  private savedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Fill the forms when a profile arrives or changes, without touching fields the person has
    // edited but not saved yet (saving one section must not wipe another section's draft).
    let before: Profile | null = null;
    effect(() => {
      const p = this.store.profile();
      untracked(() => {
        const was = draftOf(before);
        const now = draftOf(p);
        for (const key of Object.keys(now) as (keyof Draft)[]) {
          const field = this[key] as WritableSignal<Draft[typeof key]>;
          if (field() === was[key]) field.set(now[key]);
        }
        before = p;
      });
    });
    effect(() => {
      const user = this.auth.user();
      if (user) untracked(() => void this.loadWeddings());
    });
    // Signed out (here or in another tab): back to sign-in.
    effect(() => {
      if (!this.auth.user() && this.busy() !== 'delete') untracked(() => void this.router.navigateByUrl('/login'));
    });
    // "My wedding pages" in the header menu opens #/account#weddings.
    effect(() => {
      const id = this.fragment();
      const ready = this.weddings() !== null;
      if (id && ready) untracked(() => setTimeout(() => this.scrollTo(id), 0));
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.savedTimer);
      this.observer?.disconnect();
    });
  }

  private observer: IntersectionObserver | undefined;

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, boolean>();
    this.observer = new IntersectionObserver((entries) => {
      for (const e of entries) visible.set(e.target.id, e.isIntersecting);
      const first = ACCOUNT_SECTIONS.find((s) => visible.get(s.id));
      if (first) this.active.set(first.id);
    }, { rootMargin: '-20% 0px -55% 0px' });
    for (const s of ACCOUNT_SECTIONS) {
      const el = (this.host.nativeElement as HTMLElement).querySelector(`#${s.id}`);
      if (el) this.observer.observe(el);
    }
  }

  protected scrollTo(id: string): void {
    const el = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!el) return;
    this.active.set(id);
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  protected clearError(field: keyof ProfileErrors): void {
    if (this.errors()[field]) this.errors.update(({ [field]: _gone, ...rest }) => rest);
  }

  // ---------- profile ----------

  protected async saveProfile(): Promise<void> {
    const { value, errors } = cleanProfileInput(
      { fullName: this.fullName(), displayName: this.displayName(), phone: this.phone(), city: this.city(), role: this.role(), language: this.language() },
      { requireName: true },
    );
    this.errors.set(errors);
    if (Object.keys(errors).length) return;
    await this.run('profile', () => this.store.save(value), 'Profile saved');
  }

  protected async savePayments(): Promise<void> {
    const { value, errors } = cleanProfileInput({ upiId: this.upiId(), payeeName: this.payeeName() });
    this.errors.set(errors);
    if (Object.keys(errors).length) return;
    await this.run('payments', () => this.store.save(value), 'Payment details saved');
  }

  protected useUpiFromQr(found: UpiFromQr): void {
    this.upiId.set(found.vpa);
    if (found.payeeName) this.payeeName.set(found.payeeName);
    this.toast.show('UPI ID filled in from your QR. Save to keep it.');
  }

  protected async setNotify(patch: Pick<ProfileInput, 'notifyShagun' | 'notifyRsvp'>): Promise<void> {
    await this.run('notify', () => this.store.save(patch));
  }

  // ---------- avatar ----------

  protected pickAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.avatarFile.set(file);
  }

  protected async useAvatar(dataUrl: string): Promise<void> {
    await this.run('avatar', () => this.store.uploadAvatar(dataUrl), 'Photo updated');
    if (!this.sectionError()) this.avatarFile.set(null);
  }

  protected avatarFailed(message: string): void {
    this.avatarFile.set(null);
    this.sectionError.set({ section: 'avatar', message });
  }

  protected async removeAvatar(): Promise<void> {
    await this.run('avatar', () => this.store.removeAvatar(), 'Photo removed');
  }

  // ---------- weddings ----------

  private async loadWeddings(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    try {
      const list = await this.weddingsRepo.listWeddings();
      const mine = list.filter((w) => !w.demo);
      const access = await this.profiles.weddingAccess(user, mine.map((w) => w.id));
      this.weddings.set([
        ...mine.map((wedding) => ({ wedding, access: access[wedding.id] ?? 'owner' }) as MyWedding),
        ...list.filter((w) => w.demo).map((wedding) => ({ wedding, access: 'sample' }) as MyWedding),
      ]);
    } catch {
      this.weddings.set([]);
    }
  }

  // ---------- security ----------

  protected async signOut(): Promise<void> {
    await this.run('signout', () => this.auth.signOut(), 'Signed out');
  }

  protected async signOutEverywhere(): Promise<void> {
    await this.run('global', () => this.auth.signOutEverywhere(), 'Signed out on every device');
  }

  // ---------- privacy ----------

  protected async download(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    await this.run('export', async () => {
      if (!this.weddings()) await this.loadWeddings();
      downloadText(exportFileName(), accountExport(user, this.store.profile(), this.weddings() ?? []), 'application/json;charset=utf-8');
    }, 'Your data is downloading');
  }

  protected async deleteAccount(opts: { deleteWeddings: boolean }): Promise<void> {
    this.busy.set('delete');
    this.sectionError.set(null);
    try {
      const r = await this.store.deleteAccount(opts);
      const pages = r.weddingsDeleted ? ` and ${r.weddingsDeleted} wedding page${r.weddingsDeleted === 1 ? '' : 's'}` : '';
      this.toast.show(`Your account${pages} ${r.weddingsDeleted ? 'were' : 'was'} deleted. Take care!`, 5000);
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.sectionError.set({ section: 'delete', message: (e as Error).message });
    } finally {
      this.busy.set('');
    }
  }

  // ---------- helpers ----------

  protected errorFor(section: Busy): string {
    const e = this.sectionError();
    return e?.section === section ? e.message : '';
  }

  private async run(section: Exclude<Busy, ''>, fn: () => Promise<unknown>, done?: string): Promise<void> {
    this.busy.set(section);
    this.sectionError.set(null);
    try {
      await fn();
      if (done) this.toast.show(done);
      if (section === 'profile' || section === 'payments' || section === 'notify') {
        this.saved.set(section);
        clearTimeout(this.savedTimer);
        this.savedTimer = setTimeout(() => this.saved.set(''), 2500);
      }
    } catch (e) {
      this.sectionError.set({ section, message: (e as Error).message });
    } finally {
      this.busy.set('');
    }
  }
}
