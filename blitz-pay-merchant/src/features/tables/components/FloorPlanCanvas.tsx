import { useTheme } from "../../../lib/ThemeContext";
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { observability } from '../../../lib/observability';
import { radius, type ThemeColors } from '../../../lib/theme';
import { dragFraction, fractionToPoint, pinCaption, tableChairs, type TablePinTone } from '../tableLogic';
import type { FloorArea } from '../types/table';

const DEFAULT_ASPECT = 4 / 3;
export const PIN_WIDTH = 84;
export const PIN_HEIGHT = 30;

/** Same colours as the admin live floor: grey free, teal occupied (amber € badge while unpaid), purple reserved. */
const FLOOR = {
  free: '#B4B2A9',
  freeText: '#444441',
  occupied: '#1D9E75',
  occupiedTop: '#E1F5EE',
  occupiedText: '#04342C',
  reserved: '#7F77DD',
  unpaid: '#EF9F27',
  unpaidText: '#412402',
  area: '#B4B2A9',
  areaText: '#5F5E5A',
};

export const PIN_COLORS: Record<TablePinTone, string> = {
  free: '#888780',
  unpaid: FLOOR.occupied,
  paid: FLOOR.occupied,
  reserved: FLOOR.reserved,
};

export const LIVE_PIN_SIZE = 56;

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
  areas = [],
  children,
}: {
  imageUrl: string | null;
  emptyLabel: string;
  /** Floor Areas traced in the admin dashboard; when present they are drawn instead of the picture. */
  areas?: FloorArea[];
  children: (size: CanvasSize) => React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const drawn = areas.length > 0;
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
      style={[styles.canvas, drawn && styles.canvasDrawn, { aspectRatio: aspect }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      {drawn ? (
        areas.map((area, index) => (
          <View
            key={`${area.name}-${index}`}
            style={[
              styles.area,
              {
                left: area.x * size.width,
                top: area.y * size.height,
                width: area.width * size.width,
                height: area.height * size.height,
              },
            ]}
          >
            <Text style={styles.areaText} numberOfLines={1}>{area.name}</Text>
          </View>
        ))
      ) : imageUrl ? (
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
  const { colors } = useTheme();
  const styles = createStyles(colors);

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

/**
 * A live Table drawn as a table with a chair per seat; seated guests fill chairs. Occupied tables get a
 * teal top, unpaid ones an amber € badge, reserved ones a dashed purple outline. Below: time seated.
 */
export function LiveTablePin({
  label,
  seats,
  guests,
  tone,
  caption,
  x,
  y,
  size,
  onPress,
}: {
  label: string;
  seats: number | null;
  guests: number | null;
  tone: TablePinTone;
  caption?: string;
  x: number;
  y: number;
  size: CanvasSize;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { left, top } = fractionToPoint(x, y, size.width, size.height);
  const occupied = tone === 'paid' || tone === 'unpaid';
  const reserved = tone === 'reserved';
  const outline = reserved ? FLOOR.reserved : occupied ? FLOOR.occupied : FLOOR.free;
  const dash = reserved ? '4 3' : undefined;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={pinCaption(label, seats, guests)}
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.livePin, { left: left - LIVE_PIN_SIZE / 2, top: top - LIVE_PIN_SIZE / 2 }]}
    >
      <Svg width={LIVE_PIN_SIZE} height={LIVE_PIN_SIZE} viewBox="0 0 60 60">
        {tableChairs(seats, guests).map((chair, index) => (
          <Circle
            key={index}
            cx={chair.cx}
            cy={chair.cy}
            r={5.5}
            fill={chair.seated ? FLOOR.occupied : colors.white}
            stroke={chair.seated ? FLOOR.occupied : outline}
            strokeWidth={1.5}
            strokeDasharray={dash}
          />
        ))}
        <Rect
          x={15}
          y={15}
          width={30}
          height={30}
          rx={7}
          fill={occupied ? FLOOR.occupiedTop : colors.white}
          stroke={outline}
          strokeWidth={1.5}
          strokeDasharray={dash}
        />
        <SvgText
          x={30}
          y={34.5}
          textAnchor="middle"
          fontSize={12}
          fontWeight="700"
          fill={occupied ? FLOOR.occupiedText : FLOOR.freeText}
          textLength={label.length > 3 ? 26 : undefined}
          lengthAdjust="spacingAndGlyphs"
        >
          {label}
        </SvgText>
        {tone === 'unpaid' ? (
          <G>
            <Circle cx={49} cy={11} r={7.5} fill={FLOOR.unpaid} />
            <SvgText x={49} y={14.5} textAnchor="middle" fontSize={10} fontWeight="700" fill={FLOOR.unpaidText}>€</SvgText>
          </G>
        ) : null}
      </Svg>
      {caption ? <Text style={styles.liveCaption}>{caption}</Text> : null}
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
  const { colors } = useTheme();
  const styles = createStyles(colors);

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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  canvas: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  canvasDrawn: { backgroundColor: colors.white },
  area: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: FLOOR.area,
    borderRadius: 6,
  },
  areaText: { position: 'absolute', left: 6, top: 2, fontSize: 11, color: FLOOR.areaText },
  livePin: { position: 'absolute', width: LIVE_PIN_SIZE, alignItems: 'center' },
  liveCaption: {
    marginTop: -4,
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    color: FLOOR.areaText,
  },
  empty: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
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
});
