import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatInr, parseAmount } from '../../core/format';
import { MAX_UPI_AMOUNT, SHAGUN_CHIPS, SIDES, Side } from '../../core/models';
import { inviteMessage, normalizeIndianPhone, whatsappUrl } from '../../core/share';
import { buildUpiLink, canOpenUpiApps } from '../../core/upi';
import { firstName } from '../../core/util';
import { WeddingStore } from '../../core/wedding.store';
import { copyText } from '../../shared/clipboard';
import { InrPipe } from '../../shared/pipes';
import { QrCodeComponent } from '../../shared/qr-code.component';
import { ToastService } from '../../shared/toast.service';

type Step = 'details' | 'pay' | 'done';
const MESSAGE_MAX = 280;

@Component({
  selector: 'app-give',
  imports: [RouterLink, InrPipe, QrCodeComponent],
  providers: [WeddingStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './give.page.html',
  styleUrl: './give.page.scss',
})
export class GivePage {
  protected readonly store = inject(WeddingStore);
  private readonly toast = inject(ToastService);

  readonly slug = input.required<string>();
  /** Pre-selected goal from the wedding page (`?goal=`). */
  readonly goal = input<string>();

  protected readonly chips = SHAGUN_CHIPS;
  protected readonly maxAmount = MAX_UPI_AMOUNT;
  protected readonly messageMax = MESSAGE_MAX;
  protected readonly onPhone = canOpenUpiApps();

  protected readonly step = signal<Step>('details');
  protected readonly goalId = signal('');
  protected readonly amountText = signal('2100');
  protected readonly guestName = signal('');
  protected readonly message = signal('');
  protected readonly phone = signal('');
  protected readonly side = signal<Side | null>(null);
  protected readonly sides = SIDES;
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);

  protected readonly amount = computed(() => parseAmount(this.amountText()));
  protected readonly selectedGoal = computed(() => this.store.wedding()?.goals.find((g) => g.id === this.goalId()) ?? null);
  protected readonly couple = computed(() => {
    const w = this.store.wedding();
    return w ? `${firstName(w.partner1)} & ${firstName(w.partner2)}` : '';
  });

  protected readonly errors = computed(() => {
    const a = this.amount();
    const phone = this.phone().trim();
    return {
      goal: this.selectedGoal() ? '' : 'Choose a dream to bless.',
      amount: !Number.isFinite(a) || a < 1 ? 'Enter an amount in rupees.'
        : !Number.isInteger(a) ? 'Please use whole rupees.'
        : a > MAX_UPI_AMOUNT ? `UPI allows up to ${formatInr(MAX_UPI_AMOUNT)} in one payment. Split it into two, or pay the rest by bank transfer.`
        : '',
      name: this.guestName().trim().length >= 2 ? '' : 'Tell the couple who this blessing is from.',
      phone: phone && !normalizeIndianPhone(phone) ? 'Enter a 10-digit Indian mobile number, or leave it empty.' : '',
      message: this.message().length > MESSAGE_MAX ? `Keep it under ${MESSAGE_MAX} characters.` : '',
    };
  });
  protected readonly valid = computed(() => Object.values(this.errors()).every((e) => !e));

  protected readonly upiLink = computed(() => {
    const w = this.store.wedding();
    const g = this.selectedGoal();
    if (!w || !g || !this.valid()) return '';
    return buildUpiLink({
      vpa: w.upiId,
      payeeName: w.payeeName,
      amount: this.amount(),
      note: `Shagun ${g.title} from ${firstName(this.guestName())}`,
    });
  });

  protected readonly shareWhatsapp = computed(() => {
    const w = this.store.wedding();
    const t = this.store.totals();
    return w && t ? whatsappUrl(inviteMessage(w, this.store.shareUrl(), t.target)) : '';
  });

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(async () => {
        const w = await this.store.load(slug);
        const preferred = w?.goals.find((g) => g.id === this.goal()) ?? w?.goals[0];
        if (preferred) this.goalId.set(preferred.id);
      });
    });
  }

  protected chooseChip(value: number): void {
    this.amountText.set(String(value));
  }

  protected toPayment(): void {
    this.submitted.set(true);
    if (!this.valid()) return;
    this.step.set('pay');
    globalThis.scrollTo?.({ top: 0 });
  }

  protected async copy(text: string, label: string): Promise<void> {
    this.toast.show((await copyText(text)) ? `${label} copied` : 'Could not copy');
  }

  /** The guest confirms they paid in their UPI app. The couple verifies it later. */
  protected async confirmPaid(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.contribute({
        goalId: this.goalId(),
        guestName: this.guestName().trim(),
        amount: this.amount(),
        message: this.message().trim(),
        phone: normalizeIndianPhone(this.phone()) ?? undefined,
        side: this.side() ?? undefined,
      });
      this.step.set('done');
      globalThis.scrollTo?.({ top: 0 });
    } catch (e) {
      this.toast.show((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
