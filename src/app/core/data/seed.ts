import { Contribution, Wedding } from '../models';

/** Bump to re-seed browsers that already have an older copy of the sample. */
export const DEMO_SEED_VERSION = 1;
export const DEMO_SLUG = 'riya-weds-arjun';
const HOUR = 3_600_000;

function isoDaysFromNow(days: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The sample wedding is always about four weeks away, so the page never looks stale. */
export function demoWedding(now = new Date()): Wedding {
  return {
    id: 'w-demo',
    slug: DEMO_SLUG,
    partner1: 'Riya Sharma',
    partner2: 'Arjun Mehta',
    date: isoDaysFromNow(26, now),
    venue: 'Jagmandir Island Palace',
    city: 'Udaipur',
    cover: { preset: 'marigold' },
    story:
      'We met in a delayed Pune–Delhi train in 2019, arguing over the last cup of chai. Six years, two cities and ' +
      'one very patient set of parents later, we are finally making it official.\n\n' +
      'We already have more steel tumblers than any couple needs, so instead of gifts we would love your shagun ' +
      'towards the dreams we are starting our life with. Every rupee goes straight to us by UPI, and every blessing ' +
      'goes on our wall.',
    goals: [
      { id: 'g-honeymoon', title: 'Honeymoon in Santorini & Amalfi', target: 300_000, emoji: '🌍', description: 'Ten days of blue domes, lemon groves and absolutely no wedding planning.' },
      { id: 'g-home', title: 'Down payment on our first home', target: 1_000_000, emoji: '🏡', description: 'A 2BHK in Pune with a balcony big enough for Dadi’s tulsi plant.' },
      { id: 'g-kyoto', title: 'Cherry blossoms in Kyoto', target: 200_000, emoji: '🌸', description: 'Our first-anniversary trip, booked for sakura season.' },
      { id: 'g-trees', title: '101 trees in Nani’s village', target: 18_000, emoji: '🌳', description: 'Planted in Bhilwara with a local NGO, one for every guest table.' },
    ],
    upiId: 'riya.arjun@demo',
    payeeName: 'Riya Sharma',
    showAmounts: false,
    createdAt: now.getTime() - 20 * 24 * HOUR,
    demo: true,
  };
}

type Row = [string, string, number, string, number, 'v' | 'g', string?];

const ROWS: Row[] = [
  ['Nana & Nani', 'g-home', 51_000, 'Hamesha khush raho, dono. Ghar mein hamesha hansi gunje.', 410, 'v', '9810012345'],
  ['Sunita Mausi', 'g-honeymoon', 21_000, 'Santorini ki photos sabse pehle mujhe bhejna! Dher saara pyaar ❤️', 300, 'v', '9822012345'],
  ['Rajesh Chacha & family', 'g-home', 21_000, 'सदा सुखी रहो। नए घर में ढेर सारी खुशियाँ आएं।', 260, 'v'],
  ['Priya & Karan', 'g-honeymoon', 11_000, 'From one train-meet couple to another: the chai was clearly worth it.', 200, 'v', '9765012345'],
  ['Neha (roomie from Fergusson)', 'g-kyoto', 2_100, 'Riya, you promised me matcha KitKats. I am holding you to it.', 170, 'v'],
  ['The Iyers, B-204', 'g-trees', 5_001, 'Wonderful idea. May your marriage grow as strong as these trees.', 150, 'v'],
  ['Vikram Bhaiya', 'g-honeymoon', 21_000, 'Arjun, finally someone who can tolerate your jokes. Enjoy Amalfi, both of you!', 120, 'v', '9899012345'],
  ['Ananya Kapoor', 'g-kyoto', 1_100, 'Wishing you a lifetime of sakura seasons 🌸', 96, 'v'],
  ['Team Data Platform, Thoughtworks', 'g-honeymoon', 31_000, 'Congratulations from all 14 of us! Please do not check Slack on your honeymoon.', 80, 'v'],
  ['Dadi', 'g-trees', 11_000, 'जुग जुग जियो मेरे बच्चों। पेड़ों की तरह फलो-फूलो।', 72, 'v'],
  ['Meera & Rohit Joshi', 'g-home', 11_000, 'May your home always have room for one more guest (us).', 50, 'g', '9811112345'],
  ['Kabir Malhotra', 'g-honeymoon', 2_100, 'Have the best time! Eat all the pasta.', 30, 'g'],
  ['Dr. Shalini Rao', 'g-trees', 2_500, 'Such a thoughtful wish. Blessings to you both.', 22, 'v'],
  ['Arjun’s cricket gang', 'g-honeymoon', 11_000, 'Bhai ki shaadi mein naachenge poori raat! Shagun from the whole team 🏏', 9, 'g', '9876512345'],
  ['Pooja Bua', 'g-kyoto', 5_100, 'Bahut bahut badhai ho! Khoob ghoomo.', 4, 'g'],
  ['Farhan & Zoya', 'g-trees', 1_100, 'Mubarak ho! Planting one in your name in Lucknow too.', 2, 'g'],
];

export function demoContributions(w: Wedding, now = Date.now()): Contribution[] {
  return ROWS.map(([guestName, goalId, amount, message, hoursAgo, status, phone], i) => ({
    id: `c-demo-${i + 1}`,
    weddingId: w.id,
    goalId,
    guestName,
    amount,
    message,
    phone: phone ? `91${phone}` : undefined,
    createdAt: now - hoursAgo * HOUR,
    status: status === 'v' ? 'verified' : 'guest-confirmed',
    thankedAt: i < 4 ? now - (hoursAgo - 20) * HOUR : undefined,
  }));
}
