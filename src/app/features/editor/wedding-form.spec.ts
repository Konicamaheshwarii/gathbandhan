import { wedding } from '../../core/testing';
import { goalForm, toWedding, weddingForm } from './wedding-form';

describe('wedding form', () => {
  it('starts with two empty dreams and is invalid', () => {
    const form = weddingForm();
    expect(form.controls.goals.length).toBe(2);
    expect(form.valid).toBeFalse();
  });

  it('validates the UPI ID, date and goal count', () => {
    const form = weddingForm(wedding());
    expect(form.valid).toBeTrue();
    form.controls.upiId.setValue('asha at okaxis');
    expect(form.controls.upiId.hasError('vpa')).toBeTrue();
    form.controls.date.setValue('2026-02-31');
    expect(form.controls.date.hasError('date')).toBeTrue();
    form.controls.goals.removeAt(0);
    expect(form.controls.goals.hasError('minGoals')).toBeTrue();
    for (let i = 0; i < 5; i++) form.controls.goals.push(goalForm({ title: 'x', target: 5000 }));
    expect(form.controls.goals.hasError('maxGoals')).toBeTrue();
  });

  it('requires a target of at least ₹1,000', () => {
    const g = goalForm({ title: 'Trip', target: 500 });
    expect(g.controls.target.hasError('min')).toBeTrue();
  });

  it('round-trips a wedding and keeps identity on edit', () => {
    const original = wedding({ cover: { preset: 'peacock', imageUrl: 'data:image/jpeg;base64,AA' } });
    const form = weddingForm(original);
    form.controls.partner1.setValue('  Asha R. ');
    form.controls.upiId.setValue(' Asha.Dev@OkAxis ');
    const out = toWedding(form, original);
    expect(out.id).toBe(original.id);
    expect(out.slug).toBe(original.slug);
    expect(out.partner1).toBe('Asha R.');
    expect(out.upiId).toBe('asha.dev@okaxis');
    expect(out.cover).toEqual(original.cover);
    expect(out.goals.map((g) => g.target)).toEqual([300000, 50000]);
  });

  it('derives a slug for a new page', () => {
    const form = weddingForm(wedding());
    expect(toWedding(form, null).slug).toBe('asha-weds-dev');
  });
});
