export const colors = {
  primary: '#926B1D',
  onPrimary: '#FFFFFF',
  secondary: '#634A23',
  surface: '#F4EAD8',
  onSurface: '#29231B',
  background: '#FFF9EF',
  white: '#FFFFFF',
  black: '#000000',
  gray100: '#F4EAD8',
  gray200: '#E7DAC2',
  gray300: '#D3C3A7',
  gray400: '#B7A489',
  gray500: '#8A775D',
  gray600: '#79664D',
  gray700: '#65523B',
  gray800: '#493B2B',
  gray900: '#29231B',
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  cardBg: '#FFFFFF',
  overlayDark: 'rgba(0,0,0,0.6)',
};

export const theme = {
  colors,
  name: "bona’me",
  logo: require('../../assets/bona-me-logo.png'),
  gradient: ['#FFF9EF', '#F4EAD8', '#FFF9EF'] as const,
  headerGradient: ['#29231B', '#634A23'] as const,
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