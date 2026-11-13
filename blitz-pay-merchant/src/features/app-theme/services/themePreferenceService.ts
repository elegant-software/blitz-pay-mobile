import { storage } from '../../../lib/storage';
import { observability } from '../../../lib/observability';
import type { ThemeMode } from '../store/themeStore';

let pendingWrite = Promise.resolve();

export async function readThemePreference(): Promise<ThemeMode | null> {
  try {
    const value = await storage.getItem('merchant_theme');
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    observability.warn('theme_preference_read_failed');
    return null;
  }
}

export function writeThemePreference(value: ThemeMode) {
  pendingWrite = pendingWrite
    .then(() => storage.setItem('merchant_theme', value))
    .catch(() => observability.warn('theme_preference_write_failed'));
}
