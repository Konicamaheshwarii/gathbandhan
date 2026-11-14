import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Milestone } from '../../core/models';

/** "Our story" as a short vertical timeline of milestones. */
@Component({
  selector: 'app-story-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="milestones">
      @for (m of milestones(); track m.id) {
        <li>
          <span class="emoji" aria-hidden="true">{{ m.emoji || '💛' }}</span>
          <div>
            @if (m.when) { <p class="when">{{ m.when }}</p> }
            <h3>{{ m.title }}</h3>
            @if (m.text) { <p class="text">{{ m.text }}</p> }
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .milestones { list-style: none; margin: 0.75rem 0 0; padding: 0; display: grid; gap: 0.9rem; }
    li { display: grid; grid-template-columns: 2.4rem minmax(0, 1fr); gap: 0.7rem; align-items: start; }
    .emoji { width: 2.4rem; height: 2.4rem; display: grid; place-items: center; border-radius: 12px; background: var(--surface-2); font-size: 1.2rem; }
    p, h3 { margin: 0; }
    .when { font-size: 0.78rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--marigold-deep); }
    h3 { font-size: 1.05rem; }
    .text { color: var(--muted); font-size: 0.95rem; }
  `,
})
export class StoryTimelineComponent {
  readonly milestones = input.required<Milestone[]>();
}
