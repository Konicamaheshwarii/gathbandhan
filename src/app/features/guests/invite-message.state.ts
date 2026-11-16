import { Injectable, computed, signal } from '@angular/core';
import { guestGreeting, inviteUrl, rsvpLink, shagunLink } from '../../core/guests';
import { Guest, INVITE_LANGUAGES, INVITE_TONES, InviteLanguage, InviteTone, Wedding } from '../../core/models';
import { readJson, writeJson } from '../../core/storage';
import { MSG, inviteMessageTemplate, personaliseInvite } from '../../core/whatsapp-invite';

/** What the couple chose for this wedding's WhatsApp invites, remembered in this browser. */
export interface MessageChoice {
  language: InviteLanguage;
  tone: InviteTone;
  includeShagun: boolean;
  /** Messages the couple edited or had AI rewrite, per language. */
  custom: Partial<Record<InviteLanguage, string>>;
}

export const messageChoiceKey = (weddingId: string) => `sg.inviteMessage.${weddingId}`;

/** Restores a saved choice, ignoring anything unexpected; the invite design's language is the default. */
export function loadChoice(weddingId: string, fallbackLanguage: InviteLanguage): MessageChoice {
  const saved = readJson<Partial<MessageChoice>>(messageChoiceKey(weddingId), {});
  const language = INVITE_LANGUAGES.some((l) => l.id === saved.language) ? saved.language! : fallbackLanguage;
  const tone = INVITE_TONES.includes(saved.tone as InviteTone) ? saved.tone! : 'traditional';
  const custom: MessageChoice['custom'] = {};
  for (const l of INVITE_LANGUAGES) {
    const t = saved.custom?.[l.id];
    if (typeof t === 'string' && t.trim()) custom[l.id] = t;
  }
  return { language, tone, includeShagun: saved.includeShagun === true, custom };
}

/**
 * The guest list's message: language, tone, the optional shagun line and any edits. Each guest
 * gets it in their own language when one is set on them, otherwise in the chosen language.
 */
@Injectable()
export class InviteMessageState {
  private readonly wedding = signal<Wedding | null>(null);
  private readonly choice = signal<MessageChoice>({ language: 'english', tone: 'traditional', includeShagun: false, custom: {} });

  readonly language = computed(() => this.choice().language);
  readonly tone = computed(() => this.choice().tone);
  readonly includeShagun = computed(() => this.choice().includeShagun);
  /** The message (with {name} and the link placeholders) in the chosen language. */
  readonly template = computed(() => this.templateFor(this.language()));
  readonly edited = computed(() => !!this.choice().custom[this.language()]);

  /** Call once the wedding is loaded. */
  init(w: Wedding, fallbackLanguage: InviteLanguage): void {
    this.wedding.set(w);
    this.choice.set(loadChoice(w.id, fallbackLanguage));
  }

  setLanguage(language: InviteLanguage): void {
    this.update({ language });
  }

  /** A new tone redrafts the message from the templates (edits in this language are dropped). */
  setTone(tone: InviteTone): void {
    const custom = { ...this.choice().custom };
    delete custom[this.language()];
    this.update({ tone, custom });
  }

  setIncludeShagun(includeShagun: boolean): void {
    this.update({ includeShagun });
  }

  /** The couple edited the text, or AI rewrote it. */
  setTemplate(text: string): void {
    this.update({ custom: { ...this.choice().custom, [this.language()]: text } });
  }

  resetTemplate(): void {
    const custom = { ...this.choice().custom };
    delete custom[this.language()];
    this.update({ custom });
  }

  templateFor(language: InviteLanguage): string {
    const w = this.wedding();
    if (!w) return '';
    const c = this.choice();
    return c.custom[language] ?? inviteMessageTemplate(w, { language, tone: c.tone, includeShagun: c.includeShagun });
  }

  /** The language a guest's invite is written in. */
  languageFor(g: Pick<Guest, 'language'>): InviteLanguage {
    return g.language ?? this.language();
  }

  /** One guest's finished message, in their language, with their own links. */
  message(g: Pick<Guest, 'name' | 'greeting' | 'token' | 'language'>, language = this.languageFor(g)): string {
    const w = this.wedding();
    if (!w) return '';
    return personaliseInvite(this.templateFor(language), g, this.links(w, g.token), language, this.tone());
  }

  links(w: Wedding, token?: string): { invite: string; rsvp: string; shagun: string } {
    return { invite: inviteUrl(w.slug, token), rsvp: rsvpLink(w.slug), shagun: shagunLink(w.slug) };
  }

  /** For the guest list's greeting column. */
  readonly greeting = guestGreeting;
  readonly placeholders = MSG;

  private update(patch: Partial<MessageChoice>): void {
    const next = { ...this.choice(), ...patch };
    this.choice.set(next);
    const w = this.wedding();
    if (w) writeJson(messageChoiceKey(w.id), next);
  }
}
