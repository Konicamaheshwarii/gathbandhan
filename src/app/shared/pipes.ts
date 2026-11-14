import { Pipe, PipeTransform } from '@angular/core';
import { formatDate, formatDateLong, formatInr, formatInrShort, timeAgo } from '../core/format';

@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined, style: 'full' | 'short' = 'full'): string {
    return style === 'short' ? formatInrShort(value ?? 0) : formatInr(value ?? 0);
  }
}

@Pipe({ name: 'indianDate' })
export class IndianDatePipe implements PipeTransform {
  transform(iso: string | null | undefined, style: 'short' | 'long' = 'short'): string {
    if (!iso) return '';
    return style === 'long' ? formatDateLong(iso) : formatDate(iso);
  }
}

@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  transform(ms: number): string {
    return timeAgo(ms);
  }
}
