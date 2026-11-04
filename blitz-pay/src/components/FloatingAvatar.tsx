import React, { useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import {
  Animated,
  PanResponder,
  TouchableOpacity,
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { useVoiceAssistantContext } from '../lib/VoiceAssistantContext';

const SIZE = 72;
const RING_SIZE = SIZE + 16; // ring sits just outside the avatar
const { width: SW, height: SH } = Dimensions.get('window');

export default function FloatingAvatar() {
  const { micState, toggleRecording } = useVoiceAssistantContext();
  const isListening = micState === 'recording';
  const isProcessing = micState === 'processing';
  const isError = micState === 'error';

  // Dragging
  const pan = useRef(new Animated.ValueXY({ x: 16, y: SH - 200 })).current;
  const panOffset = useRef({ x: 16, y: SH - 200 });
  const isDragging = useRef(false);

  // Rotating arc — listening (fast) or processing (slow)
  const arcRotation = useRef(new Animated.Value(0)).current;

  // Processing: avatar dim
  const dimOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      arcRotation.setValue(0);
      const arc = Animated.loop(
        Animated.timing(arcRotation, { toValue: 1, duration: 1200, useNativeDriver: true }),
      );
      arc.start();
      dimOpacity.setValue(1);
      return () => { arc.stop(); arcRotation.setValue(0); };
    }

    if (isProcessing) {
      Animated.timing(dimOpacity, { toValue: 0.55, duration: 300, useNativeDriver: true }).start();
      arcRotation.setValue(0);
      const arc = Animated.loop(
        Animated.timing(arcRotation, { toValue: 1, duration: 1800, useNativeDriver: true }),
      );
      arc.start();
      return () => {
        arc.stop();
        arcRotation.setValue(0);
        Animated.timing(dimOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      };
    }

    // Idle / error
    arcRotation.setValue(0);
    Animated.timing(dimOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [micState]);

  const spin = arcRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.setOffset({ x: panOffset.current.x, y: panOffset.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4) isDragging.current = true;
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_, gs);
      },
      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();
        const newX = Math.max(0, Math.min(SW - SIZE, panOffset.current.x + gs.dx));
        const newY = Math.max(60, Math.min(SH - SIZE - 80, panOffset.current.y + gs.dy));
        panOffset.current = { x: newX, y: newY };
        Animated.spring(pan, { toValue: { x: newX, y: newY }, useNativeDriver: false, damping: 20 }).start();
      },
    }),
  ).current;

  const handlePress = () => {
    if (isDragging.current) return;
    void toggleRecording();
  };

  const borderColor = isListening ? colors.primary
    : isError ? colors.error
    : 'rgba(255,255,255,0.25)';

  const glowOpacity = isListening ? 1 : 0;

  return (
    <Animated.View
      style={[styles.wrapper, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      {/* Rotating arc — listening (fast) or processing (slow) */}
      {(isListening || isProcessing) && (
        <Animated.View style={[styles.arcRing, { transform: [{ rotate: spin }] }]}>
          <View style={[
            styles.arcTrack,
            { borderTopColor: isProcessing ? colors.secondary : colors.primary },
          ]} />
        </Animated.View>
      )}

      {/* Avatar */}
      <Animated.View
        style={[
          styles.avatar,
          {
            borderColor,
            shadowOpacity: glowOpacity * 0.9,
          },
        ]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handlePress} activeOpacity={0.85} />
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: dimOpacity }]}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400&h=600' }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </Animated.View>

        {/* Cyan listening tint */}
        {isListening && (
          <View style={styles.listeningTint} />
        )}
      </Animated.View>

      {/* Badge: mic state indicator */}
      <TouchableOpacity
        style={[
          styles.badge,
          isListening && styles.badgeListening,
          isProcessing && styles.badgeProcessing,
          isError && styles.badgeError,
        ]}
        onPress={handlePress}
      >
        <Ionicons
          name={isListening ? 'stop' : isError ? 'mic-off' : 'mic-outline'}
          size={11}
          color={colors.white}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 999,
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcTrack: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderTopColor: colors.primary,   // overridden per state
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2.5,
    // Glow
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 14,
    elevation: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  listeningTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `${colors.primary}22`,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  badgeListening: { backgroundColor: colors.primary },
  badgeProcessing: { backgroundColor: colors.secondary },
  badgeError: { backgroundColor: colors.error },
});
