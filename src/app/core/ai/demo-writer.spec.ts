import { validateMilestones } from './prompts';
import { DemoProvider } from '../llm/demo.provider';
import { goalsRequest, storyRequest, thanksRequest, validateGoals } from './prompts';
import { coupleFirstNames, demoGoals, demoStory, demoThanks, meetingClause, demoMilestones } from './demo-writer';
import { StoryInput, ThanksInput } from './ai.models';

const story = (patch: Partial<StoryInput> = {}): StoryInput => ({
  partner1: 'Riya Sharma', partner2: 'Arjun Mehta', howWeMet: 'we met on a train', details: '', tone: 'warm', language: 'english', ...patch,
});
const thanks = (patch: Partial<ThanksInput> = {}): ThanksInput => ({
  couple: 'Riya Sharma & Arjun Mehta', guestName: 'Sunita Mausi', amount: 5100, goalTitle: 'Honeymoon', message: 'Khush raho', language: 'english', mentionAmount: false, ...patch,
});

describe('demo writer: story', () => {
  it('turns how-we-met into a clause that reads after "we"', () => {
    expect(meetingClause('We met on a train.')).toBe('met on a train');
    expect(meetingClause('on a train')).toBe('met on a train');
    expect(meetingClause('first met at college')).toBe('met at college');
    expect(meetingClause('were neighbours in Indore')).toBe('were neighbours in Indore');
    expect(meetingClause('  ')).toBe('');
  });

  it('writes two paragraphs that frame shagun, not fundraising', () => {
    const text = demoStory(story({ details: 'we love dosa' }));
    const [first, second] = text.split('\n\n');
    expect(first).toContain('We met on a train');
    expect(first).toContain('We love dosa.');
    expect(second).toContain('shagun');
    expect(text).not.toMatch(/donat|fundrais/i);
  });

  it('supports every tone and language', () => {
    expect(demoStory(story({ tone: 'playful' }))).toContain('Plot summary');
    expect(demoStory(story({ tone: 'poetic', howWeMet: '' }))).toContain('diya');
    expect(demoStory(story({ language: 'hindi' }))).toMatch(/[ऀ-ॿ]/);
    expect(demoStory(story({ language: 'hinglish' }))).toContain('shagun de sakte hain');
  });
});

describe('demo writer: goals', () => {
  it('maps plans to goals with realistic targets', () => {
    const { goals } = demoGoals({ plans: 'Honeymoon in Japan, a flat in Pune and a dog', city: 'Pune', guests: 200, averageShagun: 2100 });
    expect(goals.map((g) => g.emoji)).toEqual(['🗾', '🏡', '🐶']);
    expect(goals[0].title).toBe('Honeymoon in Japan');
    expect(goals[1].target).toBe(15_00_000);
  });

  it('fills in sensible defaults when plans are vague', () => {
    const { goals } = demoGoals({ plans: '', city: '', guests: 100, averageShagun: 1100 });
    expect(goals.length).toBe(3);
  });

  it('compares the total with what the guest list can give', () => {
    expect(demoGoals({ plans: 'kerala trip', city: 'Kochi', guests: 300, averageShagun: 2100 }).tip).toContain('enough');
    expect(demoGoals({ plans: 'house in Mumbai, europe', city: 'Mumbai', guests: 50, averageShagun: 1100 }).tip).toContain('well beyond');
    expect(demoGoals({ plans: 'europe', city: '', guests: 0, averageShagun: 0 }).tip).toContain('guest count');
  });

  it('produces output that passes the same validation as a model reply', () => {
    const out = demoGoals({ plans: 'maldives, car, mba', city: '', guests: 200, averageShagun: 2000 });
    expect(validateGoals(JSON.parse(JSON.stringify(out))).goals.length).toBe(out.goals.length);
  });
});

describe('demo writer: thank-you notes', () => {
  it('addresses the guest and signs with first names', () => {
    const note = demoThanks(thanks());
    expect(note).toContain('Sunita Mausi');
    expect(note).toContain('"Honeymoon"');
    expect(note.trim().endsWith('Riya & Arjun')).toBeTrue();
    expect(note).not.toContain('₹');
  });

  it('mentions the amount only when asked', () => {
    expect(demoThanks(thanks({ mentionAmount: true }))).toContain('₹5,100');
    expect(demoThanks(thanks({ mentionAmount: true, language: 'hindi' }))).toContain('₹5,100');
  });

  it('writes Hindi and Hinglish', () => {
    expect(demoThanks(thanks({ language: 'hindi' }))).toMatch(/धन्यवाद/);
    expect(demoThanks(thanks({ language: 'hinglish' }))).toMatch(/shagun/);
  });

  it('is deterministic for the same guest', () => {
    expect(demoThanks(thanks())).toBe(demoThanks(thanks()));
  });

  it('shortens the couple to first names', () => {
    expect(coupleFirstNames('Riya Sharma & Arjun Mehta')).toBe('Riya & Arjun');
  });
});

describe('DemoProvider', () => {
  const provider = new DemoProvider(0);

  it('answers every task offline', async () => {
    const goals = JSON.parse(await provider.complete(goalsRequest({ plans: 'bali', city: '', guests: 10, averageShagun: 1000 })));
    expect(goals.goals[0].emoji).toBe('🌴');
    expect(await provider.complete(thanksRequest(thanks()))).toContain('Sunita');
  });

  it('streams the story word by word', async () => {
    const chunks: string[] = [];
    for await (const c of provider.stream(storyRequest(story()))) chunks.push(c);
    expect(chunks.length).toBeGreaterThan(10);
    expect(chunks.join('')).toBe(demoStory(story()));
  });
});

describe('demoMilestones', () => {
  const input = { partner1: 'Riya Sharma', partner2: 'Arjun Mehta', howWeMet: 'on a delayed train in 2019', details: 'Long distance Pune–Bengaluru in 2021. Proposed on Diwali 2024 on the terrace.', language: 'english' as const };

  it('goes from how they met, through their moments, to the wedding', () => {
    const list = demoMilestones(input);
    expect(list[0]).toEqual(jasmine.objectContaining({ when: '2019', title: 'How we met' }));
    expect(list[0].text).toContain('met on a delayed train');
    expect(list.map((m) => m.title)).toContain('The proposal');
    expect(list.find((m) => m.title === 'The proposal')!.when).toBe('2024');
    expect(list[list.length - 1].title).toBe('Shubh vivah');
    expect(validateMilestones({ milestones: list }).length).toBe(list.length);
  });

  it('writes Hindi and Hinglish too, and is deterministic', () => {
    expect(demoMilestones({ ...input, language: 'hindi' })[0].title).toBe('पहली मुलाक़ात');
    expect(demoMilestones({ ...input, language: 'hinglish' })[0].text).toContain('Hum met');
    expect(demoMilestones(input)).toEqual(demoMilestones(input));
  });
});

describe('validateMilestones', () => {
  it('drops empty items, fixes emojis and caps the list', () => {
    const raw = { milestones: [{ title: 'A', text: 'x', emoji: 'no' }, { title: '', text: 'y' }, ...Array(9).fill({ title: 'B', text: 'z', emoji: '💍' })] };
    const list = validateMilestones(raw);
    expect(list.length).toBe(6);
    expect(list[0].emoji).toBe('💛');
    expect(() => validateMilestones({})).toThrowError(/timeline/);
  });
});
