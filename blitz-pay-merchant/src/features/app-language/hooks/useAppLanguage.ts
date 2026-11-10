import { useAuth } from '../../../lib/auth';
import { useLanguagePreference } from './useLanguagePreference';
import { resolveDefaultLanguage } from '../store/languagePreferencesStore';

export function useAppLanguage() {
  const { authenticated, user, token, activeBranchScope } = useAuth();
  const fallback = resolveDefaultLanguage([activeBranchScope?.originalMenuLanguage ?? '']);
  return useLanguagePreference(authenticated ? user?.id ?? null : null, token, fallback);
}

