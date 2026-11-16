import { expect, test as demoTest } from './fixtures';
import { MockOptions, SupabaseMock } from './support/supabase-mock';

/**
 * Online-mode tests: config.json points at a fake Supabase host that the in-memory mock
 * answers (see support/supabase-mock.ts). The live project, Razorpay and email are never used.
 */
export const test = demoTest.extend<{ mockOptions: MockOptions; supa: SupabaseMock }>({
  mockOptions: [{}, { option: true }],
  backendMode: true,
  supa: async ({ context, net, mockOptions }, use) => {
    void net; // the network guard is installed first, so the mock's routes take precedence
    const mock = new SupabaseMock(mockOptions);
    await mock.install(context);
    await use(mock);
    expect(mock.unhandled, 'calls the Supabase mock does not implement').toEqual([]);
  },
  page: async ({ page, supa }, use) => {
    void supa;
    await use(page);
  },
});

export { expect };
