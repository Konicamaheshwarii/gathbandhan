import { ChromeAiProvider, LanguageModelApi, chromeSupports } from './chrome-ai.provider';
import { DemoProvider } from './demo.provider';
import { LlmChain, Tier, withTimeout } from './llm-chain';
import { LlmError, LlmProvider, LlmRequest } from './llm-provider';
import { POLLINATIONS_TEXT_URL, PollinationsProvider, aiImageUrl, resetPollinationsCooldown } from './pollinations.provider';

const req: LlmRequest = { task: 'thanks', system: 's', prompt: 'p', language: 'english' };

function provider(reply: string | Error | 'hang', chunks?: string[]): LlmProvider & { calls: number } {
  return {
    calls: 0,
    async complete() {
      this.calls++;
      if (reply === 'hang') return new Promise<string>(() => undefined);
      if (reply instanceof Error) throw reply;
      return reply;
    },
    async *stream() {
      if (reply instanceof Error) throw reply;
      for (const c of chunks ?? [String(reply)]) yield c;
    },
  };
}

const tier = (id: Tier['id'], p: LlmProvider, extra: Partial<Tier> = {}): Tier => ({ id, label: id, provider: p, timeoutMs: 50, ...extra });

describe('LlmChain', () => {
  it('uses the first tier that answers', async () => {
    const byo = provider('from key');
    const cloud = provider('from cloud');
    const r = await new LlmChain([tier('byo', byo), tier('cloud', cloud)]).run(req, (t) => t);
    expect(r).toEqual({ value: 'from key', tier: 'byo', skipped: [] });
    expect(cloud.calls).toBe(0);
  });

  it('falls down the chain on errors, timeouts and replies that fail validation', async () => {
    const chain = new LlmChain([
      tier('byo', provider(new LlmError('401 bad key'))),
      tier('chrome', provider('hang')),
      tier('cloud', provider('not json')),
      tier('offline', provider('{"ok":true}')),
    ]);
    const r = await chain.run(req, (t) => JSON.parse(t));
    expect(r.tier).toBe('offline');
    expect(r.value).toEqual({ ok: true });
    expect(r.skipped.map((s) => s.tier)).toEqual(['byo', 'chrome', 'cloud']);
    expect(r.skipped[1].reason).toMatch(/No answer within/);
  });

  it('skips tiers that do not support the language', async () => {
    const chrome = provider('english only');
    const r = await new LlmChain([tier('chrome', chrome, { supports: chromeSupports }), tier('offline', provider('गुजराती'))])
      .run({ ...req, language: 'gujarati' }, (t) => t);
    expect(r.tier).toBe('offline');
    expect(chrome.calls).toBe(0);
  });

  it('stops when the caller aborts instead of trying the next tier', async () => {
    const ctrl = new AbortController();
    const next = provider('late');
    const p = new LlmChain([tier('cloud', provider('hang'), { timeoutMs: 5_000 }), tier('offline', next)]).run(req, (t) => t, ctrl.signal);
    ctrl.abort();
    await expectAsync(p).toBeRejected();
    expect(next.calls).toBe(0);
  });

  it('streams from the first tier that starts, and reports which one', async () => {
    let used = '';
    const chain = new LlmChain([tier('chrome', provider(new Error('no model'))), tier('cloud', provider('x', ['Hello ', 'there']))]);
    let text = '';
    for await (const c of chain.stream(req, undefined, (t) => (used = t))) text += c;
    expect(text).toBe('Hello there');
    expect(used).toBe('cloud');
  });

  it('times out slow work', async () => {
    await expectAsync(withTimeout(10, undefined, () => new Promise(() => undefined))).toBeRejectedWithError(/No answer/);
    expect(await withTimeout(100, undefined, async () => 7)).toBe(7);
  });

  it('always has the offline writer as the last word', async () => {
    const r = await new LlmChain([tier('offline', new DemoProvider(0))]).run(
      { task: 'thanks', system: '', prompt: '', input: { couple: 'Asha & Dev', guestName: 'Zoya', amount: 501, goalTitle: 'Trees', message: '', language: 'english', mentionAmount: false } },
      (t) => t,
    );
    expect(r.value).toContain('Zoya');
  });
});

describe('Chrome built-in AI provider', () => {
  const api = (availability: string, reply = '{"ok":true}', chunks: string[] = []): LanguageModelApi => ({
    availability: async () => availability,
    create: async () => ({
      prompt: async () => reply,
      async *promptStreaming() { for (const c of chunks) yield c; },
      destroy: () => undefined,
    }),
  });

  it('is used only when the model is already downloaded', async () => {
    expect(await new ChromeAiProvider(api('available')).isAvailable()).toBeTrue();
    expect(await new ChromeAiProvider(api('downloadable')).isAvailable()).toBeFalse();
    expect(await new ChromeAiProvider(null).isAvailable()).toBeFalse();
  });

  it('answers prompts and handles cumulative or delta streaming', async () => {
    expect(await new ChromeAiProvider(api('available', 'hi')).complete(req)).toBe('hi');
    for (const chunks of [['Hel', 'lo'], ['Hel', 'Hello']]) {
      let text = '';
      for await (const c of new ChromeAiProvider(api('available', '', chunks)).stream(req)) text += c;
      expect(text).toBe('Hello');
    }
  });

  it('steps aside for Hindi and Gujarati', () => {
    expect(chromeSupports({ ...req, language: 'hindi' })).toBeFalse();
    expect(chromeSupports({ ...req, language: 'hinglish' })).toBeTrue();
  });
});

describe('Pollinations provider', () => {
  beforeEach(() => resetPollinationsCooldown());

  it('posts a keyless chat request and reads the reply', async () => {
    const fetchSpy = jasmine.createSpy('fetch').and.resolveTo(new Response(JSON.stringify({ choices: [{ message: { content: 'Namaste!' } }] })));
    const text = await new PollinationsProvider(fetchSpy).complete({ ...req, json: true });
    expect(text).toBe('Namaste!');
    const [url, init] = fetchSpy.calls.mostRecent().args;
    expect(url).toBe(POLLINATIONS_TEXT_URL);
    const body = JSON.parse(init.body);
    expect(body.private).toBeTrue();
    expect(body.messages[1].content).toBe('p');
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('respects the free tier limit without waiting on the network', async () => {
    let now = 1_000_000;
    const fetchSpy = jasmine.createSpy('fetch').and.callFake(async () => new Response('ok'));
    const p = new PollinationsProvider(fetchSpy, () => now);
    expect(await p.complete(req)).toBe('ok');
    await expectAsync(p.complete(req)).toBeRejectedWithError(/one reply every 45 seconds/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    now += 46_000;
    expect(await p.complete(req)).toBe('ok');
  });

  it('turns outages and limits into errors the chain can step past', async () => {
    const limited = new PollinationsProvider(async () => new Response('{}', { status: 402, headers: { 'Retry-After': '25' } }));
    await expectAsync(limited.complete(req)).toBeRejectedWithError(/busy.*25 s/);
    resetPollinationsCooldown();
    const down = new PollinationsProvider(async () => new Response('nope', { status: 403 }));
    await expectAsync(down.complete(req)).toBeRejectedWithError(/not available here/);
    resetPollinationsCooldown();
    const offline = new PollinationsProvider(async () => { throw new TypeError('Failed to fetch'); });
    await expectAsync(offline.complete(req)).toBeRejectedWithError(/could not be reached/);
  });

  it('builds keyless image URLs', () => {
    expect(aiImageUrl('marigold  toran', 7, 1080, 1920)).toBe('https://image.pollinations.ai/prompt/marigold%20toran?width=1080&height=1920&seed=7&nologo=true&model=flux');
  });
});
