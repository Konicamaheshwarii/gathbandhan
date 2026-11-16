import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  const KEY = 'sg.settings';
  let before: string | null;

  beforeEach(() => {
    before = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    if (before === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, before);
  });

  const saved = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');

  it('saves a change straight away, so an immediate reload keeps it', () => {
    const store = TestBed.inject(SettingsStore);
    store.update({ allowCloudAi: false });
    // No change detection or effect flush has run yet.
    expect(saved().allowCloudAi).toBeFalse();
  });

  it('saves keys and models straight away too', () => {
    const store = TestBed.inject(SettingsStore);
    store.setKey('groq', 'test-key');
    store.setModel('gemini', 'gemini-2.5-pro');
    expect(saved().apiKeys.groq).toBe('test-key');
    expect(saved().models.gemini).toBe('gemini-2.5-pro');
  });
});
