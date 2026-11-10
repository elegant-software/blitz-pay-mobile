import { useBasketLanguage } from '../features/basket/hooks/useBasketLanguage';
import React, { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from './auth';
import { useAppLanguage } from '../features/app-language/hooks/useAppLanguage';
import { View, Text, TouchableOpacity } from 'react-native';
import { translations, type Language, type TranslationKeys } from './translations';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  retryLanguageSave: () => Promise<void>;
  languageSaveError: { detail?: string } | null;
  t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'de',
  retryLanguageSave: async () => {},
  languageSaveError: null,
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  const { language, setLanguage, retryLanguageSave, languageSaveError, languageReady } = useAppLanguage();

  const basketLocalization = useBasketLanguage(language, authenticated && languageReady);

  function t(key: TranslationKeys, params?: Record<string, string | number>): string {
    const dict = translations[language] ?? translations.en;
    let text = (dict as Record<string, string>)[key] ?? (translations.en as Record<string, string>)[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, retryLanguageSave, languageSaveError }}>
      {languageReady ? children : null}
      {authenticated && basketLocalization.error ? (
        <View accessibilityRole="alert" style={{ padding: 12 }}>
          <Text>{basketLocalization.errorDetail ?? t('merchant_catalog_load_failed')}</Text>
          <TouchableOpacity onPress={() => { void basketLocalization.refetch(); }}>
            <Text>{t('language_content_retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {languageSaveError ? (
        <View accessibilityRole="alert" style={{ padding: 12, backgroundColor: '#fff0ef' }}>
          <Text>{t('language_save_failed')}</Text>
          {languageSaveError.detail ? <Text>{languageSaveError.detail}</Text> : null}
          <TouchableOpacity onPress={() => { void retryLanguageSave(); }}>
            <Text>{t('language_save_retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
