import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { EMPTY_CONFIG, RUNTIME_CONFIG } from '../../core/config';
import { KEYS, LocalStorageWeddingRepository } from '../../core/data/local-storage.repository';
import { WeddingRepository } from '../../core/data/wedding.repository';
import { Wedding } from '../../core/models';
import { PAYMENT_GATEWAY } from '../../core/payments/payment-gateway.token';
import { CreatedOrder, PaymentGateway, PaymentsUnavailable } from '../../core/payments/payments.models';
import { CHECKOUT_LAUNCHER, CheckoutLauncher, CheckoutOptions, CheckoutOutcome } from '../../core/payments/razorpay-checkout';
import { wedding } from '../../core/testing';
import { GivePage, POLL } from './give.page';

const ORDER: CreatedOrder = {
  orderId: 'order_Test1234567', keyId: 'rzp_test_abcdefgh', amount: 1100, amountPaise: 112659, convenienceFee: 26.59, total: 1126.59,
  testMode: true, routed: true, simulated: false,
};
const SUCCESS: CheckoutOutcome = {
  kind: 'success',
  response: { razorpay_order_id: ORDER.orderId, razorpay_payment_id: 'pay_Test7654321', razorpay_signature: 'f'.repeat(64) },
};

describe('GivePage with Razorpay', () => {
  let fixture: ComponentFixture<GivePage>;
  let el: HTMLElement;
  let gateway: jasmine.SpyObj<PaymentGateway>;
  let outcomes: CheckoutOutcome[];
  let opened: CheckoutOptions[];
  const realPoll = { ...POLL };

  const button = (text: string) => [...el.querySelectorAll<HTMLElement>('button, a')].find((b) => b.textContent!.includes(text));
  const type = (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const settle = async () => {
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 0));
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };

  async function setup(patch: Partial<Wedding> = {}, keyId = 'rzp_test_abcdefgh', availability: 'live' | 'unconfigured' = 'live'): Promise<void> {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    gateway = jasmine.createSpyObj<PaymentGateway>('gateway', ['availability', 'createOrder', 'verify', 'orderStatus', 'getPayout', 'savePayout']);
    gateway.availability.and.returnValue(availability);
    gateway.createOrder.and.resolveTo(ORDER);
    gateway.verify.and.resolveTo('paid');
    gateway.orderStatus.and.resolveTo('pending');
    outcomes = [];
    opened = [];
    const launcher: CheckoutLauncher = { open: async (o) => (opened.push(o), outcomes.shift() ?? { kind: 'dismissed' }) };
    await TestBed.configureTestingModule({
      imports: [GivePage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: WeddingRepository, useClass: LocalStorageWeddingRepository },
        { provide: PAYMENT_GATEWAY, useValue: gateway },
        { provide: CHECKOUT_LAUNCHER, useValue: launcher },
        { provide: RUNTIME_CONFIG, useValue: { ...EMPTY_CONFIG, razorpayKeyId: keyId } },
      ],
    }).compileComponents();
    const repo = TestBed.inject(WeddingRepository) as LocalStorageWeddingRepository;
    await repo.saveWedding(wedding({ paymentMode: 'razorpay', feeBearer: 'guest', razorpayActive: true, ...patch }));
    fixture = TestBed.createComponent(GivePage);
    fixture.componentRef.setInput('slug', 'asha-weds-dev');
    el = fixture.nativeElement;
    await settle();
    await settle();
  }

  async function toPay(): Promise<void> {
    button('₹1,100')!.click();
    type('input[autocomplete=name]', 'Pooja Bua');
    type('textarea', 'Khoob ghoomo!');
    type('input[type=tel]', '98765 43210');
    await settle();
    button('Continue to pay')!.click();
    await settle();
  }

  beforeEach(() => {
    POLL.everyMs = 1;
    POLL.tries = 3;
  });
  afterEach(() => {
    Object.assign(POLL, realPoll);
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  });

  it('shows the fee line and test-mode details, then pays, verifies and confirms', async () => {
    await setup();
    await toPay();
    expect(el.textContent).toContain('Convenience fee');
    expect(el.textContent).toContain('₹1,126.59');
    expect(el.textContent).toContain('Test mode, no real money');
    expect(el.textContent).toContain('success@razorpay');
    expect(el.querySelector('app-qr-code')).toBeNull(); // no UPI QR in Razorpay mode

    outcomes.push(SUCCESS);
    button('securely')!.click();
    await settle();
    await settle();

    expect(gateway.createOrder).toHaveBeenCalledOnceWith(jasmine.anything(), jasmine.objectContaining({ goalId: 'g1', amount: 1100, guestName: 'Pooja Bua', message: 'Khoob ghoomo!', phone: '919876543210' }));
    expect(opened[0]).toEqual(jasmine.objectContaining({ key: 'rzp_test_abcdefgh', amount: 112659, order_id: ORDER.orderId, currency: 'INR' }));
    expect(opened[0].prefill).toEqual({ name: 'Pooja Bua', contact: '+919876543210' });
    expect(opened[0].theme.color).toBe('#8a1c3b');
    expect(gateway.verify).toHaveBeenCalledOnceWith(jasmine.anything(), ORDER, SUCCESS.kind === 'success' ? SUCCESS.response : (null as never), jasmine.anything());
    expect(el.textContent).toContain('✓ Payment confirmed');
    expect(el.textContent).toContain('pay_Test7654321');
  });

  it('shows a failure, and a retry reuses the same order', async () => {
    await setup();
    await toPay();
    outcomes.push({ kind: 'failed', reason: 'Your bank declined the payment.' });
    button('securely')!.click();
    await settle();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Your bank declined the payment.');

    outcomes.push(SUCCESS);
    button('Try again')!.click();
    await settle();
    await settle();
    expect(gateway.createOrder).toHaveBeenCalledTimes(1);
    expect(opened.length).toBe(2);
    expect(el.textContent).toContain('✓ Payment confirmed');
  });

  it('says nothing was charged when the guest closes Checkout', async () => {
    await setup();
    await toPay();
    button('securely')!.click(); // launcher returns "dismissed"
    await settle();
    expect(el.textContent).toContain('Nothing was charged');
    expect(button('Try again')).toBeTruthy();
  });

  it('polls the order when verification is slow, and the webhook confirms it', async () => {
    await setup();
    await toPay();
    gateway.verify.and.rejectWith(new PaymentsUnavailable('timeout'));
    gateway.orderStatus.and.returnValues(Promise.resolve('pending'), Promise.resolve('paid'));
    outcomes.push(SUCCESS);
    button('securely')!.click();
    await settle();
    await settle();
    expect(gateway.orderStatus).toHaveBeenCalledWith(jasmine.anything(), ORDER.orderId);
    expect(el.textContent).toContain('✓ Payment confirmed');
  });

  it('tells the guest it is being confirmed when polling runs out', async () => {
    await setup();
    await toPay();
    gateway.verify.and.rejectWith(new Error('slow'));
    outcomes.push(SUCCESS);
    button('securely')!.click();
    await settle();
    await settle();
    expect(el.textContent).toContain('Your payment is being confirmed');
    expect(button('Try again')).toBeUndefined();
  });

  it('falls back to direct UPI when the payment server is not set up yet', async () => {
    await setup();
    await toPay();
    gateway.createOrder.and.rejectWith(new PaymentsUnavailable('404'));
    button('securely')!.click();
    await settle();
    expect(el.textContent).toContain('still being set up');
    expect(el.querySelector('app-qr-code svg path')).not.toBeNull();
    expect(button("I've paid")).toBeTruthy();
  });

  it('keeps direct UPI when the couple has not chosen Razorpay, or it is not configured', async () => {
    await setup({ paymentMode: 'upi_direct' });
    await toPay();
    expect(el.querySelector('app-qr-code')).not.toBeNull();
    expect(button('securely')).toBeUndefined();
    TestBed.resetTestingModule();

    await setup({}, '', 'unconfigured');
    await toPay();
    expect(button('securely')).toBeUndefined();
    expect(gateway.createOrder).not.toHaveBeenCalled();
  });

  it('with live keys, waits for an active payout account before offering Razorpay', async () => {
    await setup({ razorpayActive: false }, 'rzp_live_abcdefgh');
    await toPay();
    expect(button('securely')).toBeUndefined();
    expect(el.textContent).not.toContain('Test mode');
  });
});
