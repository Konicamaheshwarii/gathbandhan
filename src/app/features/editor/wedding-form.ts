import { AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { parseIsoDate } from '../../core/format';
import { COVER_PRESETS, CoverPreset, Goal, MAX_GOALS, MIN_GOALS, Wedding } from '../../core/models';
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

export type WeddingForm = FormGroup<{
  partner1: FormControl<string>;
  partner2: FormControl<string>;
  date: FormControl<string>;
  venue: FormControl<string>;
  city: FormControl<string>;
  preset: FormControl<CoverPreset>;
  coverImage: FormControl<string>;
  story: FormControl<string>;
  upiId: FormControl<string>;
  payeeName: FormControl<string>;
  showAmounts: FormControl<boolean>;
  goals: FormArray<GoalForm>;
}>;

export const GOAL_EMOJIS = ['🌍', '🏡', '🌸', '🗾', '🏝️', '🌴', '⛰️', '✈️', '🚗', '🛋️', '🎓', '🐶', '🌳', '🪴', '🎵', '📷', '💍', '🎁'];

export const vpaValidator: ValidatorFn = (c: AbstractControl<string>): ValidationErrors | null =>
  !c.value || isValidVpa(c.value) ? null : { vpa: true };

export const isoDateValidator: ValidatorFn = (c: AbstractControl<string>): ValidationErrors | null =>
  !c.value || parseIsoDate(c.value) ? null : { date: true };

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
    upiId: new FormControl(w?.upiId ?? '', { nonNullable: true, validators: [Validators.required, vpaValidator] }),
    payeeName: text(w?.payeeName ?? '', 60, true),
    showAmounts: new FormControl(w?.showAmounts ?? false, { nonNullable: true }),
    goals: new FormArray((w?.goals ?? [{}, {}]).map((g) => goalForm(g)), goalCountValidator),
  });
}

/** Turns valid form values into a Wedding, keeping identity fields from the original on edit. */
export function toWedding(form: WeddingForm, original?: Wedding | null): Wedding {
  const v = form.getRawValue();
  const preset = COVER_PRESETS.includes(v.preset) ? v.preset : 'marigold';
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
    upiId: normalizeVpa(v.upiId),
    payeeName: v.payeeName.trim(),
    showAmounts: v.showAmounts,
    goals: v.goals.map((g) => ({
      id: g.id,
      title: g.title.trim(),
      target: Math.round(g.target ?? 0),
      emoji: g.emoji,
      ...(g.description.trim() ? { description: g.description.trim() } : {}),
      ...(g.imageUrl ? { imageUrl: g.imageUrl } : {}),
    })),
  };
}


