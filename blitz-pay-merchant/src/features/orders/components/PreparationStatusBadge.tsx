import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../../lib/LanguageContext';
import { radius } from '../../../lib/theme';
import {
  getPreparationStatusColor,
  getPreparationStatusIcon,
  getPreparationStatusLabelKey,
} from '../orderPresentation';
import type { MerchantPreparationStatus } from '../types/order';

/** Display-only Preparation Status badge. Merchants advance the status on the Kitchen Screen. */
export function PreparationStatusBadge({ status }: { status: MerchantPreparationStatus }) {
  const { t } = useLanguage();
  const color = getPreparationStatusColor(status);
  return (
    <View style={[styles.pill, { backgroundColor: `${color}15` }]}>
      <Ionicons
        name={getPreparationStatusIcon(status) as React.ComponentProps<typeof Ionicons>['name']}
        size={12}
        color={color}
      />
      <Text style={[styles.text, { color }]}>{t(getPreparationStatusLabelKey(status))}</Text>
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
