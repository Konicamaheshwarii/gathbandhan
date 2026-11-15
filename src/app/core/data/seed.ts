import { defaultInvite } from '../invite';
import { Contribution, Guest, Rsvp, Side, Wedding } from '../models';

/** Bump to re-seed browsers that already have an older copy of the sample. */
export const DEMO_SEED_VERSION = 5;
export const DEMO_SLUG = 'riya-weds-arjun';
export const DEMO_ID = 'w-demo';
const HOUR = 3_600_000;

function isoDaysFromNow(days: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The sample wedding is always about four weeks away, so the page never looks stale. */
export function demoWedding(now = new Date()): Wedding {
  const w = baseDemoWedding(now);
  w.invite = {
    ...defaultInvite(w, 'rajasthani', 'english', 'traditional'),
    showShlok: true,
    grandparents: { bride: 'Smt. Kamla Devi & Late Shri Hariprasad Sharma', groom: 'Smt. Shanti & Shri Mohanlal Mehta' },
    swagatotsuk: 'Rohan & Ishita Sharma\nKabir, Myra & all the little cousins\nMama-Mami: Sanjay & Ritu Joshi',
    darshanabhilashi: 'Sharma & Mehta Parivar\nAll our friends from Pune and Bengaluru',
    coverPhoto: 'demo/gallery-3.svg',
    updatedAt: now.getTime() - 5 * 24 * HOUR,
  };
  return w;
}

function baseDemoWedding(now: Date): Wedding {
  const day = (offset: number) => isoDaysFromNow(26 + offset, now);
  const palace = 'Jagmandir Island Palace';
  const palaceAddress = 'Lake Pichola, Udaipur, Rajasthan 313001';
  return {
    id: DEMO_ID,
    slug: DEMO_SLUG,
    partner1: 'Riya Sharma',
    partner2: 'Arjun Mehta',
    date: day(0),
    venue: palace,
    city: 'Udaipur',
    cover: { preset: 'marigold' },
    story:
      'We met in a delayed Pune–Delhi train in 2019, arguing over the last cup of chai. Six years, two cities and ' +
      'one very patient set of parents later, we are finally making it official.\n\n' +
      'We already have more steel tumblers than any couple needs, so instead of gifts we would love your shagun ' +
      'towards the dreams we are starting our life with. Every rupee goes straight to us by UPI, and every blessing ' +
      'goes on our wall.',
    families: {
      bride: 'Mrs. Sunita & Mr. Rakesh Sharma',
      groom: 'Mrs. Kavita & Mr. Anil Mehta',
    },
    events: [
      { id: 'e-haldi', kind: 'haldi', name: 'Haldi', date: day(-2), time: '10:00', endTime: '13:00', venue: 'Lakeside lawns, Taj Fateh Prakash', address: 'City Palace Complex, Udaipur 313001', mapsUrl: 'https://maps.google.com/?q=Fateh+Prakash+Palace+Udaipur', dressCode: 'Yellow, and clothes you do not mind ruining' },
      { id: 'e-mehndi', kind: 'mehndi', name: 'Mehndi', date: day(-2), time: '16:00', endTime: '20:00', venue: 'Courtyard, Taj Fateh Prakash', address: 'City Palace Complex, Udaipur 313001', mapsUrl: 'https://maps.google.com/?q=Fateh+Prakash+Palace+Udaipur', dressCode: 'Greens and florals' },
      { id: 'e-sangeet', kind: 'sangeet', name: 'Sangeet', date: day(-1), time: '19:30', endTime: '01:00', venue: 'Durbar Hall', address: 'City Palace Complex, Udaipur 313001', mapsUrl: 'https://maps.google.com/?q=Durbar+Hall+Udaipur', dressCode: 'Indo-western, bring your dancing shoes' },
      { id: 'e-wedding', kind: 'wedding', name: 'Wedding & pheras', date: day(0), time: '18:00', endTime: '23:30', venue: palace, address: palaceAddress, mapsUrl: 'https://maps.google.com/?q=Jagmandir+Island+Palace+Udaipur', dressCode: 'Traditional. Boats leave Bansi Ghat every 15 minutes from 5 pm.' },
      { id: 'e-reception', kind: 'reception', name: 'Reception', date: day(1), time: '20:00', endTime: '23:30', venue: 'The Oberoi Udaivilas', address: 'Haridasji Ki Magri, Udaipur 313001', mapsUrl: 'https://maps.google.com/?q=Oberoi+Udaivilas', dressCode: 'Black tie or your finest saree' },
    ],
    milestones: [
      { id: 'm-1', when: 'March 2019', title: 'The last cup of chai', emoji: '☕', text: 'A Pune–Delhi train, eleven hours late, and one cup of chai left. Arjun gave it up. Riya pretended not to be impressed.' },
      { id: 'm-2', when: '2020–2022', title: 'Two cities, one video call', emoji: '📱', text: 'Riya in Pune, Arjun in Bengaluru. We watched the same films at the same time and argued about the endings.' },
      { id: 'm-3', when: 'Diwali 2024', title: 'The proposal', emoji: '💍', text: 'On Nani’s terrace in Bhilwara, between the diyas. Arjun forgot the speech; the ring did the talking.' },
      { id: 'm-4', when: 'February 2025', title: 'Roka with both families', emoji: '🌼', text: 'Two families, one very long lunch, and the first time our mothers agreed on everything.' },
    ],
    gallery: [
      { id: 'p-1', url: 'demo/gallery-1.svg', caption: 'Udaipur, where it all comes together' },
      { id: 'p-2', url: 'demo/gallery-2.svg', caption: 'The train, the chai, the beginning' },
      { id: 'p-3', url: 'demo/gallery-3.svg', caption: 'Diwali proposal on Nani’s terrace' },
      { id: 'p-4', url: 'demo/gallery-4.svg', caption: 'Roka day' },
    ],
    goals: [
      {
        id: 'g-honeymoon', title: 'Honeymoon in Santorini & Amalfi', target: 300_000, emoji: '🌍', imageUrl: 'demo/goal-honeymoon.svg',
        description: 'Ten days of blue domes, lemon groves and absolutely no wedding planning.',
        updates: [{ id: 'u-1', text: 'Flights booked! Mumbai → Athens on the 3rd. Thank you for getting us halfway there already.', imageUrl: 'demo/update-flight.svg', createdAt: now.getTime() - 30 * HOUR }],
      },
      { id: 'g-home', title: 'Down payment on our first home', target: 1_000_000, emoji: '🏡', imageUrl: 'demo/goal-home.svg', description: 'A 2BHK in Pune with a balcony big enough for Dadi’s tulsi plant.' },
      { id: 'g-kyoto', title: 'Cherry blossoms in Kyoto', target: 200_000, emoji: '🌸', imageUrl: 'demo/goal-kyoto.svg', description: 'Our first-anniversary trip, booked for sakura season.' },
      {
        id: 'g-trees', title: '101 trees in Nani’s village', target: 18_000, emoji: '🌳', imageUrl: 'demo/goal-trees.svg',
        description: 'Planted in Bhilwara with a local NGO, one for every guest table.',
        updates: [{ id: 'u-2', text: 'Fully funded in four days! Planting starts with the monsoon. Every guest gets a photo of their tree.', createdAt: now.getTime() - 60 * HOUR }],
      },
    ],
    upiId: 'riya.arjun@demo',
    payeeName: 'Riya Sharma',
    showAmounts: false,
    createdAt: now.getTime() - 20 * 24 * HOUR,
    demo: true,
  };
}

type Row = [string, string, number, string, number, 'v' | 'g', Side | '', string?];

const ROWS: Row[] = [
  ['Nana & Nani', 'g-home', 51_000, 'Hamesha khush raho, dono. Ghar mein hamesha hansi gunje.', 410, 'v', 'bride', '9810012345'],
  ['Sunita Mausi', 'g-honeymoon', 21_000, 'Santorini ki photos sabse pehle mujhe bhejna! Dher saara pyaar ❤️', 300, 'v', 'bride', '9822012345'],
  ['Rajesh Chacha & family', 'g-home', 21_000, 'सदा सुखी रहो। नए घर में ढेर सारी खुशियाँ आएं।', 260, 'v', 'groom'],
  ['Priya & Karan', 'g-honeymoon', 11_000, 'From one train-meet couple to another: the chai was clearly worth it.', 200, 'v', 'bride', '9765012345'],
  ['Neha (roomie from Fergusson)', 'g-kyoto', 2_100, 'Riya, you promised me matcha KitKats. I am holding you to it.', 170, 'v', 'bride'],
  ['The Iyers, B-204', 'g-trees', 5_001, 'Wonderful idea. May your marriage grow as strong as these trees.', 150, 'v', 'groom'],
  ['Vikram Bhaiya', 'g-honeymoon', 21_000, 'Arjun, finally someone who can tolerate your jokes. Enjoy Amalfi, both of you!', 120, 'v', 'groom', '9899012345'],
  ['Ananya Kapoor', 'g-kyoto', 1_100, 'Wishing you a lifetime of sakura seasons 🌸', 96, 'v', 'bride'],
  ['Team Data Platform, Thoughtworks', 'g-honeymoon', 31_000, 'Congratulations from all 14 of us! Please do not check Slack on your honeymoon.', 80, 'v', 'groom'],
  ['Dadi', 'g-trees', 11_000, 'जुग जुग जियो मेरे बच्चों। पेड़ों की तरह फलो-फूलो।', 72, 'v', 'groom'],
  ['Meera & Rohit Joshi', 'g-home', 11_000, 'May your home always have room for one more guest (us).', 50, 'g', 'bride', '9811112345'],
  ['Kabir Malhotra', 'g-honeymoon', 2_100, 'Have the best time! Eat all the pasta.', 30, 'g', ''],
  ['Dr. Shalini Rao', 'g-trees', 2_500, 'Such a thoughtful wish. Blessings to you both.', 22, 'v', 'bride'],
  ['Arjun’s cricket gang', 'g-honeymoon', 11_000, 'Bhai ki shaadi mein naachenge poori raat! Shagun from the whole team 🏏', 9, 'g', 'groom', '9876512345'],
  ['Pooja Bua', 'g-kyoto', 5_100, 'Bahut bahut badhai ho! Khoob ghoomo.', 4, 'g', 'groom'],
  ['Farhan & Zoya', 'g-trees', 1_100, 'Mubarak ho! Planting one in your name in Lucknow too.', 2, 'g', 'bride'],
];

export function demoContributions(w: Wedding, now = Date.now()): Contribution[] {
  return ROWS.map(([guestName, goalId, amount, message, hoursAgo, status, side, phone], i) => ({
    id: `c-demo-${i + 1}`,
    weddingId: w.id,
    goalId,
    guestName,
    amount,
    message,
    phone: phone ? `91${phone}` : undefined,
    ...(side ? { side } : {}),
    createdAt: now - hoursAgo * HOUR,
    status: status === 'v' ? 'verified' : 'guest-confirmed',
    thankedAt: i < 4 ? now - (hoursAgo - 20) * HOUR : undefined,
  }));
}

type RsvpRow = [string, Side, number, string[], string, number, string?];
const ALL = ['e-haldi', 'e-mehndi', 'e-sangeet', 'e-wedding', 'e-reception'];

const RSVPS: RsvpRow[] = [
  ['Nana & Nani', 'bride', 2, ALL, 'We are coming a day early to help!', 400, '9810012345'],
  ['Sunita Mausi', 'bride', 4, ALL, 'Mehndi ke liye main khud aaungi pehle.', 290, '9822012345'],
  ['Rajesh Chacha & family', 'groom', 5, ['e-sangeet', 'e-wedding', 'e-reception'], '', 250],
  ['Priya & Karan', 'bride', 2, ['e-sangeet', 'e-wedding'], 'Practising our sangeet step already.', 190],
  ['Vikram Bhaiya', 'groom', 3, ALL, '', 118, '9899012345'],
  ['Team Data Platform', 'groom', 9, ['e-reception'], 'Fourteen of us, nine can travel. Reception for sure!', 78],
  ['Dadi', 'groom', 1, ['e-haldi', 'e-wedding'], 'Need a seat near the mandap please.', 70],
  ['Meera & Rohit Joshi', 'bride', 2, ['e-wedding', 'e-reception'], '', 48, '9811112345'],
  ['Neha (roomie)', 'bride', 1, ['e-mehndi', 'e-sangeet', 'e-wedding'], 'Vegetarian, and I need a mehndi slot first!', 26],
  ['Pooja Bua', 'groom', 3, ['e-haldi', 'e-mehndi', 'e-wedding'], '', 5],
];

export function demoRsvps(w: Wedding, now = Date.now()): Rsvp[] {
  return RSVPS.map(([guestName, side, partySize, eventIds, note, hoursAgo, phone], i) => ({
    id: `r-demo-${i + 1}`,
    weddingId: w.id,
    guestName,
    side,
    partySize,
    eventIds,
    note,
    ...(phone ? { phone: `91${phone}` } : {}),
    createdAt: now - hoursAgo * HOUR,
  }));
}

type GuestRow = [string, string, Side, string, string?, ('sent' | 'opened' | 'rsvp' | 'gave' | '')?];

/** 25 guests at every stage, so the invite tracker looks like a real week before the wedding. */
const GUESTS: GuestRow[] = [
  ['Nana & Nani', 'Nana-Nani', 'bride', 'Family', '9810012345', 'gave'],
  ['Sunita Mausi', 'Sunita Mausi & family', 'bride', "Mummy's side", '9822012345', 'gave'],
  ['Rajesh Chacha', 'Rajesh Chacha & family', 'groom', "Papa's side", '9811012345', 'gave'],
  ['Priya & Karan', '', 'bride', 'College friends', '9765012345', 'gave'],
  ['Vikram Bhaiya', '', 'groom', 'Cousins', '9899012345', 'gave'],
  ['Dadi', '', 'groom', 'Family', '9811112340', 'rsvp'],
  ['Meera & Rohit Joshi', 'Joshi Parivar', 'bride', 'Neighbours', '9811112345', 'gave'],
  ['Neha Kulkarni', '', 'bride', 'College friends', '9822334455', 'rsvp'],
  ['Pooja Bua', 'Pooja Bua & family', 'groom', "Papa's side", '9876501234', 'gave'],
  ['Sanjay & Ritu Joshi', 'Mama-Mami', 'bride', "Mama's family", '9820098200', 'rsvp'],
  ['Anil Verma', 'Verma Parivar', 'groom', 'Office', '9845012345', 'opened'],
  ['Deepa Iyer', 'The Iyers, B-204', 'groom', 'Neighbours', '9845098450', 'gave'],
  ['Farhan & Zoya', '', 'bride', 'College friends', '9839012345', 'gave'],
  ['Kabir Malhotra', '', 'groom', 'School friends', '9873012345', 'gave'],
  ['Ananya Kapoor', '', 'bride', 'Office', '9818012345', 'gave'],
  ['Dr. Shalini Rao', '', 'bride', 'Family friends', '9822077777', 'gave'],
  ['Gupta Uncle', 'Gupta Parivar', 'groom', 'Family friends', '9811066666', 'opened'],
  ['Ritika & Sameer', '', 'bride', 'Office', '9830012345', 'opened'],
  ['Harsh Bhatt', 'Bhatt Parivar', 'groom', "Papa's side", '9824012345', 'sent'],
  ['Kavya Nair', '', 'bride', 'School friends', '9895012345', 'sent'],
  ['Mohit Chacha', 'Mohit Chacha & family', 'groom', "Papa's side", '9829012345', 'sent'],
  ['Swati Didi', 'Swati Didi & Jiju', 'bride', 'Cousins', '9850012345', ''],
  ['Arora Family', 'Arora Parivar', 'groom', 'Neighbours', '9810077777', ''],
  ['Lakshmi Aunty', '', 'bride', "Mummy's side", '', ''],
  ['Team Data Platform', 'Team Data Platform', 'groom', 'Office', '9886012345', 'opened'],
];

export function demoGuests(w: Wedding, now = Date.now()): Guest[] {
  const order = ['', 'sent', 'opened', 'rsvp', 'gave'];
  return GUESTS.map(([name, greeting, side, group, phone, status = ''], i) => {
    const step = order.indexOf(status);
    const at = (n: number, hours: number) => (step >= n ? now - (hours - i) * HOUR : undefined);
    const g: Guest = { id: `gu-demo-${i + 1}`, weddingId: w.id, name, side, group, token: `demo${String(i + 1).padStart(4, '0')}tk`, createdAt: now - (300 - i) * HOUR };
    if (greeting) g.greeting = greeting;
    if (phone) g.phone = `91${phone}`;
    const sent = at(1, 200), opened = at(2, 150), rsvp = at(3, 120), gave = at(4, 60);
    if (sent) g.sentAt = sent;
    if (opened) g.openedAt = opened;
    if (rsvp) g.rsvpAt = rsvp;
    if (gave) g.gaveAt = gave;
    return g;
  });
}
