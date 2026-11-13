export type ThemeMode = 'light' | 'dark';

let preference: ThemeMode | null = null;
const listeners = new Set<() => void>();

export const themeStore = {
  getSnapshot: () => preference,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setPreference(value: ThemeMode) {
    preference = value;
    listeners.forEach((listener) => listener());
  },
};
