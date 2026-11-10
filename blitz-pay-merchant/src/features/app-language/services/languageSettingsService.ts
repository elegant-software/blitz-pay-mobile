import { config } from '../../../lib/config';
import { readApiError } from '../../../lib/apiError';
import { observability } from '../../../lib/observability';
import type { Language } from '../../../lib/translations';

export class LanguageSettingsError extends Error {
  readonly i18nKey = 'language_save_failed';
  constructor(public readonly detail?: string, public readonly status?: number) {
    super('language_save_failed');
  }
}

export async function requestLanguageSettings(token: string, language?: Language): Promise<Language | undefined> {
  const method = language ? 'PATCH' : 'GET';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  observability.info('language_settings_started', { method });
  try {
    // Use the originating session, never a mutable global session during account switching.
    const response = await fetch(`${config.apiUrl.replace(/\/+$/, '')}/v1/user-settings`, {
      method,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: language ? JSON.stringify({ merchantAppLanguage: language }) : undefined,
    });
    if (!response.ok) {
      const detail = await readApiError(response);
      observability.error('language_settings_failed', { method, status: response.status, reason: detail });
      throw new LanguageSettingsError(detail, response.status);
    }
    const data = await response.json() as { merchantAppLanguage?: unknown };
    const value = data.merchantAppLanguage;
    if (value != null && value !== 'en' && value !== 'de') {
      observability.error('language_settings_failed', { method, reason: 'unsupported_language', status: response.status });
      throw new LanguageSettingsError();
    }
    observability.info('language_settings_completed', { method });
    return value === 'en' || value === 'de' ? value : undefined;
  } catch (error) {
    if (error instanceof LanguageSettingsError) throw error;
    observability.error('language_settings_failed', { method, reason: error instanceof Error ? error.message : String(error) });
    throw new LanguageSettingsError();
  } finally {
    clearTimeout(timeout);
  }
}

