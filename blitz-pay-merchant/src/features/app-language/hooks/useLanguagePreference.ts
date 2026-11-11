import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { storage } from '../../../lib/storage';
import { observability } from '../../../lib/observability';
import type { Language } from '../../../lib/translations';
import { requestLanguageSettings, LanguageSettingsError } from '../services/languageSettingsService';
import { createLanguagePreferencesStore, parsePreferences, type Preferences, type Choice } from '../store/languagePreferencesStore';

const STORAGE_KEY = 'blitz-pay-merchant_language_preferences_v1';

export function useLanguagePreference(account: string | null, token: string | null, fallback: Language) {
  const [store] = useState(createLanguagePreferencesStore);
  const preferences = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<{ account: string | null; detail?: string } | null>(null);
  const current = useRef({ account, token, generation: 0 });
  const generation = current.current.generation +
    (current.current.account !== account || current.current.token !== token ? 1 : 0);
  current.current = { account, token, generation };
  const data = { get current() { return store.getSnapshot(); } };
  const writes = useRef(Promise.resolve());
  const flights = useRef(new Map<string, Promise<void>>());
  const hydrated = useRef(new Set<string>());
  const mounted = useRef(true);
  const localSaveFailed = useRef(false);

  const persist = useCallback((snapshot?: Preferences) => {
    writes.current = writes.current.then(() => storage.setItem(
      STORAGE_KEY, JSON.stringify(snapshot ?? store.getSnapshot()),
    )).then(() => {
      localSaveFailed.current = false;
    }).catch(() => {
      localSaveFailed.current = true;
      observability.warn('language_local_save_failed', {});
      if (mounted.current) setError({ account: current.current.account });
    });
    return writes.current;
  }, [store]);

  const commit = useCallback((next: Preferences) => {
    store.replace(next);
    void persist(next);
  }, [store, persist]);

  useEffect(() => {
    mounted.current = true;
    void storage.getItem(STORAGE_KEY).then(raw => {
      const next = parsePreferences(raw);
      if (mounted.current) store.replace(next);
    }).catch(() => {
      observability.warn('language_local_load_failed', {});
    }).finally(() => { if (mounted.current) setReady(true); });
    return () => { mounted.current = false; };
  }, [store]);

  const synchronize = useCallback(async function synchronize() {
    const { account: owner, token: credential, generation: sessionGeneration } = current.current;
    if (!ready) return;
    await writes.current;
    if (localSaveFailed.current) {
      await persist();
      if (!localSaveFailed.current && current.current.generation === sessionGeneration) setError(null);
    }
    if (!owner || !credential) return;
    const existing = flights.current.get(owner);
    if (existing) {
      await existing;
      if (current.current.account === owner && current.current.token === credential) await synchronize();
      return;
    }
    const active = () => mounted.current && current.current.account === owner && current.current.token === credential && current.current.generation === sessionGeneration;
    const job = (async () => {
      try {
        if (!hydrated.current.has(owner)) {
          const before = data.current.accounts[owner];
          const remote = await requestLanguageSettings(credential);
          if (!active()) return;
          hydrated.current.add(owner);
          const latest = data.current.accounts[owner];
          if (!latest?.pending && latest === before) {
            const choice = remote
              ? { language: remote, pending: false, revision: Date.now() }
              : data.current.guest ? { ...data.current.guest, pending: true } : undefined;
            if (choice) commit({ ...data.current, accounts: { ...data.current.accounts, [owner]: choice } });
          }
        }
        while (active()) {
          const choice = data.current.accounts[owner];
          if (!choice?.pending) break;
          await requestLanguageSettings(credential, choice.language);
          if (!active()) return;
          if (data.current.accounts[owner] === choice) {
            commit({ ...data.current, accounts: { ...data.current.accounts, [owner]: { ...choice, pending: false } } });
          }
        }
        await writes.current;
        if (active() && !localSaveFailed.current) setError(null);
      } catch (failure) {
        if (active()) setError({ account: owner, detail: failure instanceof LanguageSettingsError ? failure.detail : undefined });
      }
    })();
    flights.current.set(owner, job);
    await job;
    flights.current.delete(owner);
  }, [ready, commit, store, persist]);

  useEffect(() => {
    hydrated.current.clear();
    void synchronize();
  }, [account, token, synchronize]);

  useEffect(() => {
    const subscription = Network.addNetworkStateListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) void synchronize();
    });
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') void synchronize();
    });
    return () => { subscription.remove(); app.remove(); };
  }, [synchronize]);

  const setLanguage = useCallback((language: Language) => {
    const owner = current.current.account;
    const choice: Choice = { language, pending: !!owner, revision: Date.now() };
    commit(owner
      ? { ...data.current, accounts: { ...data.current.accounts, [owner]: choice } }
      : { ...data.current, guest: choice });
    setError(null);
    void synchronize();
  }, [commit, synchronize]);

  const choice = account ? preferences.accounts[account] ?? preferences.guest : preferences.guest;
  return {
    language: choice?.language ?? fallback,
    setLanguage,
    retryLanguageSave: synchronize,
    languageSaveError: error?.account === account ? error : null,
    languageReady: ready,
  };
}

