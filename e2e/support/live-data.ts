import { MockUser, Tables } from './supabase-mock';

/** A made-up couple for the backend tests (fictional people, fake UPI ID and phones). */
export const COUPLE: MockUser = { id: '6f1c2b8e-7d3a-4c55-9e21-0b7a5d4c3e10', email: 'kavya.e2e@example.com' };
export const PARTNER: MockUser = { id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', email: 'nikhil.e2e@example.com' };

export const LIVE_ID = '3b9f6a1e-2c4d-4e8f-9a0b-1c2d3e4f5a6b';
export const LIVE_SLUG = 'kavya-weds-nikhil';
export const GUEST_TOKEN = 'e2etok0001live';
export const NEW_GUEST_TOKEN = 'e2etok0002live';

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export function liveWeddingRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  const date = isoDaysFromNow(30);
  return {
    id: LIVE_ID,
    slug: LIVE_SLUG,
    partner1: 'Kavya Iyer',
    partner2: 'Nikhil Bansal',
    wedding_date: date,
    venue: 'Lalbagh Glass House',
    city: 'Bengaluru',
    upi_id: 'kavya.nikhil@demo',
    payee_name: 'Kavya Iyer',
    show_amounts: false,
    payment_mode: 'upi_direct',
    fee_bearer: 'couple',
    razorpay_active: false,
    created_at: hoursAgo(400),
    details: {
      cover: { preset: 'peacock' },
      story: 'We met at a Kannada theatre workshop and never stopped rehearsing together.',
      goals: [
        { id: 'g-trip', title: 'Monsoon trip to Coorg', target: 150000, emoji: '🌧️', description: 'Coffee estates and waterfalls.' },
        { id: 'g-home', title: 'Our first sofa and a bookshelf', target: 80000, emoji: '🛋️' },
      ],
      events: [
        { id: 'e-mehndi', kind: 'mehndi', name: 'Mehndi', date: isoDaysFromNow(29), time: '16:00', endTime: '19:00', venue: 'Terrace, Indiranagar' },
        { id: 'e-wedding', kind: 'wedding', name: 'Muhurtham', date, time: '07:30', endTime: '11:00', venue: 'Lalbagh Glass House' },
        { id: 'e-reception', kind: 'reception', name: 'Reception', date, time: '19:00', endTime: '22:30', venue: 'Palace Grounds' },
      ],
      families: { bride: 'Mrs. Lakshmi & Mr. Venkat Iyer', groom: 'Mrs. Neelam & Mr. Rajiv Bansal' },
      gallery: [],
      milestones: [],
    },
    ...over,
  };
}

/** A live wedding owned by COUPLE, with a guest list, two blessings and one RSVP. */
export function liveTables(over: { wedding?: Record<string, unknown> } = {}): Tables {
  return {
    shagun_weddings: [liveWeddingRow(over.wedding)],
    shagun_wedding_owners: [{ wedding_id: LIVE_ID, email: COUPLE.email, added_at: hoursAgo(400) }],
    shagun_guests: [
      { id: 'a1b2c3d4-0000-4000-8000-000000000001', wedding_id: LIVE_ID, name: 'Meera Rao', greeting: 'Rao Parivar', phone: '919000012345', side: 'bride', group_name: 'Family', token: GUEST_TOKEN, sent_at: hoursAgo(50), opened_at: null, rsvp_at: null, gave_at: null, created_at: hoursAgo(300) },
      { id: 'a1b2c3d4-0000-4000-8000-000000000002', wedding_id: LIVE_ID, name: 'Tarun Gill', greeting: null, phone: '919000067890', side: 'groom', group_name: 'Office', token: NEW_GUEST_TOKEN, sent_at: null, opened_at: null, rsvp_at: null, gave_at: null, created_at: hoursAgo(299) },
    ],
    shagun_contributions: [
      { id: 'c0000000-0000-4000-8000-000000000001', wedding_id: LIVE_ID, goal_id: 'g-trip', guest_name: 'Anand Mama', amount: 5100, message: 'Coorg ki coffee hamare liye bhi laana!', phone: null, side: 'bride', status: 'verified', thanked_at: null, created_at: hoursAgo(40), provider: 'upi_direct' },
      { id: 'c0000000-0000-4000-8000-000000000002', wedding_id: LIVE_ID, goal_id: 'g-home', guest_name: 'Sushma Aunty', amount: 2100, message: '', phone: null, side: 'groom', status: 'guest-confirmed', thanked_at: null, created_at: hoursAgo(20), provider: 'upi_direct' },
    ],
    shagun_rsvps: [
      { id: 'r0000000-0000-4000-8000-000000000001', wedding_id: LIVE_ID, guest_name: 'Anand Mama', phone: null, side: 'bride', event_ids: ['e-wedding', 'e-reception'], party_size: 3, note: '', created_at: hoursAgo(39) },
    ],
    shagun_profiles: [],
  };
}

export function profileRow(user: MockUser, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: user.id, full_name: 'Kavya Iyer', display_name: 'Kavya', phone: '+919000011111', city: 'Bengaluru', avatar_path: null,
    wedding_role: 'bride', language: 'en', upi_id: 'kavya.iyer@demo', payee_name: 'Kavya Iyer', notify_shagun: true, notify_rsvp: true,
    created_at: hoursAgo(500), updated_at: hoursAgo(500), ...over,
  };
}
