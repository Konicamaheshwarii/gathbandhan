import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { AiService } from '../../core/ai/ai.service';
import { MAX_MILESTONES, NOTE_LANGUAGES, NoteLanguage } from '../../core/models';
import { SettingsStore } from '../../core/settings.store';
import { MilestoneForm, milestoneForm } from './wedding-form';

/** "Our story" milestones, typed by hand or drafted by AI (BYO key or the offline writer). */
@Component({
  selector: 'app-story-editor',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <span class="label">Timeline <span class="hint">(optional: how you met, the proposal…)</span></span>
      <span class="spacer"></span>
      <button type="button" class="btn small ai-btn" (click)="open.set(!open())" [attr.aria-expanded]="open()">✨ Draft with AI</button>
    </div>
    @if (open()) {
      <div class="ai-panel stack">
        <label>How did you meet?
          <input type="text" [value]="howWeMet()" (input)="howWeMet.set($any($event.target).value)" placeholder="on a delayed Pune–Delhi train in 2019" /></label>
        <label>Other moments <span class="hint">(one per sentence)</span>
          <textarea rows="2" [value]="details()" (input)="details.set($any($event.target).value)"
                    placeholder="Long distance Pune–Bengaluru in 2021. Proposed on Diwali 2024 on Nani's terrace."></textarea></label>
        <div class="row">
          <div class="row" role="radiogroup" aria-label="Language">
            @for (l of languages; track l.id) {
              <button type="button" role="radio" class="toggle small-toggle" [attr.aria-checked]="language() === l.id" (click)="language.set(l.id)">{{ l.label }}</button>
            }
          </div>
          <button type="button" class="btn primary small" (click)="draft()" [disabled]="busy()">
            @if (busy()) { <span class="spinner" aria-hidden="true"></span> } Draft our timeline
          </button>
        </div>
        <span class="hint">{{ settings.isDemo() ? 'Demo mode: offline templates, no key needed.' : 'Uses your ' + settings.provider() + ' key.' }} Replaces the timeline below.</span>
        @if (error()) { <p class="alert small">{{ error() }}</p> }
      </div>
    }
    <ol class="list">
      @for (m of milestones().controls; track m.controls.id.value; let i = $index) {
        <li class="item" [formGroup]="m">
          <input class="emoji" type="text" formControlName="emoji" maxlength="4" [attr.aria-label]="'Emoji for moment ' + (i + 1)" />
          <div class="fields">
            <div class="two">
              <input type="text" formControlName="when" placeholder="March 2019" [attr.aria-label]="'When, moment ' + (i + 1)" />
              <input type="text" formControlName="title" placeholder="The last cup of chai" [attr.aria-label]="'Title, moment ' + (i + 1)" />
            </div>
            <textarea rows="2" formControlName="text" placeholder="A line or two about it" [attr.aria-label]="'Story, moment ' + (i + 1)"></textarea>
          </div>
          <button type="button" class="icon-btn" (click)="milestones().removeAt(i)" [attr.aria-label]="'Remove moment ' + (i + 1)">✕</button>
        </li>
      }
    </ol>
    <button type="button" class="btn small" (click)="add()" [disabled]="milestones().length >= max">+ Add a moment</button>
  `,
  styles: `
    :host { display: grid; gap: 0.75rem; }
    .label { font-weight: 600; font-size: 0.92rem; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }
    .item { display: grid; grid-template-columns: 3rem minmax(0, 1fr) auto; gap: 0.5rem; align-items: start; }
    .emoji { text-align: center; font-size: 1.3rem !important; padding: 0.45rem 0.2rem !important; }
    .fields { display: grid; gap: 0.4rem; }
    .two { display: grid; grid-template-columns: 1fr 1.6fr; gap: 0.4rem; }
    textarea { min-height: 3.2rem; }
    .icon-btn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface); cursor: pointer; color: var(--bad); }
    .ai-panel { background: color-mix(in srgb, var(--marigold) 8%, var(--surface)); border: 1px dashed var(--marigold); border-radius: 14px; padding: 0.9rem; }
    .small-toggle { min-height: 36px; padding: 0.3rem 0.8rem; font-size: 0.86rem; }
    @media (max-width: 600px) { .two { grid-template-columns: 1fr; } }
  `,
})
export class StoryEditorComponent {
  private readonly ai = inject(AiService);
  protected readonly settings = inject(SettingsStore);

  readonly milestones = input.required<FormArray<MilestoneForm>>();
  readonly partner1 = input('');
  readonly partner2 = input('');

  protected readonly max = MAX_MILESTONES;
  protected readonly languages = NOTE_LANGUAGES;
  protected readonly open = signal(false);
  protected readonly howWeMet = signal('');
  protected readonly details = signal('');
  protected readonly language = signal<NoteLanguage>('english');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected add(): void {
    this.milestones().push(milestoneForm());
  }

  protected async draft(): Promise<void> {
    if (!this.partner1().trim() || !this.partner2().trim()) {
      this.error.set('Add both names first.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const list = await this.ai.draftMilestones({
        partner1: this.partner1(), partner2: this.partner2(), howWeMet: this.howWeMet(), details: this.details(), language: this.language(),
      });
      this.milestones().clear();
      list.slice(0, MAX_MILESTONES).forEach((m) => this.milestones().push(milestoneForm(m)));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
