import { requestLanguageSettings, LanguageSettingsError } from '../services/languageSettingsService';
import { observability } from '../../../lib/observability';

jest.mock('../../../lib/config', () => ({ config: { apiUrl: 'https://api.test/' } }));
jest.mock('../../../lib/observability', () => ({ observability: { info: jest.fn(), error: jest.fn() } }));
const request = jest.fn();
beforeEach(() => {
  global.fetch = request;
  request.mockReset();
  jest.clearAllMocks();
});

test('updates only this app preference with the captured originating token', async () => {
  request.mockResolvedValue(new Response(JSON.stringify({ shopperAppLanguage: 'de', merchantAppLanguage: 'en' })));
  await requestLanguageSettings('originating-token', 'de');
  expect(request).toHaveBeenCalledWith('https://api.test/v1/user-settings', {
    method: 'PATCH', signal: expect.any(AbortSignal), headers: { Authorization: 'Bearer originating-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ shopperAppLanguage: 'de' }),
  });
});

test('reads only this app preference', async () => {
  request.mockResolvedValue(new Response(JSON.stringify({ shopperAppLanguage: 'de', merchantAppLanguage: 'en' })));
  expect(await requestLanguageSettings('token')).toBe('de');
});

test('preserves and logs backend detail before throwing a typed error', async () => {
  request.mockResolvedValue(new Response(JSON.stringify({ detail: 'Please sign in again' }), { status: 401 }));
  await expect(requestLanguageSettings('token', 'de')).rejects.toMatchObject({
    detail: 'Please sign in again', status: 401, i18nKey: 'language_save_failed',
  });
  expect(observability.error).toHaveBeenCalledWith('language_settings_failed', {
    method: 'PATCH', status: 401, reason: 'Please sign in again',
  });
});

test('network failures throw a translated domain error without logging credentials', async () => {
  request.mockRejectedValue(new Error('Network unavailable'));
  await expect(requestLanguageSettings('secret-token', 'en')).rejects.toBeInstanceOf(LanguageSettingsError);
  expect(JSON.stringify(jest.mocked(observability.error).mock.calls)).not.toContain('secret-token');
});

