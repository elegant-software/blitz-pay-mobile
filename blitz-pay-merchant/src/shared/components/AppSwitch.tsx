import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
  type KeyDownEvent,
} from 'react-native';
import { useTheme } from '../../lib/ThemeContext';

export interface AppSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export default function AppSwitch({
  value,
  onValueChange,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  testID,
  style,
}: AppSwitchProps) {
  const { colors } = useTheme();
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  const [focused, setFocused] = useState(false);
  const keyboardProps =
    Platform.OS === 'web'
      ? {
          onKeyDown(event: KeyDownEvent) {
            if (event.nativeEvent.key === ' ') {
              event.preventDefault();
              if (!disabled && !event.nativeEvent.repeat) onValueChange(!value);
            }
          },
        }
      : {};

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => {
        if (active) setReduceMotion(true);
      });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: reduceMotion ? 0 : 180,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [value, reduceMotion, progress]);

  return (
    <Pressable
      {...keyboardProps}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      testID={testID}
      style={[styles.touchTarget, disabled && styles.disabled, style]}
    >
      {focused && !disabled ? (
        <View
          pointerEvents="none"
          style={[styles.focusRing, { borderColor: colors.secondary }]}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[styles.track, { backgroundColor: colors.gray300 }]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.track,
            { backgroundColor: colors.primary, opacity: progress },
          ]}
        />
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: colors.white,
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 20],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    width: 55,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  focusRing: { ...StyleSheet.absoluteFill, borderWidth: 2, borderRadius: 22 },
  track: { width: 51, height: 31, borderRadius: 16, direction: 'ltr' },
  thumb: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 27,
    height: 27,
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
