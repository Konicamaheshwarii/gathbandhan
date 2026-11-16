import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { feeBreakdown, isTestKey, paiseToRupees } from '../../../../supabase/functions/_shared/razorpay-core';
import { RUNTIME_CONFIG } from '../../core/config';
import { formatInr, parseAmount } from '../../core/format';
import { MAX_UPI_AMOUNT, SHAGUN_CHIPS, SIDES, Side, Wedding } from '../../core/models';
import { PAYMENT_GATEWAY } from '../../core/payments/payment-gateway.token';
import { CheckoutResponse, CreatedOrder, OrderRequest, PaymentState, PaymentsUnavailable, formatRupees } from '../../core/payments/payments.models';
import { CHECKOUT_LAUNCHER, CHECKOUT_THEME, CheckoutOutcome } from '../../core/payments/razorpay-checkout';
import { inviteMessage, normalizeIndianPhone, whatsappUrl } from '../../core/share';
import { buildUpiLink, canOpenUpiApps } from '../../core/upi';
import { firstName } from '../../core/util';
import { WeddingStore } from '../../core/wedding.store';
import { copyText } from '../../shared/clipboard';
import { LogoComponent } from '../../shared/logo.component';
import { InrPipe } from '../../shared/pipes';
import { QrCodeComponent } from '../../shared/qr-code.component';
import { ToastService } from '../../shared/toast.service';
import { DemoCheckoutComponent } from './demo-checkout.component';

type Step = 'details' | 'pay' | 'done';
/** Razorpay flow: ready to pay, talking to the server, checkout open, confirming, or slow to confirm. */
export type PayState = 'idle' | 'starting' | 'checkout' | 'verifying' | 'slow' | 'failed';
const MESSAGE_MAX = 280;
/** Polling after checkout, in case verification is slow; the webhook confirms it meanwhile. */
export const POLL = { everyMs: 2_000, tries: 15 };

@Component({
  selector: 'app-give',
  imports: [LogoComponent, RouterLink, InrPipe, QrCodeComponent, DemoCheckoutComponent],
  providers: [WeddingStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './give.page.html',
  styleUrl: './give.page.scss',
})
export class GivePage {
  protected readonly store = inject(WeddingStore);
  private readonly toast = inject(ToastService);
  private readonly gateway = inject(PAYMENT_GATEWAY);
  private readonly launcher = inject(CHECKOUT_LAUNCHER);
  private readonly config = inject(RUNTIME_CONFIG);

  readonly slug = input.required<string>();
  /** Pre-selected goal from the wedding page (`?goal=`). */
  readonly goal = input<string>();

  protected readonly chips = SHAGUN_CHIPS;
  protected readonly maxAmount = MAX_UPI_AMOUNT;
  protected readonly messageMax = MESSAGE_MAX;
  protected readonly onPhone = canOpenUpiApps();
  protected readonly rupees = formatRupees;

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

  // ---------- Razorpay ----------
  protected readonly payState = signal<PayState>('idle');
  protected readonly failure = signal('');
  protected readonly order = signal<CreatedOrder | null>(null);
  protected readonly paymentId = signal('');
  /** The guest chose direct UPI, or the payment server is not reachable / not set up yet. */
  protected readonly directUpi = signal(false);
  protected readonly fallbackNote = signal('');
  /** Set while the simulated (demo) checkout is open. */
  protected readonly demoCheckout = signal<{ orderId: string; total: number } | null>(null);
  private demoResolve: ((o: CheckoutOutcome) => void) | null = null;
  protected readonly paidViaRazorpay = signal(false);

  protected readonly availability = computed(() => {
    const w = this.store.wedding();
    return w ? this.gateway.availability(w) : 'unconfigured';
  });
  protected readonly simulated = computed(() => this.availability() === 'simulated');
  /** Test-mode keys (and the demo) take no real money; the page says so everywhere. */
  protected readonly testMode = computed(() => this.simulated() || isTestKey(this.config.razorpayKeyId));
  /** The couple chose Razorpay, it is configured, and payouts are active (or it is test mode). */
  protected readonly razorpayMode = computed(() => {
    const w = this.store.wedding();
    if (!w || w.paymentMode !== 'razorpay' || this.availability() === 'unconfigured') return false;
    return !!w.razorpayActive || this.testMode();
  });
  /** Razorpay is how this guest pays right now. */
  protected readonly useRazorpay = computed(() => this.razorpayMode() && !this.directUpi());

  protected readonly amount = computed(() => parseAmount(this.amountText()));
  protected readonly fees = computed(() => {
    const w = this.store.wedding();
    const a = this.amount();
    if (!w || !Number.isInteger(a) || a < 1 || a > MAX_UPI_AMOUNT) return null;
    const f = feeBreakdown(a, w.feeBearer ?? 'couple');
    return { convenienceFee: paiseToRupees(f.convenienceFeePaise), total: paiseToRupees(f.totalPaise), guestPays: (w.feeBearer ?? 'couple') === 'guest' };
  });
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

  protected backToDetails(): void {
    this.step.set('details');
    // A new amount or message needs a new order.
    this.order.set(null);
    this.payState.set('idle');
    this.failure.set('');
  }

  protected async copy(text: string, label: string): Promise<void> {
    this.toast.show((await copyText(text)) ? `${label} copied` : 'Could not copy');
  }

  /** The guest confirms they paid in their UPI app. The couple verifies it later. */
  protected async confirmPaid(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.contribute(this.request());
      this.paidViaRazorpay.set(false);
      this.step.set('done');
      globalThis.scrollTo?.({ top: 0 });
    } catch (e) {
      this.toast.show((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  protected payDirectly(note = ''): void {
    this.directUpi.set(true);
    this.fallbackNote.set(note);
    this.payState.set('idle');
    this.failure.set('');
  }

  private request(): OrderRequest {
    return {
      goalId: this.goalId(),
      guestName: this.guestName().trim(),
      amount: this.amount(),
      message: this.message().trim(),
      phone: normalizeIndianPhone(this.phone()) ?? undefined,
      side: this.side() ?? undefined,
    };
  }

  /** Razorpay: create (or reuse) the order, open Checkout, then verify on the server. */
  protected async payWithRazorpay(): Promise<void> {
    const w = this.store.wedding();
    const state = this.payState();
    if (!w || state === 'starting' || state === 'checkout' || state === 'verifying') return;
    this.failure.set('');
    this.payState.set('starting');
    const req = this.request();
    let order = this.order();
    try {
      // A retry reuses the order: Razorpay accepts new attempts on it until one succeeds.
      order ??= await this.gateway.createOrder(w, req);
      this.order.set(order);
    } catch (e) {
      if (e instanceof PaymentsUnavailable) {
        this.payDirectly('Card and netbanking payments are still being set up. You can pay by UPI directly below; it works just the same.');
      } else {
        this.payState.set('failed');
        this.failure.set((e as Error).message);
      }
      return;
    }

    this.payState.set('checkout');
    let outcome: CheckoutOutcome;
    try {
      outcome = order.simulated
        ? await this.openDemoCheckout(order)
        : await this.launcher.open({
            key: order.keyId,
            amount: order.amountPaise,
            currency: 'INR',
            order_id: order.orderId,
            name: 'Gathbandhan',
            description: `Shagun for ${this.couple()}`,
            prefill: { name: req.guestName, ...(req.phone ? { contact: `+${req.phone}` } : {}) },
            notes: { goal: this.selectedGoal()?.title ?? '' },
            theme: { color: CHECKOUT_THEME },
          });
    } catch (e) {
      // checkout.js could not load (offline, blocked): direct UPI still works.
      this.payState.set('failed');
      this.failure.set((e as Error).message);
      return;
    }

    if (outcome.kind === 'dismissed') {
      this.payState.set('failed');
      this.failure.set('You closed the payment window. Nothing was charged; you can try again.');
      return;
    }
    if (outcome.kind === 'failed') {
      this.payState.set('failed');
      this.failure.set(`${outcome.reason} No money was taken; you can try again.`);
      return;
    }
    await this.confirm(w, order, outcome.response, req);
  }

  private async confirm(w: Wedding, order: CreatedOrder, response: CheckoutResponse, req: OrderRequest): Promise<void> {
    this.payState.set('verifying');
    this.paymentId.set(response.razorpay_payment_id);
    let status: PaymentState | null = null;
    try {
      status = await this.gateway.verify(w, order, response, req);
    } catch {
      status = null; // slow or unreachable: the webhook still confirms it, so poll
    }
    for (let i = 0; status !== 'paid' && status !== 'failed' && i < POLL.tries; i++) {
      await new Promise((r) => setTimeout(r, POLL.everyMs));
      status = await this.gateway.orderStatus(w, order.orderId).catch(() => null);
    }
    if (status === 'paid') {
      this.paidViaRazorpay.set(true);
      this.payState.set('idle');
      this.step.set('done');
      globalThis.scrollTo?.({ top: 0 });
      await this.store.paymentConfirmed();
    } else if (status === 'failed') {
      this.payState.set('failed');
      this.failure.set('Razorpay reported this payment as failed. No money was taken; you can try again.');
    } else {
      this.payState.set('slow');
    }
  }

  private openDemoCheckout(order: CreatedOrder): Promise<CheckoutOutcome> {
    return new Promise((resolve) => {
      this.demoResolve = resolve;
      this.demoCheckout.set({ orderId: order.orderId, total: order.total });
    });
  }

  protected demoDone(outcome: CheckoutOutcome): void {
    this.demoCheckout.set(null);
    this.demoResolve?.(outcome);
    this.demoResolve = null;
  }
}
