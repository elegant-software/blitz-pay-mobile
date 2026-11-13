import { useEffect, useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import { colors, darkColors } from '../../../lib/theme';
import { themeStore, type ThemeMode } from '../store/themeStore';
import {
  readThemePreference,
  writeThemePreference,
} from '../services/themePreferenceService';

export function useAppTheme() {
  const system = useColorScheme();
  const preference = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getSnapshot,
  );
  useEffect(() => {
    let active = true;
    void readThemePreference().then((value) => {
      if (active && value && themeStore.getSnapshot() === null)
        themeStore.setPreference(value);
    });
    return () => {
      active = false;
    };
  }, []);
  const mode = preference ?? (system === 'dark' ? 'dark' : 'light');
  return {
    mode,
    colors: mode === 'dark' ? darkColors : colors,
    setMode(value: ThemeMode) {
      themeStore.setPreference(value);
      writeThemePreference(value);
    },
  };
}
