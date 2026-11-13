export const colors = {
  primary: '#C4A46C',
  secondary: '#80633B',
  surface: '#F2EEE7',
  onSurface: '#25241F',
  background: '#FAF8F4',
  heroBackground: '#25241F',
  heroGradientEnd: '#3C3931',
  onHero: '#FFFFFF',
  heroMuted: '#D6CDBF',
  white: '#FFFFFF',
  black: '#000000',
  gray100: '#F2EEE7',
  gray200: '#E5E0D6',
  gray300: '#D6CDBF',
  gray400: '#A39B8D',
  gray500: '#867F72',
  gray600: '#726D62',
  gray700: '#5B574F',
  gray800: '#3C3931',
  gray900: '#25241F',
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  cardBg: '#FFFFFF',
  overlayDark: 'rgba(0,0,0,0.6)',
};

export type ThemeColors = typeof colors;

export const darkColors: ThemeColors = {
  ...colors,
  primary: '#D8BA83',
  secondary: '#D8BA83',
  surface: '#282722',
  onSurface: '#F5F1E9',
  background: '#191A17',
  cardBg: '#23241F',
  gray100: '#282922',
  gray200: '#3D3E35',
  gray300: '#55564B',
  gray400: '#858678',
  gray500: '#A4A597',
  gray600: '#B2B3A5',
  gray700: '#CBCCBF',
  gray800: '#E0E1D5',
  gray900: '#F5F1E9',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
};
