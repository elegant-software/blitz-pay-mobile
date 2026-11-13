import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../../lib/LanguageContext';
import { colors, radius } from '../../../lib/theme';
import { getFulfilmentTypeIcon, getFulfilmentTypeLabelKey } from '../orderPresentation';
import type { FulfilmentType } from '../types/order';

/** Display-only badge: "Take-away" or "In restaurant". */
export function FulfilmentTypeBadge({ type }: { type: FulfilmentType }) {
  const { t } = useLanguage();
  const color = type === 'TAKE_AWAY' ? colors.secondary : colors.primary;
  return (
    <View style={[styles.pill, { backgroundColor: `${color}15` }]}>
      <Ionicons
        name={getFulfilmentTypeIcon(type) as React.ComponentProps<typeof Ionicons>['name']}
        size={12}
        color={color}
      />
      <Text style={[styles.text, { color }]}>{t(getFulfilmentTypeLabelKey(type))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: { fontSize: 11, fontWeight: '700' },
});
