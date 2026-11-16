import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  PAYOUT_FIELDS, PayoutForm, feeBreakdown, isTestKey, paiseToRupees, payoutFormErrors, validatePayoutForm,
} from '../../../../supabase/functions/_shared/razorpay-core';
import { RUNTIME_CONFIG } from '../../core/config';
import { FeeBearer, PaymentMode, Wedding } from '../../core/models';
import { PAYMENT_GATEWAY } from '../../core/payments/payment-gateway.token';
import { PAYOUT_STATUS_LABEL, PaymentsUnavailable, PayoutAccount, formatRupees } from '../../core/payments/payments.models';
import { WeddingStore } from '../../core/wedding.store';
import { LogoComponent } from '../../shared/logo.component';
import { ToastService } from '../../shared/toast.service';

const EXAMPLE = 2100;

const EMPTY_FORM: PayoutForm = {
  legalName: '', email: '', phone: '', pan: '', accountNumber: '', ifsc: '', beneficiaryName: '', street: '', city: '', state: '', postalCode: '',
};

export const PAYOUT_LABELS: Record<keyof PayoutForm, { label: string; hint?: string; type?: string; mode?: string; auto?: string }> = {
  legalName: { label: 'Your full name', hint: 'As on your PAN card', auto: 'name' },
  email: { label: 'Email', type: 'email', auto: 'email' },
  phone: { label: 'Mobile number', type: 'tel', mode: 'tel', auto: 'tel-national' },
  pan: { label: 'PAN', hint: 'Razorpay needs it for KYC; only the last 4 characters are kept here' },
  accountNumber: { label: 'Bank account number', mode: 'numeric', hint: 'Sent to Razorpay only; this app keeps the last 4 digits' },
  ifsc: { label: 'IFSC', hint: 'On your cheque book or bank app, e.g. HDFC0001234' },
  beneficiaryName: { label: 'Name on the bank account' },
  street: { label: 'House and street', auto: 'address-line1' },
  city: { label: 'City', auto: 'address-level2' },
  state: { label: 'State', auto: 'address-level1' },
  postalCode: { label: 'PIN code', mode: 'numeric', auto: 'postal-code' },
};

/** The couple chooses how guests pay and, for Razorpay, sets up where the money settles. */
@Component({
  selector: 'app-payments',
  imports: [RouterLink, LogoComponent],
  providers: [WeddingStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payments.page.html',
  styleUrl: './payments.page.scss',
})
export class PaymentsPage {
  protected readonly store = inject(WeddingStore);
  private readonly gateway = inject(PAYMENT_GATEWAY);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly toast = inject(ToastService);

  readonly slug = input.required<string>();

  protected readonly fields = PAYOUT_FIELDS;
  protected readonly labels = PAYOUT_LABELS;
  protected readonly statusLabel = PAYOUT_STATUS_LABEL;
  protected readonly rupees = formatRupees;
  protected readonly example = EXAMPLE;

  protected readonly mode = signal<PaymentMode>('upi_direct');
  protected readonly bearer = signal<FeeBearer>('couple');
  protected readonly savingMode = signal(false);

  protected readonly payout = signal<PayoutAccount | null>(null);
  /** False when the payment server is not deployed or reachable yet. */
  protected readonly serverReady = signal(true);
  protected readonly serverNote = signal('');
  protected readonly form = signal<PayoutForm>({ ...EMPTY_FORM });
  protected readonly formSubmitted = signal(false);
  protected readonly savingPayout = signal(false);
  protected readonly payoutError = signal('');
  protected readonly editing = signal(false);

  protected readonly availability = computed(() => {
    const w = this.store.wedding();
    return w ? this.gateway.availability(w) : 'unconfigured';
  });
  protected readonly simulated = computed(() => this.availability() === 'simulated');
  protected readonly testMode = computed(() => this.simulated() || isTestKey(this.config.razorpayKeyId));
  protected readonly errors = computed(() => payoutFormErrors(this.form()));
  protected readonly examples = computed(() => {
    const couple = feeBreakdown(EXAMPLE, 'couple');
    const guest = feeBreakdown(EXAMPLE, 'guest');
    return {
      couple: { guestPays: paiseToRupees(couple.totalPaise), coupleGets: paiseToRupees(couple.payoutPaise) },
      guest: { guestPays: paiseToRupees(guest.totalPaise), coupleGets: paiseToRupees(guest.payoutPaise) },
    };
  });
  /** What guests see right now, given everything above. */
  protected readonly guestsSee = computed(() => {
    const w = this.store.wedding();
    if (!w || w.paymentMode !== 'razorpay' || this.availability() === 'unconfigured') return 'Direct UPI to your UPI ID';
    if (w.razorpayActive || this.testMode()) return this.testMode() ? 'Razorpay Checkout (test mode, no real money)' : 'Razorpay Checkout';
    return 'Direct UPI, until Razorpay approves your payout account';
  });
  protected readonly dirty = computed(() => {
    const w = this.store.wedding();
    return !!w && ((w.paymentMode ?? 'upi_direct') !== this.mode() || (w.feeBearer ?? 'couple') !== this.bearer());
  });

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(async () => {
        const w = await this.store.load(slug, { manage: true });
        if (!w) return;
        this.mode.set(w.paymentMode ?? 'upi_direct');
        this.bearer.set(w.feeBearer ?? 'couple');
        if (this.store.owner() && this.availability() !== 'unconfigured') await this.loadPayout(w);
      });
    });
  }

  private async loadPayout(w: Wedding): Promise<void> {
    try {
      const p = await this.gateway.getPayout(w);
      this.payout.set(p);
      this.serverReady.set(true);
      if (p.status !== 'not_set_up') {
        this.form.update((f) => ({ ...f, legalName: p.legalName ?? '', email: p.email ?? '', phone: p.phone ?? '', ifsc: p.ifsc ?? '' }));
      }
    } catch (e) {
      this.serverReady.set(false);
      this.serverNote.set(e instanceof PaymentsUnavailable
        ? 'Razorpay is being set up by the site owner. Your choice is saved, and guests keep paying by UPI until it is ready.'
        : (e as Error).message);
      this.payout.set({ status: 'not_set_up', detail: '', routeEnabled: true });
    }
  }

  protected setField(key: keyof PayoutForm, value: string): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected async saveMode(): Promise<void> {
    const w = this.store.wedding();
    if (!w || this.savingMode()) return;
    this.savingMode.set(true);
    try {
      await this.store.saveWedding({ ...w, paymentMode: this.mode(), feeBearer: this.bearer() });
      this.toast.show(this.mode() === 'razorpay' ? 'Razorpay mode saved' : 'Guests will pay by UPI directly');
    } catch (e) {
      this.toast.show((e as Error).message);
    } finally {
      this.savingMode.set(false);
    }
  }

  protected async savePayout(): Promise<void> {
    const w = this.store.wedding();
    this.formSubmitted.set(true);
    this.payoutError.set('');
    const parsed = validatePayoutForm(this.form());
    if (!w || !parsed.ok || this.savingPayout()) return;
    this.savingPayout.set(true);
    try {
      const p = await this.gateway.savePayout(w, parsed.value);
      this.payout.set(p);
      this.editing.set(false);
      // Never keep the full bank account or PAN in memory longer than needed.
      this.form.update((f) => ({ ...f, accountNumber: '', pan: '' }));
      this.formSubmitted.set(false);
      await this.store.refresh();
      this.toast.show(p.status === 'active' ? 'Payout account active' : 'Sent to Razorpay for review');
    } catch (e) {
      if (e instanceof PaymentsUnavailable) {
        this.serverReady.set(false);
        this.serverNote.set('Razorpay is being set up by the site owner, so your details were not sent. Please try again later.');
      } else {
        this.payoutError.set((e as Error).message);
      }
    } finally {
      this.savingPayout.set(false);
    }
  }

  protected async simulateApproval(): Promise<void> {
    const w = this.store.wedding();
    if (!w || !this.gateway.simulateApproval) return;
    this.payout.set(await this.gateway.simulateApproval(w));
    await this.store.refresh();
    this.toast.show('Demo: payout account approved');
  }
}
