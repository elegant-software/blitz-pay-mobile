import { colors, theme } from '../lib/theme';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, StyleSheet, Text, View } from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../lib/LanguageContext';

interface Props {
  ready: boolean;
  onComplete: () => void;
}

export default function SplashScreen({ ready, onComplete }: Props) {
  const { logo, name, gradient } = theme;
  const { t } = useLanguage();
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [entered, setEntered] = useState(false);
  const entrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const complete = useRef(onComplete);
  complete.current = onComplete;

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      value => { if (active) setReducedMotion(value); },
      () => { if (active) setReducedMotion(true); },
    );
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reducedMotion === null) return;
    const animation = Animated.timing(entrance, {
      toValue: 1, duration: reducedMotion ? 0 : 750, useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished) setEntered(true); });
    if (reducedMotion) return () => animation.stop();
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: true }),
    ]));
    const loading = Animated.loop(Animated.timing(progress, {
      toValue: 1, duration: 1400, useNativeDriver: true,
    }));
    breathing.start();
    loading.start();
    return () => { animation.stop(); breathing.stop(); loading.stop(); };
  }, [reducedMotion, entrance, pulse, progress]);

  useEffect(() => {
    if (!ready || !entered) return;
    const animation = Animated.timing(opacity, {
      toValue: 0, duration: reducedMotion ? 0 : 300, useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished) complete.current(); });
    return () => animation.stop();
  }, [ready, entered, reducedMotion, opacity]);

  return (
    <Animated.View
      style={[styles.overlay, { opacity, backgroundColor: colors.background }]}
      accessibilityViewIsModal
      onLayout={() => { void ExpoSplashScreen.hideAsync(); }}
    >
      <LinearGradient colors={gradient} style={styles.background}>
        <Animated.View style={[styles.halo, { backgroundColor: colors.primary + '18',
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
        }]} />
        <Animated.View style={[styles.content, {
          opacity: entrance,
          transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }]}>
          <Image source={logo} style={styles.logo}
            resizeMode="contain" accessibilityLabel={t('theme_logo_label', { brand: name })} />
          <Text style={[styles.tagline, { color: colors.gray700 }]}>{t('splash_tagline')}</Text>
        </Animated.View>
        <View style={styles.loading} accessible accessibilityRole="progressbar"
          accessibilityLabel={t('loading')} accessibilityState={{ busy: !ready }}>
          <View style={[styles.track, { backgroundColor: colors.gray200 }]}>
            <Animated.View style={[styles.fill, { backgroundColor: colors.primary,
              transform: [{ translateX: reducedMotion ? 60 : progress.interpolate({
                inputRange: [0, 1], outputRange: [-80, 220],
              }) }],
            }]} />
          </View>
          <Text style={[styles.loadingText, { color: colors.gray700 }]}>{t('loading')}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, elevation: 1000 },
  background: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  halo: { position: 'absolute', width: 320, height: 320, borderRadius: 160 },
  content: { width: '100%', alignItems: 'center', paddingHorizontal: 36 },
  logo: { width: '100%', maxWidth: 340, height: 140 },
  tagline: { marginTop: 16, fontSize: 14, letterSpacing: 2 },
  loading: { position: 'absolute', bottom: '12%', alignItems: 'center', gap: 16 },
  track: { width: 220, height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { width: 80, height: 3, borderRadius: 2 },
  loadingText: { color: '#765A2C', fontSize: 12, letterSpacing: 1 },
});
