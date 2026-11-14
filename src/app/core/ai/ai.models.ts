import { NoteLanguage } from '../models';

export type StoryTone = 'warm' | 'playful' | 'poetic';
export const STORY_TONES: StoryTone[] = ['warm', 'playful', 'poetic'];

export interface StoryInput {
  partner1: string;
  partner2: string;
  howWeMet: string;
  /** Anything else: what they love, where they are moving, inside jokes. */
  details: string;
  tone: StoryTone;
  language: NoteLanguage;
}

export interface GoalsInput {
  /** Free text: "honeymoon in Japan, saving for a flat in Pune, maybe a dog". */
  plans: string;
  city: string;
  guests: number;
  /** Typical shagun per guest (or family) in rupees. */
  averageShagun: number;
}

export interface SuggestedGoal {
  title: string;
  target: number;
  emoji: string;
  description: string;
}

export interface GoalSuggestions {
  goals: SuggestedGoal[];
  tip: string;
}

export interface ThanksInput {
  couple: string;
  guestName: string;
  amount: number;
  goalTitle: string;
  message: string;
  language: NoteLanguage;
  /** Mention the amount in the note (many families prefer not to). */
  mentionAmount: boolean;
}

export interface MilestonesInput {
  partner1: string;
  partner2: string;
  howWeMet: string;
  /** Free text: "engaged Diwali 2024 on Nani's terrace, moved to Pune in 2022". */
  details: string;
  language: NoteLanguage;
}

export interface SuggestedMilestone {
  when: string;
  title: string;
  text: string;
  emoji: string;
}
