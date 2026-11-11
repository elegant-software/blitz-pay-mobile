import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getLocales } from 'expo-localization';
import { useAuth } from '../../../lib/auth';
import { useLanguagePreference } from './useLanguagePreference';
import { resolveDefaultLanguage } from '../store/languagePreferencesStore';

const deviceLanguage = () => resolveDefaultLanguage(getLocales().map(locale => locale.languageTag));

export function useAppLanguage() {
  const { authenticated, user, token } = useAuth();
  const [fallback, setFallback] = useState(deviceLanguage);
  useEffect(() => {
    const refresh = () => setFallback(deviceLanguage());
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    globalThis.addEventListener?.('languagechange', refresh);
    return () => { subscription.remove(); globalThis.removeEventListener?.('languagechange', refresh); };
  }, []);
  return useLanguagePreference(authenticated ? user?.id ?? null : null, token, fallback);
}

