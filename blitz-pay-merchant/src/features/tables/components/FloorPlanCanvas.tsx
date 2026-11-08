import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { observability } from '../../../lib/observability';
import { colors, radius } from '../../../lib/theme';
import { dragFraction, fractionToPoint, pinCaption, type TablePinTone } from '../tableLogic';

const DEFAULT_ASPECT = 4 / 3;
export const PIN_WIDTH = 84;
export const PIN_HEIGHT = 30;

export const PIN_COLORS: Record<TablePinTone, string> = {
  free: colors.success,
  unpaid: colors.warning,
  paid: colors.primary,
  reserved: colors.secondary,
};

export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * Renders a Floor Plan picture at its own aspect ratio so Table Placement fractions map straight
 * onto the rendered width and height.
 */
export function FloorPlanCanvas({
  imageUrl,
  emptyLabel,
  children,
}: {
  imageUrl: string | null;
  emptyLabel: string;
  children: (size: CanvasSize) => React.ReactNode;
}) {
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });

  useEffect(() => {
    if (!imageUrl) {
      setAspect(DEFAULT_ASPECT);
      return;
    }
    Image.getSize(
      imageUrl,
      (width, height) => {
        if (width > 0 && height > 0) setAspect(width / height);
      },
      (err) => observability.warn('floor_plan_image_size_failed', { reason: String(err) }),
    );
  }, [imageUrl]);

  return (
    <View
      style={[styles.canvas, { aspectRatio: aspect }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="stretch" />
      ) : (
        <View style={styles.empty}>
          <Ionicons name="image-outline" size={32} color={colors.gray500} />
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      )}
      {size.width > 0 ? children(size) : null}
    </View>
  );
}

/**
 * Table Name with seats, always visible on the pin. The live floor adds guests ("5 · 3/4"); "–" means
 * nobody is seated and "?" marks Tables without seats so the gap is visible.
 */
function PinLabel({ name, seats, guests }: { name: string; seats: number | null; guests?: number | null }) {
  return (
    <View style={styles.pinLabel}>
      <Text style={styles.pinText} numberOfLines={1}>{name}</Text>
      <Text style={styles.pinSep}>·</Text>
      <Ionicons name="people" size={11} color={colors.white} />
      {guests !== undefined ? <Text style={styles.pinSep}>{`${guests ?? '–'}/`}</Text> : null}
      <Text style={[styles.pinSep, seats == null && styles.pinUnknown]}>{seats ?? '?'}</Text>
    </View>
  );
}

export function TablePin({
  label,
  seats,
  guests,
  tone,
  x,
  y,
  size,
  onPress,
  badge,
}: {
  label: string;
  seats: number | null;
  guests: number | null;
  tone: TablePinTone;
  x: number;
  y: number;
  size: CanvasSize;
  onPress?: () => void;
  badge?: number;
}) {
  const { left, top } = fractionToPoint(x, y, size.width, size.height);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={pinCaption(label, seats, guests)}
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.pin, { left: left - PIN_WIDTH / 2, top: top - PIN_HEIGHT / 2, backgroundColor: PIN_COLORS[tone] }]}
    >
      <PinLabel name={label} seats={seats} guests={guests} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function DraggableTablePin({
  label,
  seats,
  x,
  y,
  size,
  onDrop,
  onLongPress,
}: {
  label: string;
  seats: number | null;
  x: number;
  y: number;
  size: CanvasSize;
  onDrop: (fraction: { x: number; y: number }) => void;
  onLongPress?: () => void;
}) {
  const translate = useRef(new Animated.ValueXY()).current;
  const latest = useRef({ x, y, size, onDrop });
  latest.current = { x, y, size, onDrop };

  const responder = useRef(
    PanResponder.create({
      // Capture only real drags so the inner touchable still receives long presses.
      onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: Animated.event([null, { dx: translate.x, dy: translate.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_e, g) => {
        const current = latest.current;
        translate.setValue({ x: 0, y: 0 });
        current.onDrop(dragFraction({ x: current.x, y: current.y }, g.dx, g.dy, current.size.width, current.size.height));
      },
      onPanResponderTerminate: () => translate.setValue({ x: 0, y: 0 }),
    }),
  ).current;

  const { left, top } = fractionToPoint(x, y, size.width, size.height);
  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.pin,
        styles.draggable,
        {
          left: left - PIN_WIDTH / 2,
          top: top - PIN_HEIGHT / 2,
          transform: translate.getTranslateTransform(),
        },
      ]}
    >
      <TouchableOpacity
        onLongPress={onLongPress}
        delayLongPress={500}
        activeOpacity={0.9}
        style={styles.pinTouch}
        accessibilityLabel={pinCaption(label, seats)}
      >
        <PinLabel name={label} seats={seats} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  empty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  emptyText: { fontSize: 13, color: colors.gray600, textAlign: 'center' },
  pin: {
    position: 'absolute',
    width: PIN_WIDTH,
    height: PIN_HEIGHT,
    borderRadius: PIN_HEIGHT / 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  draggable: { backgroundColor: colors.secondary },
  pinTouch: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  pinLabel: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: '100%' },
  pinText: { flexShrink: 1, fontSize: 12, fontWeight: '800', color: colors.white },
  pinSep: { fontSize: 12, fontWeight: '800', color: colors.white },
  pinUnknown: { textDecorationLine: 'underline' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.onSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.white },
});
