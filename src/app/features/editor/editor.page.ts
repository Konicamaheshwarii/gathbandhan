import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { GoalSuggestions, STORY_TONES, StoryTone, SuggestedGoal } from '../../core/ai/ai.models';
import { AiService } from '../../core/ai/ai.service';
import { WeddingRepository } from '../../core/data/wedding.repository';
import { formatInr } from '../../core/format';
import { COVER_PRESETS, CoverPreset, MAX_GOALS, NOTE_LANGUAGES, NoteLanguage, Wedding } from '../../core/models';
import { SettingsStore } from '../../core/settings.store';
import { expectedShagun } from '../../core/totals';
import { resizeImage } from '../../shared/image';
import { InrPipe } from '../../shared/pipes';
import { ToastService } from '../../shared/toast.service';
import { EventsEditorComponent } from './events-editor.component';
import { GalleryEditorComponent } from './gallery-editor.component';
import { StoryEditorComponent } from './story-editor.component';
import { GOAL_EMOJIS, goalForm, toWedding, weddingForm } from './wedding-form';

@Component({
  selector: 'app-editor',
  imports: [ReactiveFormsModule, RouterLink, InrPipe, EventsEditorComponent, StoryEditorComponent, GalleryEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editor.page.html',
  styleUrl: './editor.page.scss',
})
export class EditorPage {
  private readonly repo = inject(WeddingRepository);
  private readonly router = inject(Router);
  private readonly ai = inject(AiService);
  private readonly toast = inject(ToastService);
  protected readonly settings = inject(SettingsStore);

  /** Present on /w/:slug/edit, absent on /create. */
  readonly slug = input<string>();

  protected readonly form = weddingForm();
  protected readonly original = signal<Wedding | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly submitted = signal(false);

  protected readonly presets = COVER_PRESETS;
  protected readonly emojis = GOAL_EMOJIS;
  protected readonly maxGoals = MAX_GOALS;
  protected readonly tones = STORY_TONES;
  protected readonly languages = NOTE_LANGUAGES;
  protected readonly backend = this.repo.mode === 'supabase';

  /** Form values as a signal so totals and previews recompute. */
  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });
  protected readonly goalsTotal = computed(() => {
    this.value();
    return this.form.controls.goals.controls.reduce((t, g) => t + (g.controls.target.value ?? 0), 0);
  });

  // ---------- AI: story ----------
  protected readonly storyHelperOpen = signal(false);
  protected readonly howWeMet = signal('');
  protected readonly storyDetails = signal('');
  protected readonly tone = signal<StoryTone>('warm');
  protected readonly storyLanguage = signal<NoteLanguage>('english');
  protected readonly storyBusy = signal(false);
  protected readonly storyError = signal('');

  // ---------- AI: goals ----------
  protected readonly goalsHelperOpen = signal(false);
  protected readonly plans = signal('');
  protected readonly guests = signal(200);
  protected readonly averageShagun = signal(2100);
  protected readonly suggestBusy = signal(false);
  protected readonly suggestError = signal('');
  protected readonly suggestions = signal<GoalSuggestions | null>(null);
  protected readonly expected = computed(() => expectedShagun(this.guests(), this.averageShagun()));
  protected readonly reach = computed(() => {
    const total = this.goalsTotal();
    const expected = this.expected();
    return total > 0 && expected > 0 ? Math.round((expected / total) * 100) : 0;
  });

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug) untracked(() => void this.load(slug));
    });
  }

  private async load(slug: string): Promise<void> {
    this.loading.set(true);
    const w = await this.repo.getWeddingBySlug(slug);
    this.original.set(w);
    if (w) {
      const fresh = weddingForm(w);
      // patchValue cannot add rows, so the arrays are rebuilt from the loaded wedding first.
      for (const key of ['goals', 'events', 'milestones', 'gallery'] as const) {
        const target = this.form.controls[key] as unknown as FormArray<AbstractControl>;
        target.clear();
        (fresh.controls[key] as unknown as FormArray<AbstractControl>).controls.forEach((c) => target.push(c));
      }
      this.form.patchValue(fresh.getRawValue());
      this.plans.set(w.goals.map((g) => g.title).join(', '));
    }
    this.loading.set(false);
  }

  protected get goals() {
    return this.form.controls.goals;
  }

  protected inr(n: number | null): string {
    return n ? formatInr(n) : '';
  }

  protected fillSample(): void {
    this.form.patchValue({
      partner1: 'Ananya Iyer',
      partner2: 'Kabir Malhotra',
      date: '2027-02-14',
      venue: 'The Leela Palace',
      city: 'Bengaluru',
      upiId: 'ananya.kabir@demo',
      payeeName: 'Ananya Iyer',
    });
    this.howWeMet.set('we met at a friend’s Diwali party in Koramangala and talked about dosa for three hours');
    this.storyDetails.set('Kabir cooks, Ananya plans. We are moving to Pune next year.');
    this.plans.set('honeymoon in Japan, down payment for a flat in Pune, and a dog');
    this.storyHelperOpen.set(true);
    this.goalsHelperOpen.set(true);
  }

  protected choosePreset(p: CoverPreset): void {
    this.form.controls.preset.setValue(p);
    this.form.controls.coverImage.setValue('');
  }

  protected async uploadCover(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      this.form.controls.coverImage.setValue(await resizeImage(file, 1200));
    } catch (e) {
      this.toast.show((e as Error).message);
    }
  }

  protected async uploadGoalImage(index: number, event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      this.goals.at(index).controls.imageUrl.setValue(await resizeImage(file, 400, 0.75));
    } catch (e) {
      this.toast.show((e as Error).message);
    }
  }

  protected addGoal(g?: Partial<SuggestedGoal>): void {
    if (this.goals.length >= MAX_GOALS) {
      this.toast.show(`Up to ${MAX_GOALS} dreams. Remove one first.`);
      return;
    }
    // Replace an untouched empty row before adding a new one.
    const empty = this.goals.controls.findIndex((c) => !c.controls.title.value && !c.controls.target.value);
    if (g && empty >= 0) this.goals.at(empty).patchValue({ ...g, imageUrl: '' });
    else this.goals.push(goalForm(g));
  }

  protected removeGoal(index: number): void {
    this.goals.removeAt(index);
  }

  protected moveGoal(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= this.goals.length) return;
    const ctrl = this.goals.at(index);
    this.goals.removeAt(index, { emitEvent: false });
    this.goals.insert(target, ctrl);
  }

  // ---------- AI ----------

  protected async writeStory(): Promise<void> {
    const v = this.form.getRawValue();
    if (!v.partner1.trim() || !v.partner2.trim()) {
      this.storyError.set('Add both names first.');
      return;
    }
    this.storyBusy.set(true);
    this.storyError.set('');
    try {
      await this.ai.writeStory(
        { partner1: v.partner1, partner2: v.partner2, howWeMet: this.howWeMet(), details: this.storyDetails(), tone: this.tone(), language: this.storyLanguage() },
        (text) => this.form.controls.story.setValue(text.slice(0, 1200)),
      );
    } catch (e) {
      this.storyError.set((e as Error).message);
    } finally {
      this.storyBusy.set(false);
    }
  }

  protected async suggestGoals(): Promise<void> {
    this.suggestBusy.set(true);
    this.suggestError.set('');
    try {
      this.suggestions.set(
        await this.ai.suggestGoals({ plans: this.plans(), city: this.form.controls.city.value, guests: this.guests(), averageShagun: this.averageShagun() }),
      );
    } catch (e) {
      this.suggestError.set((e as Error).message);
    } finally {
      this.suggestBusy.set(false);
    }
  }

  protected useAllSuggestions(): void {
    const s = this.suggestions();
    if (!s) return;
    this.goals.clear();
    s.goals.slice(0, MAX_GOALS).forEach((g) => this.goals.push(goalForm(g)));
    this.toast.show(`${s.goals.length} dreams added. Adjust the amounts as you like.`);
  }

  // ---------- save ----------

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      queueMicrotask(() => document.querySelector<HTMLElement>('.ng-invalid:not(form):not([formArrayName])')?.focus());
      return;
    }
    this.saving.set(true);
    this.saveError.set('');
    try {
      const saved = await this.repo.saveWedding(toWedding(this.form, this.original()));
      this.toast.show(this.original() ? 'Changes saved' : 'Your page is ready. Share it with your family!');
      await this.router.navigate(['/w', saved.slug, 'dashboard']);
    } catch (e) {
      this.saveError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  protected async deletePage(): Promise<void> {
    const w = this.original();
    if (!w || !confirm('Delete this wedding page and all its contributions from this browser?')) return;
    await this.repo.deleteWedding(w.id);
    this.toast.show('Page deleted');
    await this.router.navigate(['/']);
  }
}
