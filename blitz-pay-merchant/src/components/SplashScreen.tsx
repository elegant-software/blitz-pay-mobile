import { useTheme } from "../lib/ThemeContext";
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BrandLogo from './BrandLogo';
import { useLanguage } from '../lib/LanguageContext';
import { spacing, type ThemeColors } from '../lib/theme';

interface Props {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLanguage();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(onComplete, 1800);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LinearGradient colors={[colors.background, colors.surface]} style={styles.container}>
      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        <BrandLogo />
        <Text style={styles.sub}>{t('account_merchant')}</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, zIndex: 1000, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', gap: spacing.sm },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: `${colors.primary}40`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconCore: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: { fontSize: 36, fontWeight: '800', color: colors.white, letterSpacing: -1 },
  sub: { fontSize: 14, color: colors.gray500, letterSpacing: 1 },
});
