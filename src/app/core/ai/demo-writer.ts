import { formatInr, formatInrShort } from '../format';
import { NoteLanguage } from '../models';
import { firstName, pickBy } from '../util';
import { GoalSuggestions, GoalsInput, MilestonesInput, StoryInput, SuggestedGoal, SuggestedMilestone, ThanksInput } from './ai.models';
import { roundTarget } from './prompts';

/**
 * Offline "AI" used in Demo mode: templates and keyword heuristics, deterministic for the same
 * input so tests and screenshots are stable. Its output goes through the same validation as a
 * real model reply.
 */

// ---------- story ----------

function sentence(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const capital = t[0].toUpperCase() + t.slice(1);
  return /[.!?।]$/.test(capital) ? capital : `${capital}.`;
}

/**
 * Turns "we met on a train", "on a train" or "met at college" into a clause that reads after "we":
 * "met on a train", "met at college".
 */
export function meetingClause(text: string): string {
  const t = text.trim().replace(/[.!।]+$/, '').replace(/^(we|us|hum)\s+/i, '');
  if (!t) return '';
  if (/^(first\s+)?met\b/i.test(t)) return t.replace(/^first\s+/i, '');
  if (/^(at|on|in|through|during|via|over|while|when|back)\b/i.test(t)) return `met ${t}`;
  return t;
}

export function demoStory(input: StoryInput): string {
  const a = firstName(input.partner1) || 'We';
  const b = firstName(input.partner2) || 'us';
  const met = meetingClause(input.howWeMet);
  const details = sentence(input.details);
  const seed = `${a}${b}${met}`;

  if (input.language === 'hindi') {
    const first = met
      ? `हमारी कहानी वहाँ से शुरू हुई जब we ${met}. तब से ${a} और ${b} की कहानी हर दिन थोड़ी और खूबसूरत होती गई।`
      : `${a} और ${b} की कहानी छोटी-छोटी बातों से शुरू हुई और अब एक नए सफ़र तक पहुँच गई है।`;
    return `${first} ${details}`.trim() +
      '\n\nतोहफ़ों की जगह, अगर आप चाहें तो हमारे सपनों के लिए शगुन का आशीर्वाद दे सकते हैं। हर शगुन सीधे UPI से हम तक पहुँचता है, और हर आशीर्वाद हमारी दीवार पर। 🙏';
  }

  if (input.language === 'hinglish') {
    const first = met
      ? `Humari kahani tab shuru hui jab we ${met}. ${pickBy(['Phir kya tha, baaki sab history hai.', 'Ek chai se shuru hua aur ab saat phere tak pahunch gaye!', 'Tab se ek doosre ko jhel rahe hain, khushi khushi.'], seed)}`
      : `${a} aur ${b} ki kahani simple si thi, par ab ek naye safar tak aa pahunchi hai.`;
    return `${first} ${details}`.trim() +
      '\n\nGifts ki jagah, agar aap chahein toh humare sapnon ke liye shagun de sakte hain. Har shagun seedha UPI se humare paas aata hai, aur har blessing humari wall par. 🙏';
  }

  const openers: Record<StoryInput['tone'], string> = {
    warm: met
      ? `We ${met}, and somewhere between that day and this one, we became each other's home.`
      : `${a} and ${b} found each other the way the best things happen: slowly, then all at once.`,
    playful: met
      ? `Plot summary: we ${met}. One of us was definitely trying to impress the other. We still argue about which one.`
      : `${a} and ${b}: one plans everything, the other finds the snacks. It works.`,
    poetic: met
      ? `It began quietly, when we ${met}. Like a diya lit from another, one small flame became two.`
      : 'Like a diya lit from another, one small flame became two.',
  };
  const closers: Record<StoryInput['tone'], string> = {
    warm: 'We already have everything we need in our families and friends, so instead of gifts we would love your shagun towards the dreams below. It reaches us directly by UPI, and every blessing goes up on our wall.',
    playful: 'We genuinely do not need a fourth pressure cooker. If you would like to bless us, your shagun can go towards one of the dreams below, straight to us by UPI. Blessings, jokes and dance requests go on the wall.',
    poetic: 'If you wish to bless us, let your shagun carry us towards the dreams below. It travels straight to us by UPI; your words will stay with us on our wall.',
  };
  return `${openers[input.tone]} ${details}`.trim() + `\n\n${closers[input.tone]}`;
}

// ---------- goals ----------

interface GoalRule {
  match: RegExp;
  goal: (input: GoalsInput, hit: string) => SuggestedGoal;
}

const METROS = /mumbai|bombay|bengaluru|bangalore|delhi|gurgaon|gurugram|noida|pune|hyderabad|chennai/i;
const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

const TRAVEL: [RegExp, string, number, string][] = [
  [/japan|kyoto|tokyo|osaka/i, '🗾', 2_50_000, 'Temples, trains and far too much ramen.'],
  [/europe|paris|france|italy|amalfi|santorini|greece|swiss|switzerland|spain|prague|vienna/i, '🌍', 3_00_000, 'Cobbled streets, slow mornings and no wedding planning.'],
  [/maldives/i, '🏝️', 2_50_000, 'A water villa and absolutely nothing on the calendar.'],
  [/bali|indonesia/i, '🌴', 1_25_000, 'Rice terraces, beach sunsets and a lot of coconut water.'],
  [/thailand|phuket|krabi|vietnam/i, '🌴', 1_00_000, 'Islands, night markets and long lazy lunches.'],
  [/dubai|abu dhabi/i, '🏙️', 1_25_000, 'Desert evenings and city lights.'],
  [/new zealand|australia/i, '🦘', 4_00_000, 'A road trip across a very long map.'],
  [/america|usa|\bus\b|new york|canada/i, '🗽', 4_00_000, 'The trip we have been talking about for years.'],
  [/kerala|goa|andaman|kashmir|ladakh|himachal|manali|sikkim|meghalaya|coorg|rajasthan/i, '⛰️', 75_000, 'A slow trip close to home.'],
];

const RULES: GoalRule[] = [
  {
    match: /honeymoon|trip|travel|vacation|holiday|japan|kyoto|tokyo|europe|paris|italy|santorini|bali|maldives|thailand|dubai|kerala|goa|ladakh|kashmir|australia|new zealand|america|usa|canada/i,
    goal: (input) => {
      const found = TRAVEL.find(([re]) => re.test(input.plans));
      const place = found ? cap(input.plans.match(found[0])![0]) : '';
      return {
        title: place ? `Honeymoon in ${place.length <= 3 ? place.toUpperCase() : place}` : 'Our honeymoon',
        target: found?.[2] ?? 1_50_000,
        emoji: found?.[1] ?? '✈️',
        description: found?.[3] ?? 'Our first trip as a married couple.',
      };
    },
  },
  {
    match: /house|home|flat|apartment|2bhk|3bhk|down ?payment/i,
    goal: (input) => ({
      title: input.city ? `Down payment on our home in ${cap(input.city.trim())}` : 'Down payment on our first home',
      target: METROS.test(input.city) || METROS.test(input.plans) ? 15_00_000 : 8_00_000,
      emoji: '🏡',
      description: 'A small share of the first place that is ours.',
    }),
  },
  { match: /furnish|furniture|sofa|kitchen|interior|appliance/i, goal: () => ({ title: 'Setting up our home', target: 1_50_000, emoji: '🛋️', description: 'A sofa we chose together and a kitchen we can actually cook in.' }) },
  { match: /\bcar\b|scooter|bike|ev\b/i, goal: () => ({ title: 'Our first car', target: 3_00_000, emoji: '🚗', description: 'Road trips to see all of you.' }) },
  { match: /mba|masters|study|course|education|degree/i, goal: () => ({ title: 'Studies and upskilling', target: 3_00_000, emoji: '🎓', description: 'An investment in the next chapter.' }) },
  { match: /dog|puppy|cat|pet/i, goal: () => ({ title: 'Welcoming a pet', target: 50_000, emoji: '🐶', description: 'Adoption, vet visits and far too many toys.' }) },
  { match: /tree|ngo|charity|donat|school|cause|volunteer/i, goal: () => ({ title: 'Giving back', target: 25_000, emoji: '🌳', description: 'Shared with a cause close to our hearts.' }) },
  { match: /invest|sip|savings|emergency|rainy|future/i, goal: () => ({ title: 'Our rainy-day fund', target: 1_00_000, emoji: '🪴', description: 'Peace of mind for whatever life brings.' }) },
  { match: /camera|piano|guitar|music|art/i, goal: (_, hit) => ({ title: `A ${hit.toLowerCase()} for us`, target: 80_000, emoji: '🎵', description: 'For the hobby we keep promising to make time for.' }) },
];

const FALLBACKS: SuggestedGoal[] = [
  { title: 'Our honeymoon', target: 1_50_000, emoji: '✈️', description: 'Our first trip as a married couple.' },
  { title: 'Setting up our home', target: 1_50_000, emoji: '🛋️', description: 'A sofa we chose together and a kitchen we can actually cook in.' },
  { title: 'Our rainy-day fund', target: 1_00_000, emoji: '🪴', description: 'Peace of mind for whatever life brings.' },
];

export function demoGoals(input: GoalsInput): GoalSuggestions {
  const goals: SuggestedGoal[] = [];
  for (const rule of RULES) {
    const hit = input.plans.match(rule.match);
    if (hit) goals.push(rule.goal(input, hit[0]));
    if (goals.length === 4) break;
  }
  for (const f of FALLBACKS) {
    if (goals.length >= 3) break;
    if (!goals.some((g) => g.emoji === f.emoji || g.title === f.title)) goals.push(f);
  }
  const expected = Math.max(0, input.guests) * Math.max(0, input.averageShagun);
  const total = goals.reduce((t, g) => t + g.target, 0);
  const ratio = expected > 0 ? total / expected : Infinity;
  const tip =
    expected === 0 ? 'Add your guest count to see how far your shagun could go.'
    : ratio <= 1.2 ? `About ${input.guests} guests at ${formatInr(input.averageShagun)} could give ${formatInrShort(expected)}, enough to fund most of these goals.`
    : ratio <= 3 ? `Your guest list could give about ${formatInrShort(expected)}. Put the goal you care about most first; the bigger ones can stay partly funded.`
    : `These goals add up to ${formatInrShort(total)}, well beyond the ${formatInrShort(expected)} your guests might give. Consider a smaller first goal so guests can see it fill up.`;
  return { goals: goals.map((g) => ({ ...g, target: roundTarget(g.target) })), tip };
}

// ---------- thank-you notes ----------

const NOTES: Record<NoteLanguage, ((p: NoteParts) => string)[]> = {
  english: [
    (p) => `Dear ${p.guest},\n\nThank you so much for your blessings${p.amountEn}. ${p.echoEn}Your shagun is going straight towards "${p.goal}", and we will think of you when it happens.\n\nWith love,\n${p.couple}`,
    (p) => `${p.guest}, thank you! ${p.echoEn}We are so touched that you chose to bless us${p.amountEn}. Your shagun brings "${p.goal}" one big step closer.\n\nLots of love,\n${p.couple}`,
  ],
  hindi: [
    (p) => `प्रिय ${p.guest},\n\nआपके आशीर्वाद${p.amountHi} के लिए दिल से धन्यवाद। ${p.echoHi}आपका शगुन हमारे "${p.goal}" के सपने को पूरा करने में लगेगा, और तब हम आपको ज़रूर याद करेंगे।\n\nढेर सारे प्यार के साथ,\n${p.couple}`,
    (p) => `${p.guest}, बहुत बहुत धन्यवाद! ${p.echoHi}आपका शगुन "${p.goal}" की ओर एक बड़ा कदम है। आपका आशीर्वाद हमेशा हमारे साथ रहेगा।\n\nप्यार सहित,\n${p.couple}`,
  ],
  hinglish: [
    (p) => `${p.guest}, thank you so much! ${p.echoHinglish}Aapka shagun${p.amountEn} seedha humare "${p.goal}" wale sapne mein jaa raha hai. Jab poora hoga, aapko zaroor yaad karenge.\n\nBahut saara pyaar,\n${p.couple}`,
    (p) => `Dear ${p.guest}, aapke blessings ke liye dil se thank you! ${p.echoHinglish}Aapke shagun${p.amountEn} se "${p.goal}" ek kadam aur paas aa gaya.\n\nLove,\n${p.couple}`,
  ],
};

interface NoteParts {
  guest: string;
  couple: string;
  goal: string;
  amountEn: string;
  amountHi: string;
  echoEn: string;
  echoHi: string;
  echoHinglish: string;
}

/** Couple sign-off from "Riya Sharma & Arjun Mehta" -> "Riya & Arjun". */
export function coupleFirstNames(couple: string): string {
  return couple.split('&').map((n) => firstName(n)).filter(Boolean).join(' & ') || couple;
}

export function demoThanks(input: ThanksInput): string {
  const guest = input.guestName.trim() || 'friend';
  const hasMessage = input.message.trim().length > 0;
  const parts: NoteParts = {
    guest,
    couple: coupleFirstNames(input.couple),
    goal: input.goalTitle.trim() || 'our dreams',
    amountEn: input.mentionAmount ? ` and the generous ${formatInr(input.amount)}` : '',
    amountHi: input.mentionAmount ? ` और ${formatInr(input.amount)} के शगुन` : '',
    echoEn: hasMessage ? 'Your message made us smile all day. ' : '',
    echoHi: hasMessage ? 'आपका संदेश पढ़कर हमारा दिन बन गया। ' : '',
    echoHinglish: hasMessage ? 'Aapka message padh ke din ban gaya. ' : '',
  };
  // The Hinglish template reads better with "aapke shagun aur ₹X" than with the English phrase.
  if (input.language === 'hinglish' && input.mentionAmount) parts.amountEn = ` (${formatInr(input.amount)})`;
  return pickBy(NOTES[input.language], guest)(parts);
}

// ---------- story timeline ----------

const YEAR = /\b(19|20)\d{2}\b/;
const MOMENTS: [RegExp, string, string][] = [
  [/propos|engag|ring|roka|sagai/i, '💍', 'The proposal'],
  [/moved|shift|relocat|new city|long[- ]distance/i, '🏙️', 'A new city'],
  [/trip|travel|holiday|vacation/i, '✈️', 'Our first trip'],
  [/famil|parents|met the/i, '🌼', 'Meeting the families'],
  [/dog|cat|pet|puppy/i, '🐶', 'One more member'],
  [/home|flat|house/i, '🏡', 'Our first home'],
];

const TIMELINE_WORDS: Record<NoteLanguage, { met: string; wedding: string; soon: string; weddingText: (a: string, b: string) => string }> = {
  english: { met: 'How we met', wedding: 'Shubh vivah', soon: 'Then', weddingText: (a, b) => `${a} and ${b}, with all of you there. The best chapter starts now.` },
  hinglish: { met: 'Pehli mulaqat', wedding: 'Shubh vivah', soon: 'Phir', weddingText: (a, b) => `${a} aur ${b}, aap sab ke saath. Asli kahani ab shuru hoti hai!` },
  hindi: { met: 'पहली मुलाक़ात', wedding: 'शुभ विवाह', soon: 'फिर', weddingText: (a, b) => `${a} और ${b}, आप सबके आशीर्वाद के साथ। असली कहानी अब शुरू होती है।` },
};

/** Splits the couple's notes into moments and places them between "how we met" and the wedding. */
export function demoMilestones(input: MilestonesInput): SuggestedMilestone[] {
  const a = firstName(input.partner1) || 'One of us';
  const b = firstName(input.partner2) || 'the other';
  const t = TIMELINE_WORDS[input.language];
  const met = meetingClause(input.howWeMet);
  const metText =
    input.language === 'hindi' ? (met ? `हमारी कहानी तब शुरू हुई जब we ${met}.` : `${a} और ${b} की कहानी एक छोटी-सी मुलाक़ात से शुरू हुई।`)
    : input.language === 'hinglish' ? (met ? `Hum ${met}, aur wahi se sab shuru hua.` : `${a} aur ${b} mile, aur baatein kabhi khatam nahi hui.`)
    : met ? sentence(`We ${met}, and that was that`) : `${a} and ${b} met, and neither of us has stopped talking since.`;
  const out: SuggestedMilestone[] = [{ when: input.howWeMet.match(YEAR)?.[0] ?? '', title: t.met, emoji: '✨', text: metText }];
  const parts = input.details
    .split(/[.;\n]|,\s*(?=then\b|and then\b|we\b|in\b|on\b)/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 3);
  for (const part of parts.slice(0, 3)) {
    const rule = MOMENTS.find(([re]) => re.test(part));
    out.push({
      when: part.match(YEAR)?.[0] ?? t.soon,
      title: rule?.[2] ?? pickBy(['A little milestone', 'Growing together', 'One more chapter'], part),
      emoji: rule?.[1] ?? '💛',
      text: sentence(part),
    });
  }
  out.push({ when: '', title: t.wedding, emoji: '🔥', text: t.weddingText(a, b) });
  return out;
}
