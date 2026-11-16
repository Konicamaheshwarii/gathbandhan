import { demoWeddings } from '../../core/data/seed';
import { wedding } from '../../core/testing';
import { showcaseSample } from './home.page';

describe('showcaseSample', () => {
  it('shows Riya & Arjun on the landing page even when another sample is listed first', () => {
    const pages = [wedding({ id: 'mine' }), ...[...demoWeddings()].reverse()].map((w) => ({ wedding: w }));
    expect(pages[1].wedding.slug).not.toBe('riya-weds-arjun');
    expect(showcaseSample(pages)?.wedding.slug).toBe('riya-weds-arjun');
  });

  it('falls back to any sample, and to nothing when there is none', () => {
    const other = demoWeddings().filter((w) => w.slug !== 'riya-weds-arjun').map((w) => ({ wedding: w }));
    expect(showcaseSample(other)?.wedding.demo).toBeTrue();
    expect(showcaseSample([{ wedding: wedding() }])).toBeNull();
  });
});
