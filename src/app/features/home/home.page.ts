import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DEMO_SLUG } from '../../core/data/seed';
import { WeddingRepository } from '../../core/data/wedding.repository';
import { Wedding } from '../../core/models';
import { computeTotals } from '../../core/totals';
import { firstName } from '../../core/util';
import { IndianDatePipe, InrPipe } from '../../shared/pipes';
import { ToranComponent } from '../../shared/toran.component';

interface PageSummary {
  wedding: Wedding;
  names: string;
  raised: number;
  target: number;
  percent: number;
  count: number;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, InrPipe, IndianDatePipe, ToranComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly repo = inject(WeddingRepository);

  protected readonly demoSlug = DEMO_SLUG;
  protected readonly pages = signal<PageSummary[]>([]);
  protected readonly demo = computed(() => this.pages().find((p) => p.wedding.demo) ?? null);
  protected readonly mine = computed(() => this.pages().filter((p) => !p.wedding.demo && !p.wedding.imported));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const weddings = await this.repo.listWeddings();
    const rows = await Promise.all(
      weddings.map(async (wedding): Promise<PageSummary> => {
        const list = await this.repo.listContributions(wedding.id);
        const t = computeTotals(wedding, list);
        return {
          wedding,
          names: `${firstName(wedding.partner1)} & ${firstName(wedding.partner2)}`,
          raised: t.raised,
          target: t.target,
          percent: t.percent,
          count: list.length,
        };
      }),
    );
    this.pages.set(rows);
  }
}
