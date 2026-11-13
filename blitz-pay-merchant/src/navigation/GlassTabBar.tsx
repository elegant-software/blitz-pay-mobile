import React, {
  useEffect,
  useState,
  type RefObject,
  type ComponentRef,
} from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export const GLASS_TAB_BAR_HEIGHT = 62;

type Props = BottomTabBarProps & {
  blurTarget: RefObject<ComponentRef<typeof View> | null>;
};

export default function GlassTabBar({
  state,
  descriptors,
  navigation,
  blurTarget,
}: Props) {
  const { mode, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboardVisible) return null;
  const transition = reduceMotion
    ? undefined
    : LinearTransition.springify().damping(18).stiffness(180);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      <View
        style={[
          styles.shadow,
          {
            shadowOpacity: mode === 'dark' ? 0.25 : 0.1,
            elevation: mode === 'dark' ? 8 : 6,
          },
          Platform.OS === 'web' && {
            boxShadow:
              mode === 'dark'
                ? '0 6px 18px rgba(0,0,0,0.25)'
                : '0 8px 28px rgba(15,23,42,0.10)',
          },
        ]}
      >
        <BlurView
          blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus"
          intensity={mode === 'dark' ? 55 : 70}
          tint={mode}
          style={[
            styles.glass,
            {
              backgroundColor:
                mode === 'dark' ? `${colors.surface}B8` : `${colors.cardBg}F0`,
              borderColor:
                mode === 'dark'
                  ? 'rgba(255,255,255,0.10)'
                  : 'rgba(15,23,42,0.08)',
            },
          ]}
        >
          <View style={styles.tabs}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const label =
                typeof options.tabBarLabel === 'string'
                  ? options.tabBarLabel
                  : (options.title ?? route.name);
              const focused = state.index === index;
              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented)
                  navigation.navigate(route.name, route.params);
              };
              const color = focused ? colors.secondary : colors.gray600;
              return (
                <AnimatedPressable
                  key={route.key}
                  onPress={onPress}
                  onLongPress={() =>
                    navigation.emit({ type: 'tabLongPress', target: route.key })
                  }
                  onKeyDown={
                    Platform.OS === 'web'
                      ? (event) => {
                          if (event.nativeEvent.key === ' ') {
                            event.preventDefault();
                            if (!event.nativeEvent.repeat) onPress();
                          }
                        }
                      : undefined
                  }
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  aria-selected={focused}
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                  testID={options.tabBarButtonTestID}
                  layout={transition}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: focused
                        ? `${colors.primary}14`
                        : 'transparent',
                      borderColor: focused
                        ? `${colors.primary}20`
                        : 'transparent',
                    },
                  ]}
                >
                  <Animated.View layout={transition} style={styles.tabContent}>
                    <View style={styles.icon}>
                      {options.tabBarIcon?.({
                        focused,
                        color,
                        size: focused ? 22 : 21,
                      })}
                    </View>
                    {focused ? (
                      <Animated.Text
                        entering={
                          reduceMotion ? undefined : FadeIn.duration(180)
                        }
                        exiting={
                          reduceMotion ? undefined : FadeOut.duration(100)
                        }
                        numberOfLines={1}
                        style={[styles.label, { color }]}
                      >
                        {label}
                      </Animated.Text>
                    ) : null}
                  </Animated.View>
                </AnimatedPressable>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    direction: 'ltr',
  },
  shadow: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
  },
  glass: { overflow: 'hidden', borderRadius: 32, borderWidth: 1 },
  tabs: {
    minHeight: GLASS_TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    gap: 2,
  },
  tab: {
    minHeight: 46,
    minWidth: 44,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 0,
  },
  icon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    writingDirection: 'ltr',
    textAlign: 'center',
    flexShrink: 1,
  },
});
