import { feeBreakdown, paiseToRupees } from '../../../../supabase/functions/_shared/razorpay-core';
import { defaultInvite } from '../invite';
import { Contribution, Guest, InviteLanguage, Rsvp, Side, Wedding, WeddingEvent } from '../models';

/**
 * The bundled sample weddings (demo mode, and the sample pages when the backend is on).
 * Everyone here is made up: phone numbers follow the fake 91-90000-… pattern, UPI IDs end in
 * `@demo` so nobody can pay them by mistake, and no real person or company is named.
 * Everything is deterministic (no randomness) so tests and screenshots stay stable.
 */

/** Bump to re-seed browsers that already have an older copy of the samples. */
export const DEMO_SEED_VERSION = 6;
/** The main showcase sample: Riya & Arjun in Udaipur. */
export const DEMO_SLUG = 'riya-weds-arjun';
export const DEMO_ID = 'w-demo';

/** Every sample wedding, the showcase first. */
export const DEMO_SAMPLES = [
  { id: DEMO_ID, slug: DEMO_SLUG },
  { id: 'w-demo-ahd', slug: 'hetal-weds-parth' },
  { id: 'w-demo-blr', slug: 'meenakshi-weds-rohan' },
] as const;
export const DEMO_IDS: readonly string[] = DEMO_SAMPLES.map((s) => s.id);
export const DEMO_SLUGS: readonly string[] = DEMO_SAMPLES.map((s) => s.slug);

/** A bundled sample wedding's id: it lives in this browser, never in the backend. */
export function isDemoId(id: string | null | undefined): boolean {
  return !!id && DEMO_IDS.includes(id);
}

export function isDemoSlug(slug: string | null | undefined): boolean {
  return !!slug && DEMO_SLUGS.includes(slug);
}

const HOUR = 3_600_000;

function isoDaysFromNow(days: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const pad = (n: number, width = 4) => String(n).padStart(width, '0');

// ---------- data shapes ----------

type Status = '-' | 's' | 'o' | 'r' | 'g';
type Lang = '' | 'en' | 'hi' | 'gu' | 'hg';
type SideCode = 'b' | 'g';
/**
 * name, greeting, side, group, tracking status (not sent, sent, opened, RSVP'd, gave),
 * WhatsApp language, party size (0 = no RSVP), functions attended (indexes into the events,
 * '*' for all), RSVP note.
 */
type GuestRow = [string, string, SideCode, string, Status, Lang, number?, string?, string?];
/** guest name, goal index, rupees, blessing ('' for none), hours ago, verified / guest-confirmed / paid by Razorpay, side. */
type GiftRow = [string, number, number, string, number, 'v' | 'g' | 'p', SideCode | ''];

const LANGS: Record<Exclude<Lang, ''>, InviteLanguage> = { en: 'english', hi: 'hindi', gu: 'gujarati', hg: 'hinglish' };
const SIDE: Record<SideCode, Side> = { b: 'bride', g: 'groom' };
const STEPS: Status[] = ['-', 's', 'o', 'r', 'g'];

interface SampleSpec {
  id: string;
  /** Prefix of the row ids: gu-<p>-1, c-<p>-1, r-<p>-1. */
  rowPrefix: string;
  /** Four letters starting each personal-link token (8–24 letters and digits). */
  tokenPrefix: string;
  /** Fake phone numbers: 91 90000 <digit> <4 digits>. */
  phoneDigit: number;
  /** 1-based guest numbers without a phone number. */
  noPhone: number[];
  /** The first N verified or paid blessings (older than a day) already have a thank-you sent. */
  thanked: number;
  guests: GuestRow[];
  gifts: GiftRow[];
  wedding: (now: Date) => Wedding;
}

// ---------- 1. Riya & Arjun, Udaipur (Rajasthani style, English, many Hindi-speaking guests) ----------

function riyaWedding(now: Date): Wedding {
  const day = (offset: number) => isoDaysFromNow(26 + offset, now);
  const palace = 'Jagmandir Island Palace';
  const w: Wedding = {
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
      { id: 'e-wedding', kind: 'wedding', name: 'Wedding & pheras', date: day(0), time: '18:00', endTime: '23:30', venue: palace, address: 'Lake Pichola, Udaipur, Rajasthan 313001', mapsUrl: 'https://maps.google.com/?q=Jagmandir+Island+Palace+Udaipur', dressCode: 'Traditional. Boats leave Bansi Ghat every 15 minutes from 5 pm.' },
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
  w.invite = {
    ...defaultInvite(w, 'rajasthani', 'english', 'traditional'),
    showShlok: true,
    grandparents: { bride: 'Smt. Kamla Devi & Late Shri Hariprasad Sharma', groom: 'Smt. Shanti & Shri Mohanlal Mehta' },
    swagatotsuk: 'Rohan & Ishita Sharma\nKabir, Myra & all the little cousins\nMama-Mami: Sanjay & Ritu Joshi',
    darshanabhilashi: 'Sharma & Mehta Parivar\nAll our friends from Pune and Bengaluru',
    coverPhoto: 'demo/gallery-1.svg',
    updatedAt: now.getTime() - 5 * 24 * HOUR,
  };
  return w;
}

const RIYA_GUESTS: GuestRow[] = [
  ['Nana & Nani', 'Nana-Nani', 'b', 'Family', 'g', 'hi', 2, '*', 'We are coming a day early to help!'],
  ['Sunita Mausi', 'Sunita Mausi & family', 'b', "Mummy's side", 'g', 'hg', 4, '*', 'Mehndi ke liye main khud aaungi pehle.'],
  ['Rajesh Chacha', 'Rajesh Chacha & family', 'g', "Papa's side", 'g', 'hi', 5, '234'],
  ['Priya & Karan', '', 'b', 'College friends', 'g', 'en', 2, '23', 'Practising our sangeet step already.'],
  ['Vikram Bhaiya', '', 'g', 'Cousins', 'g', 'hg', 3, '*'],
  ['Dadi', '', 'g', 'Family', 'r', 'hi', 1, '03', 'Need a seat near the mandap please.'],
  ['Meera & Rohit Joshi', 'Joshi Parivar', 'b', 'Neighbours', 'g', 'en', 2, '34'],
  ['Neha Kulkarni', '', 'b', 'College friends', 'r', 'en', 1, '123', 'Vegetarian, and I need a mehndi slot first!'],
  ['Pooja Bua', 'Pooja Bua & family', 'g', "Papa's side", 'g', 'hi', 3, '013'],
  ['Sanjay & Ritu Joshi', 'Mama-Mami', 'b', "Mama's family", 'r', 'hi', 2, '*', 'Hum haldi se pehle pahunch jaayenge.'],
  ['Anil Verma', 'Verma Parivar', 'g', 'Office', 'o', 'en'],
  ['Deepa Iyer', 'The Iyers, B-204', 'g', 'Neighbours', 'g', 'en', 3, '34'],
  ['Farhan & Zoya', '', 'b', 'College friends', 'g', 'hg', 2, '234'],
  ['Kabir Malhotra', '', 'g', 'School friends', 'g', 'en', 1, '4'],
  ['Ananya Kapoor', '', 'b', 'Office', 'g', 'en', 1, '234'],
  ['Dr. Shalini Rao', '', 'b', 'Family friends', 'g', 'en', 2, '3'],
  ['Gupta Uncle', 'Gupta Parivar', 'g', 'Family friends', 'o', 'hi'],
  ['Ritika & Sameer', '', 'b', 'Office', 'o', 'en'],
  ['Harsh Bhatt', 'Bhatt Parivar', 'g', "Papa's side", 's', 'gu'],
  ['Kavya Nair', '', 'b', 'School friends', 's', 'en'],
  ['Mohit Chacha', 'Mohit Chacha & family', 'g', "Papa's side", 's', 'hi'],
  ['Swati Didi', 'Swati Didi & Jiju', 'b', 'Cousins', '-', 'hg'],
  ['Arora Family', 'Arora Parivar', 'g', 'Neighbours', '-', 'hi'],
  ['Lakshmi Aunty', '', 'b', "Mummy's side", '-', ''],
  ['Team Data Platform', 'Team Data Platform', 'g', 'Office', 'g', 'en', 8, '4', 'Fourteen of us, eight can travel. Reception for sure!'],
  ['Bhavna Masi', 'Bhavna Masi & Mausaji', 'b', "Mummy's side", 'g', 'hi', 3, '*', 'Sangeet mein hum bhi naachenge!'],
  ['Raghav & Tanvi', '', 'g', 'College friends', 'g', 'hg', 2, '234'],
  ['Col. Prakash Mehta (retd.)', 'Mehta Parivar', 'g', "Papa's side", 'r', 'en', 2, '34', 'Please keep two parking spots near the ghat.'],
  ['Sushila Nani', '', 'g', 'Family', 'r', 'hi', 1, '03', 'मुझे व्हीलचेयर की ज़रूरत होगी।'],
  ['Aditya Rathore', '', 'g', 'School friends', 'r', 'hg', 1, '234', 'Bachelor party kab hai?'],
  ['Ishaan & Mitali', '', 'b', 'Office', 'r', 'en', 2, '34'],
  ['Kamla Bua', 'Kamla Bua & family', 'b', "Bua's family", 'o', 'hi'],
  ['Varun Saxena', 'Saxena Parivar', 'g', 'Office', 'o', 'en'],
  ['Dr. Nikhil Joshi', '', 'b', 'Family friends', 'o', 'en'],
  ['Rukmini Devi', '', 'b', 'Neighbours', 'o', 'hi'],
  ['Sneha & Pratik', '', 'b', 'College friends', 's', 'en'],
  ['Mahesh Mama', 'Mahesh Mama & Mami', 'g', "Mama's family", 's', 'hi'],
  ['Tarun Agarwal', 'Agarwal Parivar', 'g', 'Family friends', 's', 'hi'],
  ['Jasleen Kaur', '', 'b', 'Office', 's', 'hg'],
  ['Pandit Ramesh Shastri ji', '', 'g', 'Family friends', 's', 'hi'],
  ['Nisha Didi', 'Nisha Didi & Jiju', 'g', 'Cousins', '-', 'hg'],
  ['Rohit Bhaiya', '', 'b', 'Cousins', '-', 'en'],
  ['Chopra Family', 'Chopra Parivar', 'b', 'Neighbours', '-', 'hi'],
  ['Yash & Ankita', '', 'g', 'School friends', '-', 'en'],
  ['Madhuri Aunty', '', 'b', "Mummy's side", 'g', 'hi', 2, '13'],
  ['Gaurav Bhaiya', 'Gaurav Bhaiya & Bhabhi', 'g', 'Cousins', 'g', 'hg', 4, '*', 'Haldi ki zimmedari humari!'],
  ['Sunaina Iyer', '', 'b', 'School friends', 'g', 'en', 1, '234'],
  ['Shekhawat Uncle', 'Shekhawat Parivar', 'g', 'Family friends', 'r', 'hi', 4, '34'],
  ['Pallavi & Kunal', '', 'b', 'College friends', 'o', 'en'],
  ['Mr. & Mrs. Banerjee', 'Banerjee Parivar', 'g', 'Neighbours', 's', 'en'],
  ['Dhruv Menon', '', 'g', 'Office', '-', 'en'],
  ['Manju Masi', 'Manju Masi & family', 'b', "Mummy's side", 'o', 'hi'],
];

const RIYA_GIFTS: GiftRow[] = [
  ['Nana & Nani', 1, 51_000, 'Hamesha khush raho, dono. Ghar mein hamesha hansi gunje.', 410, 'v', 'b'],
  ['Sunita Mausi', 0, 21_000, 'Santorini ki photos sabse pehle mujhe bhejna! Dher saara pyaar ❤️', 300, 'v', 'b'],
  ['Rajesh Chacha & family', 1, 21_000, 'सदा सुखी रहो। नए घर में ढेर सारी खुशियाँ आएं।', 260, 'v', 'g'],
  ['Priya & Karan', 0, 11_000, 'From one train-meet couple to another: the chai was clearly worth it.', 200, 'v', 'b'],
  ['Neha (roomie from the hostel)', 2, 2_100, 'Riya, you promised me matcha KitKats. I am holding you to it.', 170, 'v', 'b'],
  ['The Iyers, B-204', 3, 5_001, 'Wonderful idea. May your marriage grow as strong as these trees.', 150, 'v', 'g'],
  ['Vikram Bhaiya', 0, 21_000, 'Arjun, finally someone who can tolerate your jokes. Enjoy Amalfi, both of you!', 120, 'p', 'g'],
  ['Ananya Kapoor', 2, 1_100, 'Wishing you a lifetime of sakura seasons 🌸', 96, 'v', 'b'],
  ['Team Data Platform, Nimbus Labs', 0, 31_000, 'Congratulations from all 14 of us! Please do not check Slack on your honeymoon.', 80, 'p', 'g'],
  ['Dadi', 3, 11_000, 'जुग जुग जियो मेरे बच्चों। पेड़ों की तरह फलो-फूलो।', 72, 'v', 'g'],
  ['Meera & Rohit Joshi', 1, 11_000, 'May your home always have room for one more guest (us).', 50, 'g', 'b'],
  ['Kabir Malhotra', 0, 2_100, 'Have the best time! Eat all the pasta.', 30, 'g', ''],
  ['Dr. Shalini Rao', 3, 2_500, 'Such a thoughtful wish. Blessings to you both.', 22, 'v', 'b'],
  ['Arjun’s cricket gang', 0, 11_000, 'Bhai ki shaadi mein naachenge poori raat! Shagun from the whole team 🏏', 9, 'g', 'g'],
  ['Pooja Bua', 2, 5_100, 'Bahut bahut badhai ho! Khoob ghoomo.', 4, 'g', 'g'],
  ['Farhan & Zoya', 3, 1_100, 'Mubarak ho! Planting one in your name in Lucknow too.', 2, 'g', 'b'],
  ['Bhavna Masi & Mausaji', 1, 11_000, 'घर की नींव प्यार से रखना। ढेर सारा आशीर्वाद।', 140, 'p', 'b'],
  ['Raghav & Tanvi', 0, 5_100, 'Amalfi mein ek limoncello humare naam ka!', 110, 'p', 'g'],
  ['Madhuri Aunty', 3, 2_100, '', 90, 'v', 'b'],
  ['Gaurav Bhaiya & Bhabhi', 0, 11_000, 'Shaadi mubarak chhote! Honeymoon pe phone band rakhna.', 40, 'p', 'g'],
  ['Sunaina Iyer', 2, 1_100, '', 18, 'g', 'b'],
  ['Office canteen gang', 3, 1_101, 'Ek ped humari taraf se bhi 🌱', 12, 'p', ''],
  ['Sharma ji (upstairs)', 1, 2_100, '', 6, 'g', 'b'],
];

// ---------- 2. Hetal & Parth, Ahmedabad (Gujarati kankotri, in Gujarati) ----------

function hetalWedding(now: Date): Wedding {
  const day = (offset: number) => isoDaysFromNow(40 + offset, now);
  const plot = 'Shubh Aangan Party Plot';
  const plotAddress = 'Near Sindhu Bhavan Road, Bodakdev, Ahmedabad 380054';
  const home = 'Patel Niwas, Navrangpura';
  const homeAddress = '14 Shantikunj Society, Navrangpura, Ahmedabad 380009';
  const homeMap = 'https://maps.google.com/?q=Navrangpura+Ahmedabad';
  const plotMap = 'https://maps.google.com/?q=Bodakdev+Ahmedabad';
  const events: WeddingEvent[] = [
    { id: 'e-ahd-mandvo', kind: 'custom', name: 'Ganesh Sthapana & Mandvo', date: day(-3), time: '09:00', endTime: '12:00', venue: home, address: homeAddress, mapsUrl: homeMap, dressCode: 'Traditional, family only' },
    { id: 'e-ahd-pithi', kind: 'haldi', name: 'Pithi', date: day(-2), time: '10:00', endTime: '13:00', venue: `${home} courtyard`, address: homeAddress, mapsUrl: homeMap, dressCode: 'Yellow or white, nothing you love too much' },
    { id: 'e-ahd-mehndi', kind: 'mehndi', name: 'Mehndi', date: day(-2), time: '16:00', endTime: '20:00', venue: `${home} terrace`, address: homeAddress, mapsUrl: homeMap, dressCode: 'Greens and bandhani' },
    { id: 'e-ahd-dandiya', kind: 'sangeet', name: 'Dandiya Raas', date: day(-1), time: '20:00', endTime: '00:30', venue: plot, address: plotAddress, mapsUrl: plotMap, dressCode: 'Chaniya choli and kediyu. Dandiya sticks provided!' },
    { id: 'e-ahd-pheras', kind: 'wedding', name: 'Hast Melap & Pheras', date: day(0), time: '17:30', endTime: '22:00', venue: plot, address: plotAddress, mapsUrl: plotMap, dressCode: 'Panetar, gharchola and sherwani welcome' },
    { id: 'e-ahd-reception', kind: 'reception', name: 'Reception', date: day(1), time: '19:30', endTime: '23:00', venue: 'Sabarmati Grand Banquets', address: 'Ashram Road, Ahmedabad 380009', mapsUrl: 'https://maps.google.com/?q=Ashram+Road+Ahmedabad', dressCode: 'Festive formal' },
  ];
  const w: Wedding = {
    id: 'w-demo-ahd',
    slug: 'hetal-weds-parth',
    partner1: 'Hetal Patel',
    partner2: 'Parth Shah',
    date: day(0),
    venue: plot,
    city: 'Ahmedabad',
    cover: { preset: 'maroon' },
    story:
      'We met at a friend’s Navratri garba in 2018, when Parth stepped on Hetal’s dupatta twice in the same round and ' +
      'then asked for a dandiya lesson. Five Navratris later he can finally keep up.\n\n' +
      'Our home already has more steel dabbas than shelves, so instead of gifts we would love your shagun towards a few ' +
      'dreams: a honeymoon in Bali, our first kitchen, and seva at the gaushala in Mota Ba’s village.',
    families: {
      bride: 'Smt. Jyotsna & Shri Mahendra Patel',
      groom: 'Smt. Daksha & Shri Kirit Shah',
    },
    events,
    milestones: [
      { id: 'm-ahd-1', when: 'Navratri 2018', title: 'Two left feet at the garba', emoji: '🪔', text: 'A friend’s society garba, one stepped-on dupatta and a promise of dandiya lessons.' },
      { id: 'm-ahd-2', when: 'Uttarayan 2020', title: 'The kite that got away', emoji: '🪁', text: 'Parth cut Hetal’s kite on the terrace. He still says it was an accident.' },
      { id: 'm-ahd-3', when: 'August 2024', title: 'The proposal at the lake', emoji: '💍', text: 'A rainy evening walk around the lake, and a ring hidden in a box of dhokla.' },
      { id: 'm-ahd-4', when: 'January 2025', title: 'Gol dhana', emoji: '🌼', text: 'Both families, coriander seeds and jaggery, and the date fixed by Mota Ba herself.' },
    ],
    gallery: [
      { id: 'p-ahd-1', url: 'demo/ahd-1.svg', caption: 'Where it started: a Navratri garba' },
      { id: 'p-ahd-2', url: 'demo/ahd-2.svg', caption: 'The mandvo at home' },
      { id: 'p-ahd-3', url: 'demo/gallery-4.svg', caption: 'Gol dhana with both families' },
    ],
    goals: [
      {
        id: 'g-ahd-bali', title: 'Honeymoon in Bali', target: 250_000, emoji: '🏝️', imageUrl: 'demo/goal-honeymoon.svg',
        description: 'Eight days of rice terraces in Ubud and beaches in Uluwatu.',
        updates: [{ id: 'u-ahd-1', text: 'Villa in Ubud booked! Thank you for blessing us so quickly.', createdAt: now.getTime() - 48 * HOUR }],
      },
      { id: 'g-ahd-kitchen', title: 'Our first kitchen in Gota', target: 300_000, emoji: '🍳', imageUrl: 'demo/goal-home.svg', description: 'A modular kitchen with space for Mummy’s thepla tava and Parth’s coffee machine.' },
      { id: 'g-ahd-gaushala', title: 'Gaushala seva in Mota Ba’s village', target: 51_000, emoji: '🐄', imageUrl: 'demo/goal-trees.svg', description: 'A year of fodder for the gaushala near Mehsana, in Mota Ba’s name.' },
    ],
    upiId: 'hetal.parth@demo',
    payeeName: 'Hetal Patel',
    showAmounts: false,
    paymentMode: 'razorpay',
    feeBearer: 'guest',
    createdAt: now.getTime() - 25 * 24 * HOUR,
    demo: true,
  };
  w.invite = {
    ...defaultInvite(w, 'gujarati', 'gujarati', 'traditional'),
    showShlok: true,
    grandparents: { bride: 'Smt. Kantaben & Shri Ramanbhai Patel', groom: 'Smt. Gitaben & Late Shri Chimanlal Shah' },
    swagatotsuk: 'Jayesh Mama & Mami\nNayna Fai & Fuva\nDhruvi, Krish & all the little ones',
    darshanabhilashi: 'Patel & Shah Parivar\nShantikunj Society, Navrangpura',
    coverPhoto: 'demo/ahd-1.svg',
    updatedAt: now.getTime() - 7 * 24 * HOUR,
  };
  return w;
}

const HETAL_GUESTS: GuestRow[] = [
  ['Kantaben & Ramanbhai Patel', 'Ba-Dada', 'b', 'Kutumb', 'g', 'gu', 2, '0145', 'અમે મંડપ મુહૂર્તથી જ આવી જઈશું.'],
  ['Jayesh Mama', 'Jayesh Mama & Mami', 'b', 'Mosal', 'g', 'gu', 4, '*', 'Mameru ni taiyari chalu che!'],
  ['Nayna Fai', 'Nayna Fai & Fuva', 'b', "Fai's family", 'g', 'gu', 3, '01345'],
  ['Bhavesh Kaka', 'Bhavesh Kaka & family', 'g', "Kaka's family", 'g', 'gu', 5, '345'],
  ['Dhara & Chirag', '', 'b', 'College friends', 'g', 'en', 2, '2345', 'Dandiya practice since Navratri!'],
  ['Riddhi Shah', '', 'g', 'Cousins', 'g', 'hg', 1, '345'],
  ['Mukeshbhai Desai', 'Desai Parivar', 'g', 'Society friends', 'g', 'gu', 4, '45'],
  ['Team Payments, Finverse', 'Team Payments', 'b', 'Office', 'g', 'en', 7, '5', 'Twelve of us, seven can make it. Reception for sure!'],
  ['Hemaben Joshi', '', 'b', 'Society friends', 'g', 'gu', 2, '345'],
  ['Kunal Mehta', '', 'g', 'School friends', 'g', 'en', 1, '345'],
  ['Pinal & Nirav', '', 'b', 'Cousins', 'g', 'gu', 2, '*'],
  ['Dr. Parul Trivedi', 'Trivedi Parivar', 'g', 'Family friends', 'g', 'en', 3, '45'],
  ['Saurabh Bhai', 'Saurabh Bhai & Bhabhi', 'g', 'Cousins', 'g', 'hg', 2, '345'],
  ['Jignesh Patel', '', 'b', 'Kutumb', 'r', 'gu', 4, '345', 'Bas, time pe pahochi jaishu.'],
  ['Anjali Vyas', '', 'b', 'Office', 'r', 'en', 1, '35'],
  ['Mota Ba', '', 'g', 'Kutumb', 'r', 'gu', 1, '04', 'મારે ખુરશી મંડપ પાસે જોઈશે.'],
  ['Ketan & Foram', '', 'g', 'College friends', 'r', 'en', 2, '345'],
  ['Harshad Mama', 'Harshad Mama & Mami', 'g', 'Mosal', 'r', 'gu', 3, '*'],
  ['Rakesh Pandya', 'Pandya Parivar', 'b', 'Society friends', 'r', 'gu', 4, '45'],
  ['Sonal Masi', 'Sonal Masi & family', 'b', "Masi's family", 'r', 'gu', 3, '2345'],
  ['Vivek Joshi', '', 'g', 'Office', 'r', 'hg', 1, '5'],
  ['Alpaben', '', 'b', 'Neighbours', 'o', 'gu'],
  ['Chintan Shah', 'Shah Parivar', 'g', "Kaka's family", 'o', 'gu'],
  ['Nehal & Bhumika', '', 'b', 'College friends', 'o', 'en'],
  ['Prakash Kaka', 'Prakash Kaka & family', 'g', "Kaka's family", 'o', 'gu'],
  ['Manish Agrawal', 'Agrawal Parivar', 'g', 'Office', 'o', 'hi'],
  ['Tejal Didi', 'Tejal Didi & Jiju', 'b', 'Cousins', 'o', 'hg'],
  ['Rameshbhai Thakkar', 'Thakkar Parivar', 'b', 'Family friends', 'o', 'gu'],
  ['Krupa Desai', '', 'g', 'School friends', 'o', 'en'],
  ['Hiten Soni', '', 'g', 'Society friends', 's', 'gu'],
  ['Dipti Fai', 'Dipti Fai & Fuva', 'g', "Fai's family", 's', 'gu'],
  ['Ankit & Riya Parekh', 'Parekh Parivar', 'b', 'Cousins', 's', 'gu'],
  ['Sanjay Rawal', '', 'g', 'Office', 's', 'en'],
  ['Bhanuben', '', 'b', 'Neighbours', 's', 'gu'],
  ['Mitesh Kaka', 'Mitesh Kaka & Kaki', 'b', "Kaka's family", 's', 'gu'],
  ['Avni Kapadia', '', 'b', 'School friends', 's', 'en'],
  ['Dilipbhai Chauhan', 'Chauhan Parivar', 'g', 'Family friends', 's', 'gu'],
  ['Rajvi & Jay', '', 'g', 'College friends', '-', 'hg'],
  ['Ilaben Mehta', '', 'b', "Masi's family", '-', 'gu'],
  ['Suresh Mama', 'Suresh Mama & Mami', 'g', 'Mosal', '-', 'gu'],
  ['Hardik Bhatt', '', 'g', 'Office', '-', 'en'],
  ['Patel Family, C-12', 'Patel Parivar', 'b', 'Society friends', '-', 'gu'],
  ['Nikita Rao', '', 'b', 'Office', '-', ''],
  ['Gita Ba', '', 'g', 'Kutumb', 'g', 'gu', 1, '04'],
  ['Vandana Kaki', 'Vandana Kaki & family', 'b', "Kaka's family", 'g', 'gu', 4, '345'],
  ['Yogesh Dave', 'Dave Parivar', 'g', 'Neighbours', 'g', 'gu', 3, '45'],
];

const HETAL_GIFTS: GiftRow[] = [
  ['Kantaben & Ramanbhai Patel', 1, 51_000, 'સદા સુખી રહો, દીકરી. ભગવાન તમારી જોડી સલામત રાખે.', 420, 'v', 'b'],
  ['Shah Parivar (Surat)', 1, 11_000, 'Surat thi khub khub abhinandan. Jalso karo!', 400, 'v', 'g'],
  ['Jayesh Mama & Mami', 0, 21_000, 'Bali ma khub maja karjo! Mama-Mami taraf thi 🌴', 380, 'v', 'b'],
  ['Mitul & Khushboo', 0, 3_100, 'Ubud no sunset tamara naam! 🌅', 350, 'p', 'b'],
  ['Nana-Nani (Vadodara)', 1, 21_000, 'દીકરીનું ઘર હંમેશા ભર્યું ભર્યું રહે.', 340, 'v', 'b'],
  ['Nayna Fai & Fuva', 1, 11_000, 'નવા ઘરમાં હંમેશા ખુશીઓ રહે.', 300, 'p', 'b'],
  ['Bhavesh Kaka & family', 1, 11_000, '', 260, 'v', 'g'],
  ['Jinal Bhabhi', 2, 1_101, '', 240, 'g', 'g'],
  ['Dhara & Chirag', 0, 5_100, 'Hetal, garba ma tari jodi koi nahi! Have the best time in Ubud.', 220, 'p', 'b'],
  ['Riddhi Shah', 0, 2_100, 'Bhaiya, finally! Bali ki photos bhejna 😄', 200, 'p', 'g'],
  ['Desai Parivar', 2, 5_001, 'ગૌશાળા સેવા માટે સરસ વિચાર. અભિનંદન!', 180, 'v', 'g'],
  ['Team Payments, Finverse', 0, 25_000, 'From all twelve of us: congratulations! No Jira on the honeymoon.', 150, 'p', 'b'],
  ['Hemaben Joshi', 2, 1_100, '', 130, 'g', 'b'],
  ['Kunal Mehta', 0, 2_100, 'Parth bhai, all the best for the second innings!', 120, 'p', 'g'],
  ['Parth’s cricket team, Gota', 0, 5_100, 'Bhai ni shaadi ma dandiya aakhi raat! 🏏', 110, 'g', 'g'],
  ['Ramesh Uncle (Dubai)', 1, 10_001, 'Sorry we will miss the pheras. Blessings from Dubai!', 100, 'p', 'g'],
  ['Pinal & Nirav', 1, 5_100, 'Kitchen ma pehli chai amne pivadjo ☕', 96, 'v', 'b'],
  ['Dr. Parul Trivedi', 2, 2_500, 'Wishing you both a lifetime of togetherness.', 80, 'v', 'g'],
  ['Hetal’s dance class', 0, 2_100, 'Our star dancer is getting married! 💃', 70, 'p', 'b'],
  ['Saurabh Bhai & Bhabhi', 0, 11_000, 'Shaadi mubarak! Bali mein scooter dhyaan se chalana.', 60, 'p', 'g'],
  ['Gita Ba', 2, 5_100, 'જુગ જુગ જીવો મારા બાળકો.', 50, 'v', 'g'],
  ['Vandana Kaki & family', 1, 5_100, 'લગ્ન જીવનની હાર્દિક શુભકામનાઓ!', 40, 'g', 'b'],
  ['Dave Parivar', 1, 2_100, '', 30, 'p', 'g'],
  ['Kiran Masi', 2, 2_100, 'ભગવાન તમને ખૂબ સુખ આપે.', 26, 'g', 'b'],
  ['Vishal & Ruchi', 1, 1_100, '', 14, 'g', 'g'],
  ['Prof. Mehul Raval', 2, 1_001, 'Proud of you both. Keep learning together.', 8, 'g', 'b'],
];

// ---------- 3. Meenakshi & Rohan, Bengaluru (Tamil bride, Punjabi groom; South Indian style) ----------

function meenakshiWedding(now: Date): Wedding {
  const day = (offset: number) => isoDaysFromNow(55 + offset, now);
  const hall = 'Sri Kalyana Mandapam, Malleshwaram';
  const hallAddress = '8th Cross, Malleshwaram, Bengaluru 560003';
  const hallMap = 'https://maps.google.com/?q=Malleshwaram+Bengaluru';
  const garden = 'Banyan Courtyard, Whitefield';
  const gardenAddress = 'ITPL Main Road, Whitefield, Bengaluru 560066';
  const gardenMap = 'https://maps.google.com/?q=Whitefield+Bengaluru';
  const w: Wedding = {
    id: 'w-demo-blr',
    slug: 'meenakshi-weds-rohan',
    partner1: 'Meenakshi Iyer',
    partner2: 'Rohan Malhotra',
    date: day(0),
    venue: hall,
    city: 'Bengaluru',
    cover: { preset: 'peacock' },
    story:
      'A Tamil girl from Chennai and a Punjabi boy from Ludhiana walked into the same Bengaluru office in 2019. On day ' +
      'one the Wi-Fi router broke, and we spent the afternoon fixing it with a paperclip and a lot of filter coffee.\n\n' +
      'Two families, two languages and one very long guest list later, we are celebrating with a muhurtham in the ' +
      'morning and a sangeet the night before. Instead of gifts, bless one of our dreams; it goes straight to us by UPI.',
    families: {
      bride: 'Smt. Lalitha & Shri Venkatesh Iyer',
      groom: 'Mrs. Harpreet & Mr. Sukhdev Malhotra',
    },
    events: [
      { id: 'e-blr-haldi', kind: 'haldi', name: 'Haldi & Nalangu', date: day(-2), time: '10:00', endTime: '13:00', venue: garden, address: gardenAddress, mapsUrl: gardenMap, dressCode: 'Yellow, and bring your competitive spirit for the games' },
      { id: 'e-blr-mehndi', kind: 'mehndi', name: 'Mehndi', date: day(-2), time: '16:00', endTime: '20:00', venue: garden, address: gardenAddress, mapsUrl: gardenMap, dressCode: 'Greens and pastels' },
      { id: 'e-blr-sangeet', kind: 'sangeet', name: 'Sangeet & Bhangra night', date: day(-1), time: '19:00', endTime: '00:30', venue: garden, address: gardenAddress, mapsUrl: gardenMap, dressCode: 'Phulkari, silk or sequins: anything you can dance in' },
      { id: 'e-blr-muhurtham', kind: 'wedding', name: 'Muhurtham', date: day(0), time: '07:30', endTime: '10:30', venue: hall, address: hallAddress, mapsUrl: hallMap, dressCode: 'Silk sarees, veshti or kurta. Breakfast on a banana leaf after.' },
      { id: 'e-blr-reception', kind: 'reception', name: 'Reception', date: day(0), time: '19:00', endTime: '23:00', venue: 'The Palm Grove Hall', address: 'Old Airport Road, Bengaluru 560017', mapsUrl: 'https://maps.google.com/?q=Old+Airport+Road+Bengaluru', dressCode: 'Festive formal' },
    ],
    milestones: [
      { id: 'm-blr-1', when: 'July 2019', title: 'The broken router', emoji: '💻', text: 'First day at work, no Wi-Fi, one paperclip and two strangers who refused to call IT.' },
      { id: 'm-blr-2', when: '2020', title: 'Lockdown cooking club', emoji: '🍛', text: 'Sambar recipes for butter chicken recipes, swapped on video calls every Sunday.' },
      { id: 'm-blr-3', when: 'Pongal 2024', title: 'Meeting Appa', emoji: '🌾', text: 'Rohan learned to eat with his hand on a banana leaf. Appa approved, eventually.' },
      { id: 'm-blr-4', when: 'Lohri 2025', title: 'The proposal by the bonfire', emoji: '🔥', text: 'In Ludhiana, in front of both families, with the dhol a little too loud to hear the question.' },
    ],
    gallery: [
      { id: 'p-blr-1', url: 'demo/blr-1.svg', caption: 'The mandapam in Malleshwaram' },
      { id: 'p-blr-2', url: 'demo/blr-2.svg', caption: 'Bengaluru, where it all began' },
      { id: 'p-blr-3', url: 'demo/gallery-3.svg', caption: 'The Lohri proposal' },
    ],
    goals: [
      {
        id: 'g-blr-roadtrip', title: 'Coorg & Kerala backwaters road trip', target: 150_000, emoji: '🛶', imageUrl: 'demo/goal-honeymoon.svg',
        description: 'Coffee estates, a houseboat in Alleppey and two weeks without laptops.',
      },
      { id: 'g-blr-flat', title: 'Down payment on a flat in Whitefield', target: 800_000, emoji: '🏙️', imageUrl: 'demo/goal-home.svg', description: 'Close enough to both offices, with a balcony for Amma’s plants.' },
      {
        id: 'g-blr-library', title: 'A library for Paati’s village school', target: 75_000, emoji: '📚', imageUrl: 'demo/goal-kyoto.svg',
        description: 'Books in Tamil, English and Hindi for the government school near Kumbakonam.',
        updates: [{ id: 'u-blr-1', text: 'The first 200 books are ordered! The school has picked a reading corner.', createdAt: now.getTime() - 20 * HOUR }],
      },
      { id: 'g-blr-bike', title: 'A Royal Enfield for weekend rides', target: 220_000, emoji: '🏍️', description: 'For Nandi Hills sunrises, two helmets included.' },
    ],
    upiId: 'meenakshi.rohan@demo',
    payeeName: 'Meenakshi Iyer',
    showAmounts: false,
    paymentMode: 'razorpay',
    feeBearer: 'couple',
    createdAt: now.getTime() - 18 * 24 * HOUR,
    demo: true,
  };
  w.invite = {
    ...defaultInvite(w, 'south', 'english', 'traditional'),
    grandparents: { bride: 'Smt. Kamakshi & Late Shri Ramaswamy Iyer', groom: 'Sardarni Jaswant Kaur & Sardar Gurbachan Singh Malhotra' },
    swagatotsuk: 'Shreya, Arjun & Simran\nLakshmi Chithi & Balwinder Chacha\nAll the cousins from Chennai and Ludhiana',
    darshanabhilashi: 'Iyer & Malhotra families\nFriends from Bengaluru',
    coverPhoto: 'demo/blr-1.svg',
    updatedAt: now.getTime() - 3 * 24 * HOUR,
  };
  return w;
}

const MEENAKSHI_GUESTS: GuestRow[] = [
  ['Paati & Thatha', 'Paati-Thatha', 'b', 'Family', 'g', 'en', 2, '34', 'We will be at the mandapam by 6 am!'],
  ['Lakshmi Chithi', 'Lakshmi Chithi & family', 'b', "Amma's side", 'g', 'en', 3, '034'],
  ['Balwinder Chacha', 'Balwinder Chacha & family', 'g', "Papa's side", 'g', 'hg', 6, '234', 'Bhangra di tayyari poori hai!'],
  ['Gurpreet Bua', 'Gurpreet Bua & Phupha ji', 'g', "Bua's family", 'g', 'hi', 3, '*'],
  ['Karthik & Divya', '', 'b', 'College friends', 'g', 'en', 2, '234'],
  ['Team Search, Orbitly', 'Team Search', 'g', 'Office', 'g', 'en', 8, '4', 'All eight of us for the reception!'],
  ['Ramanathan Mama', 'Ramanathan Mama & Mami', 'b', "Mama's family", 'g', 'en', 2, '34'],
  ['Simran Malhotra', '', 'g', 'Cousins', 'g', 'hg', 1, '0123'],
  ['Arvind Rao', 'Rao family', 'b', 'Neighbours', 'g', 'en', 3, '34'],
  ['Harleen & Jaspreet', '', 'g', 'Cousins', 'g', 'hg', 2, '1234'],
  ['Priyanka Menon', '', 'b', 'Office', 'g', 'en', 1, '24'],
  ['Sharma Uncle (Delhi)', 'Sharma Parivar', 'g', 'Family friends', 'g', 'hi', 2, '4'],
  ['Ananya Subramaniam', '', 'b', 'School friends', 'r', 'en', 1, '234', 'Vegetarian please, and a seat near the nadaswaram!'],
  ['Rajinder Taya ji', 'Taya ji & Tayi ji', 'g', "Papa's side", 'r', 'hi', 2, '234'],
  ['Vasudha Athai', 'Vasudha Athai & family', 'b', "Appa's side", 'r', 'en', 4, '034'],
  ['Mohit & Tanya', '', 'g', 'College friends', 'r', 'hg', 2, '24'],
  ['Shreya Iyer', '', 'b', 'Cousins', 'r', 'en', 1, '*'],
  ['Ajay Kohli', 'Kohli Parivar', 'g', 'Family friends', 'r', 'hi', 4, '4'],
  ['Deepak Nair', '', 'b', 'Office', 'r', 'en', 1, '4'],
  ['Nimmi Bhabhi', 'Nimmi Bhabhi & Veer ji', 'g', 'Cousins', 'r', 'hg', 3, '0123', 'Mehndi mein mera naam bhi likhna!'],
  ['Srinivasan Periappa', 'Periappa & Periamma', 'b', "Appa's side", 'o', 'en'],
  ['Kamal Arora', 'Arora Parivar', 'g', 'Neighbours', 'o', 'hi'],
  ['Revathi & Suresh', '', 'b', 'Family friends', 'o', 'en'],
  ['Nikhil Batra', '', 'g', 'School friends', 'o', 'hg'],
  ['Meera Krishnan', '', 'b', 'College friends', 'o', 'en'],
  ['Inderjit Chacha', 'Inderjit Chacha & family', 'g', "Papa's side", 'o', 'hi'],
  ['Pooja Shetty', '', 'b', 'Neighbours', 'o', 'en'],
  ['Varun Sethi', '', 'g', 'Office', 'o', 'en'],
  ['Gayathri Aunty', '', 'b', "Amma's side", 's', 'en'],
  ['Manpreet Kaur', '', 'g', 'Cousins', 's', 'hg'],
  ['Rahul & Sneha Bhat', 'Bhat family', 'b', 'Neighbours', 's', 'en'],
  ['Tarlochan Mama ji', 'Mama ji & Mami ji', 'g', "Mama's family", 's', 'hi'],
  ['Aditi Venkatesh', '', 'b', 'School friends', 's', 'en'],
  ['Sunny Gill', '', 'g', 'College friends', 's', 'hg'],
  ['Kalyani Paati', '', 'b', 'Family', 's', 'en'],
  ['Vikas Talwar', 'Talwar Parivar', 'g', 'Family friends', 's', 'hi'],
  ['Anand & Kavitha', '', 'b', 'Office', '-', 'en'],
  ['Raj Malhotra', 'Raj Chacha & family', 'g', "Papa's side", '-', 'hi'],
  ['Sowmya Ramesh', '', 'b', 'College friends', '-', 'en'],
  ['Kabir Anand', '', 'g', 'Office', '-', ''],
  ['Jyoti Massi', 'Jyoti Massi & family', 'g', "Mummy's side", '-', 'hg'],
  ['Venkat Uncle', 'Venkat Uncle & Aunty', 'b', 'Family friends', '-', 'en'],
  ['Rhea D’Souza', '', 'b', 'School friends', '-', 'en'],
  ['Harpreet & Amandeep', '', 'g', 'Cousins', 'g', 'hg', 2, '234'],
  ['Usha Mami', '', 'b', "Mama's family", 'g', 'en', 2, '034'],
  ['Neeraj Sood', '', 'g', 'Office', 'g', 'en', 1, '4'],
  ['Seetha Akka', '', 'b', 'Cousins', 'g', 'en', 2, '*'],
  ['Bhalla Family', 'Bhalla Parivar', 'g', 'Neighbours', 'r', 'hi', 5, '4'],
];

const MEENAKSHI_GIFTS: GiftRow[] = [
  ['Paati & Thatha', 2, 25_001, 'Nooru varusham santhoshama irungo. God bless you both.', 380, 'v', 'b'],
  ['Lakshmi Chithi & family', 0, 10_001, 'Have a lovely trip, kanna. Send us backwater photos!', 330, 'p', 'b'],
  ['Balwinder Chacha & family', 1, 21_000, 'Rab rakha puttar! Naye ghar di lakh lakh vadhaiyan.', 300, 'v', 'g'],
  ['Rohan’s football Sundays', 3, 7_000, 'Bhai ki shaadi! Sunday matches ab Meenakshi decide karegi 😂', 280, 'p', 'g'],
  ['Gurpreet Bua & Phupha ji', 1, 11_000, 'सदा सुहागन रहो, खुश रहो।', 260, 'p', 'g'],
  ['Mrs. Kamakshi (piano teacher)', 2, 1_001, 'Music and books, always. Blessings.', 240, 'v', 'b'],
  ['Karthik & Divya', 0, 5_001, 'Fill the tank and go! Love, K & D', 230, 'p', 'b'],
  ['Team Search, Orbitly', 3, 30_000, 'From the whole team: congratulations, and please merge this PR into life 🚀', 200, 'p', 'g'],
  ['Dr. & Mrs. Sethi', 1, 11_000, 'Congratulations! May your home be filled with joy.', 190, 'p', 'g'],
  ['Ramanathan Mama & Mami', 2, 5_001, '', 170, 'v', 'b'],
  ['Amma’s book club', 2, 3_001, 'Forty books for the library from all of us 📚', 160, 'g', 'b'],
  ['Simran Malhotra', 3, 2_100, 'Veere, helmet zaroor pehnana! 🏍️', 150, 'p', 'g'],
  ['Rao family', 1, 5_100, 'Wishing you a home full of filter coffee and laughter.', 130, 'v', 'b'],
  ['Harleen & Jaspreet', 0, 3_100, 'Backwaters te Coorg, full on vibes! Mubarakan!', 110, 'g', 'g'],
  ['Ganesh & Shalini, Mysuru', 0, 2_100, '', 100, 'g', 'b'],
  ['Priyanka Menon', 2, 1_100, '', 90, 'p', 'b'],
  ['Sharma Parivar', 1, 11_000, 'ढेर सारी शुभकामनाएँ। नया घर, नई खुशियाँ।', 70, 'g', 'g'],
  ['Harpreet & Amandeep', 3, 5_100, 'Ride safe, ride together! Lots of love.', 60, 'p', 'g'],
  ['Usha Mami', 2, 2_001, 'Books are the best gift. Very proud of you, Meenu.', 50, 'v', 'b'],
  ['Kartar Singh ji', 1, 5_100, 'Waheguru mehar kare. Bahut bahut vadhaiyan!', 40, 'v', 'g'],
  ['Neeraj Sood', 0, 1_100, '', 30, 'g', 'g'],
  ['Seetha Akka', 0, 2_501, 'Enjoy every moment, both of you! ❤️', 20, 'v', 'b'],
  ['Ex-roommates, PG hostel', 3, 4_001, 'To the couple who met over a broken Wi-Fi router 💻', 12, 'p', 'b'],
  ['Leela Teacher', 2, 501, 'Proud of my student! God bless.', 6, 'g', 'b'],
];

// ---------- the samples ----------

const SPECS: SampleSpec[] = [
  { id: DEMO_ID, rowPrefix: 'demo', tokenPrefix: 'demo', phoneDigit: 1, noPhone: [24, 42], thanked: 4, guests: RIYA_GUESTS, gifts: RIYA_GIFTS, wedding: riyaWedding },
  { id: 'w-demo-ahd', rowPrefix: 'ahd', tokenPrefix: 'ahmd', phoneDigit: 2, noPhone: [22, 39], thanked: 6, guests: HETAL_GUESTS, gifts: HETAL_GIFTS, wedding: hetalWedding },
  { id: 'w-demo-blr', rowPrefix: 'blr', tokenPrefix: 'blru', phoneDigit: 3, noPhone: [35, 43], thanked: 3, guests: MEENAKSHI_GUESTS, gifts: MEENAKSHI_GIFTS, wedding: meenakshiWedding },
];

function specFor(w: Pick<Wedding, 'id'>): SampleSpec | undefined {
  return SPECS.find((s) => s.id === w.id);
}

/** A clearly fake Indian mobile number: 91 90000 <sample> <4 digits>. */
function fakePhone(spec: SampleSpec, n: number): string | undefined {
  return spec.noPhone.includes(n) ? undefined : `9190000${spec.phoneDigit}${pad(n)}`;
}

/** The main showcase sample, always about four weeks away so the page never looks stale. */
export function demoWedding(now = new Date()): Wedding {
  return riyaWedding(now);
}

/** Every sample wedding, the showcase first. */
export function demoWeddings(now = new Date()): Wedding[] {
  return SPECS.map((s) => s.wedding(now));
}

/** The sample's guest list, at every stage from "not sent" to "gave shagun". */
export function demoGuests(w: Wedding, now = Date.now()): Guest[] {
  const spec = specFor(w);
  if (!spec) return [];
  return spec.guests.map(([name, greeting, side, group, status, lang], i) => {
    const n = i + 1;
    const step = STEPS.indexOf(status);
    // Earlier guests on the list were invited first; nothing is in the future.
    const at = (s: number, hours: number) => (step >= s ? now - Math.max(1, hours - i * 0.8) * HOUR : undefined);
    const g: Guest = {
      id: `gu-${spec.rowPrefix}-${n}`,
      weddingId: w.id,
      name,
      side: SIDE[side],
      group,
      token: `${spec.tokenPrefix}${pad(n)}tk`,
      createdAt: now - (300 - i) * HOUR,
    };
    if (greeting) g.greeting = greeting;
    const phone = fakePhone(spec, n);
    if (phone) g.phone = phone;
    if (lang) g.language = LANGS[lang];
    const sent = at(1, 200), opened = at(2, 150), rsvp = at(3, 120), gave = at(4, 60);
    if (sent) g.sentAt = sent;
    if (opened) g.openedAt = opened;
    if (rsvp) g.rsvpAt = rsvp;
    if (gave) g.gaveAt = gave;
    return g;
  });
}

/** One RSVP for every guest who RSVP'd (or gave and RSVP'd), with their party and functions. */
export function demoRsvps(w: Wedding, now = Date.now()): Rsvp[] {
  const spec = specFor(w);
  if (!spec) return [];
  const events = (w.events ?? []).map((e) => e.id);
  const out: Rsvp[] = [];
  spec.guests.forEach(([name, greeting, side, , status, , party = 0, ev = '*', note = ''], i) => {
    if ((status !== 'r' && status !== 'g') || party < 1) return;
    const eventIds = ev === '*' ? events : [...ev].map((d) => events[Number(d)]).filter((id): id is string => !!id);
    const phone = fakePhone(spec, i + 1);
    out.push({
      id: `r-${spec.rowPrefix}-${out.length + 1}`,
      weddingId: w.id,
      guestName: greeting || name,
      side: SIDE[side],
      partySize: party,
      eventIds,
      note,
      ...(phone ? { phone } : {}),
      createdAt: now - Math.max(1, 118 - i * 0.8) * HOUR,
    });
  });
  return out;
}

/** Blessings: verified in the bank app, guest-confirmed ("I've paid"), and paid through Razorpay. */
export function demoContributions(w: Wedding, now = Date.now()): Contribution[] {
  const spec = specFor(w);
  if (!spec) return [];
  // A blessing from someone on the guest list carries their phone, so the couple can thank them.
  const phoneOf = (giver: string) => {
    const i = spec.guests.findIndex(([name, greeting]) => giver === name || (!!greeting && giver === greeting) || giver.startsWith(`${name} `));
    return i < 0 ? undefined : fakePhone(spec, i + 1);
  };
  let thanked = 0;
  return spec.gifts.map(([guestName, goalIndex, amount, message, hoursAgo, status, side], i) => {
    const createdAt = now - hoursAgo * HOUR;
    const phone = phoneOf(guestName);
    const c: Contribution = {
      id: `c-${spec.rowPrefix}-${i + 1}`,
      weddingId: w.id,
      goalId: w.goals[goalIndex].id,
      guestName,
      amount,
      message,
      ...(phone ? { phone } : {}),
      ...(side ? { side: SIDE[side] } : {}),
      createdAt,
      status: status === 'v' ? 'verified' : status === 'p' ? 'paid' : 'guest-confirmed',
    };
    if (status === 'p') {
      const fees = feeBreakdown(amount, w.feeBearer ?? 'couple');
      const ref = `${spec.rowPrefix.toUpperCase()}${pad(i + 1, 6)}`;
      c.provider = 'razorpay';
      c.razorpayOrderId = `order_DEMO${ref}`;
      c.razorpayPaymentId = `pay_DEMO${ref}`;
      c.chargedAmount = paiseToRupees(fees.totalPaise);
      c.fee = paiseToRupees(fees.gatewayFeePaise + fees.platformFeePaise);
      c.paidAt = createdAt + 60_000;
      const guestFee = paiseToRupees(fees.convenienceFeePaise);
      if (guestFee) c.guestFee = guestFee;
    }
    if (status !== 'g' && thanked < spec.thanked && hoursAgo > 20) {
      c.thankedAt = createdAt + 20 * HOUR;
      thanked++;
    }
    return c;
  });
}
