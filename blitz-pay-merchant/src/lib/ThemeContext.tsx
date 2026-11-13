import React, { createContext, useContext } from 'react';
import type { ThemeColors } from './theme';
import type { ThemeMode } from '../features/app-theme/store/themeStore';
import { useAppTheme } from '../features/app-theme/hooks/useAppTheme';

const ThemeContext = createContext<{
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useAppTheme();
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider is required');
  return value;
}
