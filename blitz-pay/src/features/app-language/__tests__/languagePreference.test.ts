import React from 'react';
import { useLanguagePreference } from '../hooks/useLanguagePreference';
import { requestLanguageSettings, LanguageSettingsError } from '../services/languageSettingsService';
import { storage } from '../../../lib/storage';
import type { Language } from '../../../lib/translations';

const { act, create } = require('react-test-renderer');
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) } }));
jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })) }));
jest.mock('../../../lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn() } }));
jest.mock('../../../lib/observability', () => ({ observability: { warn: jest.fn() } }));
jest.mock('../services/languageSettingsService', () => {
  class LanguageSettingsError extends Error { detail?: string; constructor(detail?: string) { super('failed'); this.detail = detail; } }
  return { requestLanguageSettings: jest.fn(), LanguageSettingsError };
});

const request = requestLanguageSettings as jest.MockedFunction<typeof requestLanguageSettings>;
let result: ReturnType<typeof useLanguagePreference>;
let tree: ReturnType<typeof create>;
function Probe({ account = null, token = null, fallback = 'de' }: {
  account?: string | null; token?: string | null; fallback?: Language;
}) {
  result = useLanguagePreference(account, token, fallback);
  return null;
}
async function render(props: React.ComponentProps<typeof Probe> = {}) {
  await act(async () => { tree = create(React.createElement(Probe, props)); });
}
async function update(props: React.ComponentProps<typeof Probe>) {
  await act(async () => { tree.update(React.createElement(Probe, props)); });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  (storage.getItem as jest.Mock).mockResolvedValue(null);
  (storage.setItem as jest.Mock).mockResolvedValue(undefined);
  request.mockResolvedValue(undefined);
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('inferred defaults follow changes and are never saved', async () => {
  await render({ fallback: 'en' });
  expect(result.language).toBe('en');
  await update({ fallback: 'de' });
  expect(result.language).toBe('de');
  expect(request).not.toHaveBeenCalled();
  expect(storage.setItem).not.toHaveBeenCalled();
});

test('signed-out explicit choice survives restart and overrides inferred defaults', async () => {
  await render();
  await act(async () => result.setLanguage('en'));
  const saved = (storage.setItem as jest.Mock).mock.calls.at(-1)[1];
  await act(async () => tree.unmount());
  (storage.getItem as jest.Mock).mockResolvedValue(saved);
  await render({ fallback: 'de' });
  expect(result.language).toBe('en');
  expect(request).not.toHaveBeenCalled();
});

test('existing backend preference wins over signed-out choice', async () => {
  await render();
  await act(async () => result.setLanguage('de'));
  request.mockResolvedValue('en');
  await update({ account: 'A', token: 'token-A' });
  expect(result.language).toBe('en');
  expect(request.mock.calls).toEqual([['token-A']]);
});

test('absent backend preference adopts only an explicit signed-out choice', async () => {
  await render();
  await act(async () => result.setLanguage('en'));
  await update({ account: 'A', token: 'token-A' });
  expect(request.mock.calls).toEqual([['token-A'], ['token-A', 'en']]);
});

test('offline choice is immediate, retains error detail, and retries on connectivity', async () => {
  const network = require('expo-network');
  await render({ account: 'A', token: 'token-A' });
  request.mockRejectedValueOnce(new LanguageSettingsError('Unavailable'));
  await act(async () => result.setLanguage('en'));
  expect(result.language).toBe('en');
  expect(result.languageSaveError?.detail).toBe('Unavailable');
  await act(async () => network.addNetworkStateListener.mock.calls.at(-1)[0]({ isConnected: true }));
  expect(request.mock.calls.at(-1)).toEqual(['token-A', 'en']);
  expect(result.languageSaveError).toBeNull();
});

test('newest choice is sent after an older request, never overwritten by its completion', async () => {
  await render({ account: 'A', token: 'token-A' });
  const first = deferred<Language | undefined>();
  request.mockImplementationOnce(() => first.promise);
  await act(async () => result.setLanguage('en'));
  await act(async () => result.setLanguage('de'));
  expect(result.language).toBe('de');
  await act(async () => first.resolve('en'));
  expect(result.language).toBe('de');
  expect(request.mock.calls.filter(call => call.length === 2)).toEqual([['token-A', 'en'], ['token-A', 'de']]);
});

test('an old account pending save never uses another account token or changes its UI', async () => {
  await render({ account: 'A', token: 'token-A' });
  const pending = deferred<Language | undefined>();
  request.mockImplementationOnce(() => pending.promise);
  await act(async () => result.setLanguage('en'));
  request.mockResolvedValue('de');
  await update({ account: 'B', token: 'token-B' });
  expect(result.language).toBe('de');
  await act(async () => pending.resolve('en'));
  expect(result.language).toBe('de');
  expect(request.mock.calls).not.toContainEqual(['token-B', 'en']);
  await update({ account: 'A', token: 'new-token-A' });
  expect(request.mock.calls).toContainEqual(['new-token-A', 'en']);
});

test('stale hydration cannot replace a later explicit choice', async () => {
  const pending = deferred<Language | undefined>();
  request.mockImplementationOnce(() => pending.promise);
  await render({ account: 'A', token: 'token-A' });
  await act(async () => result.setLanguage('de'));
  await act(async () => pending.resolve('en'));
  expect(result.language).toBe('de');
  expect(request.mock.calls).toContainEqual(['token-A', 'de']);
});

test('late hydration from a signed-out account cannot affect the next account', async () => {
  const pending = deferred<Language | undefined>();
  request.mockImplementationOnce(() => pending.promise);
  await render({ account: 'A', token: 'token-A' });
  request.mockResolvedValue('de');
  await update({ account: 'B', token: 'token-B' });
  await act(async () => pending.resolve('en'));
  expect(result.language).toBe('de');
});


test('pending account choice survives restart and is not sent under a different account', async () => {
  (storage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ accounts: {
    A: { language: 'en', pending: true, revision: 1 },
  } }));
  request.mockResolvedValue('de');
  await render({ account: 'B', token: 'token-B' });
  expect(request.mock.calls).toEqual([['token-B']]);
  expect(result.language).toBe('de');
  await update({ account: 'A', token: 'token-A' });
  expect(request.mock.calls).toContainEqual(['token-A', 'en']);
  expect(result.language).toBe('en');
});

test('token renewal retries a pending save with the renewed session after the older request finishes', async () => {
  await render({ account: 'A', token: 'old-token-A' });
  const pending = deferred<Language | undefined>();
  request.mockImplementationOnce(() => pending.promise);
  await act(async () => result.setLanguage('en'));
  await update({ account: 'A', token: 'new-token-A' });
  await act(async () => pending.resolve('en'));
  expect(request.mock.calls).toContainEqual(['new-token-A', 'en']);
  expect(result.language).toBe('en');
});
