import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { KEYS, LocalStorageWeddingRepository } from '../data/local-storage.repository';
import { invokeFunction } from '../data/supabase/supabase-payment-gateway';
import { WeddingRepository } from '../data/wedding.repository';
import { wedding } from '../testing';
import { DemoPaymentGateway, signDemoPayment } from './demo-payment-gateway';
import { PaymentsUnavailable } from './payments.models';

type Invoke = (name: string, opts: unknown) => Promise<{ data: unknown; error: unknown }>;
const client = (invoke: Invoke) => ({ functions: { invoke } }) as never;
const httpError = (status: number, body?: unknown) => ({
  data: null,
  error: { name: 'FunctionsHttpError', context: new Response(body === undefined ? 'Not found' : JSON.stringify(body), { status }) },
});

describe('invokeFunction (Edge Functions)', () => {
  it('returns the data on success', async () => {
    const calls: unknown[] = [];
    const data = await invokeFunction(client(async (name, opts) => (calls.push([name, opts]), { data: { orderId: 'order_X' }, error: null })), 'razorpay-create-order', { amount: 1 });
    expect(data).toEqual({ orderId: 'order_X' });
    expect(calls).toEqual([['razorpay-create-order', { body: { amount: 1 } }]]);
  });

  it('treats a missing, unconfigured or unreachable function as "being set up"', async () => {
    for (const fake of [
      async () => httpError(404),
      async () => httpError(503, { error: 'Payments are not fully set up yet.' }),
      async () => httpError(502),
      async () => ({ data: null, error: { name: 'FunctionsFetchError', context: new TypeError('Failed to fetch') } }),
      async () => { throw new TypeError('Failed to fetch'); },
    ] as Invoke[]) {
      await expectAsync(invokeFunction(client(fake), 'razorpay-create-order', {})).toBeRejectedWith(jasmine.any(PaymentsUnavailable));
    }
  });

  it('gives up after a timeout', async () => {
    const never: Invoke = () => new Promise(() => undefined);
    await expectAsync(invokeFunction(client(never), 'razorpay-verify', {}, 20)).toBeRejectedWith(jasmine.any(PaymentsUnavailable));
  });

  it('passes the server message through for input problems', async () => {
    const p = invokeFunction(client(async () => httpError(400, { error: 'Enter a whole amount between ₹1 and ₹1,00,000.' })), 'razorpay-create-order', {});
    await expectAsync(p).toBeRejectedWithError('Enter a whole amount between ₹1 and ₹1,00,000.');
    await expectAsync(p).not.toBeRejectedWith(jasmine.any(PaymentsUnavailable));
  });
});

describe('DemoPaymentGateway', () => {
  let gateway: DemoPaymentGateway;
  let repo: LocalStorageWeddingRepository;
  const clear = () => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem('sg.demoOrders');
    localStorage.removeItem('sg.payout.w1');
  };

  beforeEach(async () => {
    clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), { provide: WeddingRepository, useClass: LocalStorageWeddingRepository }] });
    repo = TestBed.inject(WeddingRepository) as LocalStorageWeddingRepository;
    gateway = TestBed.runInInjectionContext(() => new DemoPaymentGateway());
    await repo.saveWedding(wedding({ paymentMode: 'razorpay', feeBearer: 'guest' }));
  });
  afterEach(clear);

  const req = { goalId: 'g1', amount: 2100, guestName: 'Meera', message: 'Bless you' };

  it('creates a simulated test-mode order with the convenience fee', async () => {
    const order = await gateway.createOrder(wedding({ feeBearer: 'guest' }), req);
    expect(order).toEqual(jasmine.objectContaining({ simulated: true, testMode: true, amount: 2100, amountPaise: 215076, convenienceFee: 50.76, total: 2150.76 }));
    expect(order.orderId).toMatch(/^order_DEMO/);
  });

  it('records a signed payment as paid exactly once', async () => {
    const w = wedding({ feeBearer: 'guest' });
    const order = await gateway.createOrder(w, req);
    const response = await signDemoPayment(order.orderId);
    expect(await gateway.verify(w, order, response, req)).toBe('paid');
    expect(await gateway.verify(w, order, response, req)).toBe('paid');
    const saved = await repo.listContributions('w1');
    expect(saved.length).toBe(1);
    expect(saved[0]).toEqual(jasmine.objectContaining({ status: 'paid', provider: 'razorpay', razorpayPaymentId: response.razorpay_payment_id, chargedAmount: 2150.76, guestFee: 50.76 }));
    expect(await gateway.orderStatus(w, order.orderId)).toBe('paid');
    const wall = (await repo.getPublicActivity('w1')).wall;
    expect(wall[0].paid).toBeTrue();
  });

  it('rejects a tampered signature', async () => {
    const w = wedding();
    const order = await gateway.createOrder(w, req);
    const response = { ...(await signDemoPayment(order.orderId)), razorpay_signature: 'a'.repeat(64) };
    expect(await gateway.verify(w, order, response, req)).toBe('failed');
    expect((await repo.listContributions('w1')).length).toBe(0);
  });

  it('stores payout details masked, then simulates approval', async () => {
    const w = wedding();
    const p = await gateway.savePayout(w, {
      legalName: 'Asha Rao', email: 'asha@example.com', phone: '9876543210', pan: 'ABCDE1234F', accountNumber: '123456789012',
      ifsc: 'HDFC0001234', beneficiaryName: 'Asha Rao', street: '1 Marine Drive', city: 'Mumbai', state: 'MAHARASHTRA', postalCode: '400001',
    });
    expect(p).toEqual(jasmine.objectContaining({ status: 'under_review', bankLast4: '9012', panLast4: '234F' }));
    expect(localStorage.getItem('sg.payout.w1')).not.toContain('123456789012');
    expect(localStorage.getItem('sg.payout.w1')).not.toContain('ABCDE1234F');
    expect((await gateway.simulateApproval(w)).status).toBe('active');
    expect((await repo.getWeddingBySlug('asha-weds-dev'))?.razorpayActive).toBeTrue();
  });
});
