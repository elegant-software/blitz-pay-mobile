import type { Language } from '../../../lib/translations';

export type Choice = { language: Language; pending: boolean; revision: number };
export type Preferences = { guest?: Choice; accounts: Record<string, Choice> };
export const emptyPreferences = (): Preferences => ({ accounts: {} });
export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'de';
}
export function parsePreferences(raw: string | null): Preferences {
  if (!raw) return emptyPreferences();
  const data = JSON.parse(raw) as Preferences;
  const valid = (choice: Choice) => choice && isLanguage(choice.language) &&
    typeof choice.pending === 'boolean' && Number.isFinite(choice.revision);
  return {
    guest: data.guest && valid(data.guest) ? data.guest : undefined,
    accounts: Object.fromEntries(Object.entries(data.accounts ?? {}).filter(([, value]) => valid(value))),
  };
}

export function createLanguagePreferencesStore() {
  let state = emptyPreferences();
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    replace: (next: Preferences) => {
      state = next;
      listeners.forEach(listener => listener());
    },
  };
}

export function resolveDefaultLanguage(locales: readonly string[]): Language {
  for (const locale of locales) {
    const base = locale.toLowerCase().split(/[-_]/)[0];
    if (isLanguage(base)) return base;
  }
  return 'de';
}
