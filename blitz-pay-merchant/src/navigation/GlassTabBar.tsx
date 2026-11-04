import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Keyboard, Platform, Pressable, StyleSheet, View,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { requireOptionalNativeModule } from 'expo';
import type { BlurViewProps } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';

const GlassSurface: React.ComponentType<BlurViewProps> =
  Platform.OS === 'web' || requireOptionalNativeModule('ExpoBlur')
    ? require('expo-blur').BlurView
    : View;

type TabItemProps = {
  route: BottomTabBarProps['state']['routes'][number];
  options: BottomTabBarProps['descriptors'][string]['options'];
  navigation: BottomTabBarProps['navigation'];
  focused: boolean;
  reducedMotion: boolean;
};

function TabItem({ route, options, navigation, focused, reducedMotion }: TabItemProps) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const label = typeof options.tabBarLabel === 'string'
    ? options.tabBarLabel : options.title ?? route.name;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: focused ? 1 : 0,
      duration: reducedMotion ? 0 : 220,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [focused, reducedMotion, progress]);

  function onPress() {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  }

  return (
    <Animated.View style={[styles.item, {
      flex: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }),
    }]}>
      <Pressable onPress={onPress}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        accessibilityRole="tab" accessibilityState={{ selected: focused }}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
        testID={options.tabBarTestID}
        style={({ pressed }) => [styles.button, focused && styles.selected, pressed && styles.pressed]}>
        <View style={styles.icon}>
          {options.tabBarIcon?.({
            focused, color: focused ? colors.primary : colors.gray700, size: focused ? 22 : 21,
          })}
        </View>
        {focused && (
          <Animated.Text numberOfLines={1} style={[styles.label, { opacity: progress }]}>
            {label}
          </Animated.Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      value => { if (active) setReducedMotion(value); },
      () => { if (active) setReducedMotion(true); },
    );
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { active = false; motion.remove(); show.remove(); hide.remove(); };
  }, []);

  if (keyboardVisible) return null;

  return (
    <View pointerEvents="box-none" style={[styles.container, {
      paddingBottom: Math.max(insets.bottom, 10),
      paddingLeft: Math.max(insets.left, 16),
      paddingRight: Math.max(insets.right, 16),
    }]}>
      <View style={styles.shadow}>
        <GlassSurface intensity={70} tint="light" style={styles.glass}>
          <View style={styles.row}>
            {state.routes.map((route, index) => (
              <TabItem key={route.key} route={route} options={descriptors[route.key].options}
                navigation={navigation} focused={state.index === index} reducedMotion={reducedMotion} />
            ))}
          </View>
        </GlassSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 10, backgroundColor: colors.background },
  shadow: {
    width: '100%', maxWidth: 430, borderRadius: 32,
    ...Platform.select({
      web: { boxShadow: '0 8px 28px rgba(41,35,27,0.10)' },
      default: { shadowColor: '#29231B', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 20, elevation: 6 },
    }),
  },
  glass: {
    overflow: 'hidden', borderRadius: 32, borderWidth: 1,
    borderColor: colors.primary + '20', backgroundColor: 'rgba(255,249,239,0.94)',
  },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 7 },
  item: { minWidth: 44 },
  button: {
    minHeight: 46, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1,
    borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  selected: { backgroundColor: colors.primary + '14', borderColor: colors.primary + '20' },
  pressed: { opacity: 0.65 },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.primary, fontSize: 12, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
});
