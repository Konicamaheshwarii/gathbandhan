import { AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { parseIsoDate } from '../../core/format';
import {
  COVER_PRESETS, CoverPreset, EVENT_META, EventKind, GalleryPhoto, Goal, MAX_GOALS, MIN_GOALS, Milestone, Wedding, WeddingEvent,
} from '../../core/models';
import { isValidVpa, normalizeVpa } from '../../core/upi';
import { uid, weddingSlug } from '../../core/util';

export type GoalForm = FormGroup<{
  id: FormControl<string>;
  title: FormControl<string>;
  target: FormControl<number | null>;
  emoji: FormControl<string>;
  description: FormControl<string>;
  imageUrl: FormControl<string>;
}>;

export type EventForm = FormGroup<{
  id: FormControl<string>;
  kind: FormControl<EventKind>;
  name: FormControl<string>;
  date: FormControl<string>;
  time: FormControl<string>;
  endTime: FormControl<string>;
  venue: FormControl<string>;
  address: FormControl<string>;
  mapsUrl: FormControl<string>;
  dressCode: FormControl<string>;
}>;

export type MilestoneForm = FormGroup<{
  id: FormControl<string>;
  when: FormControl<string>;
  title: FormControl<string>;
  text: FormControl<string>;
  emoji: FormControl<string>;
}>;

export type PhotoForm = FormGroup<{
  id: FormControl<string>;
  url: FormControl<string>;
  caption: FormControl<string>;
}>;

export type WeddingForm = FormGroup<{
  partner1: FormControl<string>;
  partner2: FormControl<string>;
  date: FormControl<string>;
  venue: FormControl<string>;
  city: FormControl<string>;
  preset: FormControl<CoverPreset>;
  coverImage: FormControl<string>;
  story: FormControl<string>;
  brideParents: FormControl<string>;
  groomParents: FormControl<string>;
  upiId: FormControl<string>;
  payeeName: FormControl<string>;
  showAmounts: FormControl<boolean>;
  goals: FormArray<GoalForm>;
  events: FormArray<EventForm>;
  milestones: FormArray<MilestoneForm>;
  gallery: FormArray<PhotoForm>;
}>;

export const GOAL_EMOJIS = ['🌍', '🏡', '🌸', '🗾', '🏝️', '🌴', '⛰️', '✈️', '🚗', '🛋️', '🎓', '🐶', '🌳', '🪴', '🎵', '📷', '💍', '🎁'];

export const vpaValidator: ValidatorFn = (c: AbstractControl<string>): ValidationErrors | null =>
  !c.value || isValidVpa(c.value) ? null : { vpa: true };

export const isoDateValidator: ValidatorFn = (c: AbstractControl<string>): ValidationErrors | null =>
  !c.value || parseIsoDate(c.value) ? null : { date: true };

export const urlValidator: ValidatorFn = (c: AbstractControl<string>): ValidationErrors | null =>
  !c.value || /^https?:\/\/\S+$/i.test(c.value.trim()) ? null : { url: true };

export const goalCountValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const n = (c as FormArray).length;
  return n < MIN_GOALS ? { minGoals: MIN_GOALS } : n > MAX_GOALS ? { maxGoals: MAX_GOALS } : null;
};

const text = (value: string, max: number, required = false) =>
  new FormControl(value, { nonNullable: true, validators: [...(required ? [Validators.required] : []), Validators.maxLength(max)] });

export function goalForm(goal: Partial<Goal> = {}): GoalForm {
  return new FormGroup({
    id: new FormControl(goal.id ?? uid('g'), { nonNullable: true }),
    title: text(goal.title ?? '', 60, true),
    target: new FormControl<number | null>(goal.target ?? null, [Validators.required, Validators.min(1000), Validators.max(1_00_00_000)]),
    emoji: new FormControl(goal.emoji ?? '🎁', { nonNullable: true }),
    description: text(goal.description ?? '', 160),
    imageUrl: new FormControl(goal.imageUrl ?? '', { nonNullable: true }),
  });
}

export function eventForm(e: Partial<WeddingEvent> = {}): EventForm {
  const kind = e.kind ?? 'wedding';
  return new FormGroup({
    id: new FormControl(e.id ?? uid('e'), { nonNullable: true }),
    kind: new FormControl<EventKind>(kind, { nonNullable: true }),
    name: text(e.name ?? EVENT_META[kind].label, 60, true),
    date: new FormControl(e.date ?? '', { nonNullable: true, validators: [Validators.required, isoDateValidator] }),
    time: new FormControl(e.time ?? '18:00', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/)] }),
    endTime: new FormControl(e.endTime ?? '', { nonNullable: true, validators: [Validators.pattern(/^(\d{2}:\d{2})?$/)] }),
    venue: text(e.venue ?? '', 120, true),
    address: text(e.address ?? '', 200),
    mapsUrl: new FormControl(e.mapsUrl ?? '', { nonNullable: true, validators: [urlValidator, Validators.maxLength(500)] }),
    dressCode: text(e.dressCode ?? '', 120),
  });
}

export function milestoneForm(m: Partial<Milestone> = {}): MilestoneForm {
  return new FormGroup({
    id: new FormControl(m.id ?? uid('m'), { nonNullable: true }),
    when: text(m.when ?? '', 40),
    title: text(m.title ?? '', 80, true),
    text: text(m.text ?? '', 300),
    emoji: new FormControl(m.emoji ?? '💛', { nonNullable: true }),
  });
}

export function photoForm(p: Partial<GalleryPhoto> = {}): PhotoForm {
  return new FormGroup({
    id: new FormControl(p.id ?? uid('p'), { nonNullable: true }),
    url: new FormControl(p.url ?? '', { nonNullable: true }),
    caption: text(p.caption ?? '', 80),
  });
}

export function weddingForm(w?: Wedding): WeddingForm {
  return new FormGroup({
    partner1: text(w?.partner1 ?? '', 60, true),
    partner2: text(w?.partner2 ?? '', 60, true),
    date: new FormControl(w?.date ?? '', { nonNullable: true, validators: [Validators.required, isoDateValidator] }),
    venue: text(w?.venue ?? '', 120, true),
    city: text(w?.city ?? '', 60),
    preset: new FormControl<CoverPreset>(w?.cover.preset ?? 'marigold', { nonNullable: true }),
    coverImage: new FormControl(w?.cover.imageUrl ?? '', { nonNullable: true }),
    story: text(w?.story ?? '', 1200),
    brideParents: text(w?.families?.bride ?? '', 120),
    groomParents: text(w?.families?.groom ?? '', 120),
    upiId: new FormControl(w?.upiId ?? '', { nonNullable: true, validators: [Validators.required, vpaValidator] }),
    payeeName: text(w?.payeeName ?? '', 60, true),
    showAmounts: new FormControl(w?.showAmounts ?? false, { nonNullable: true }),
    goals: new FormArray((w?.goals ?? [{}, {}]).map((g) => goalForm(g)), goalCountValidator),
    events: new FormArray((w?.events ?? []).map((e) => eventForm(e))),
    milestones: new FormArray((w?.milestones ?? []).map((m) => milestoneForm(m))),
    gallery: new FormArray((w?.gallery ?? []).map((p) => photoForm(p))),
  });
}

const opt = <K extends string>(key: K, value: string) => (value.trim() ? ({ [key]: value.trim() } as Record<K, string>) : {});

/** Turns valid form values into a Wedding, keeping identity fields and goal updates from the original. */
export function toWedding(form: WeddingForm, original?: Wedding | null): Wedding {
  const v = form.getRawValue();
  const preset = COVER_PRESETS.includes(v.preset) ? v.preset : 'marigold';
  const updates = new Map((original?.goals ?? []).map((g) => [g.id, g.updates]));
  return {
    id: original?.id ?? uid('w'),
    slug: original?.slug ?? weddingSlug(v.partner1, v.partner2),
    createdAt: original?.createdAt ?? Date.now(),
    demo: original?.demo,
    partner1: v.partner1.trim(),
    partner2: v.partner2.trim(),
    date: v.date,
    venue: v.venue.trim(),
    city: v.city.trim(),
    cover: { preset, ...(v.coverImage ? { imageUrl: v.coverImage } : {}) },
    story: v.story.trim(),
    families: { ...opt('bride', v.brideParents), ...opt('groom', v.groomParents) },
    upiId: normalizeVpa(v.upiId),
    payeeName: v.payeeName.trim(),
    showAmounts: v.showAmounts,
    // Set on the "How guests pay" page; the editor keeps them as they are.
    ...(original?.paymentMode ? { paymentMode: original.paymentMode } : {}),
    ...(original?.feeBearer ? { feeBearer: original.feeBearer } : {}),
    ...(original?.razorpayActive ? { razorpayActive: original.razorpayActive } : {}),
    goals: v.goals.map((g) => ({
      id: g.id,
      title: g.title.trim(),
      target: Math.round(g.target ?? 0),
      emoji: g.emoji,
      ...opt('description', g.description),
      ...(g.imageUrl ? { imageUrl: g.imageUrl } : {}),
      ...(updates.get(g.id)?.length ? { updates: updates.get(g.id) } : {}),
    })),
    events: v.events.map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name.trim() || EVENT_META[e.kind].label,
      date: e.date,
      time: e.time,
      venue: e.venue.trim(),
      ...opt('endTime', e.endTime),
      ...opt('address', e.address),
      ...opt('mapsUrl', e.mapsUrl),
      ...opt('dressCode', e.dressCode),
    })),
    milestones: v.milestones.map((m) => ({ id: m.id, when: m.when.trim(), title: m.title.trim(), text: m.text.trim(), emoji: m.emoji || '💛' })),
    gallery: v.gallery.filter((p) => p.url).map((p) => ({ id: p.id, url: p.url, ...opt('caption', p.caption) })),
  };
}
