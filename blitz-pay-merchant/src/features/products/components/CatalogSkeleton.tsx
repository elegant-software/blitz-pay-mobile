import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLanguage } from '../../../lib/LanguageContext';
import { colors, radius, spacing } from '../../../lib/theme';

export function CatalogSkeleton() {
  const { t } = useLanguage();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={t('catalog_loading')} style={styles.container}>
      {Array.from({ length: 6 }, (_, index) => (
        <View key={index} style={styles.row} accessible={false}>
          <View style={styles.image} />
          <View style={styles.text}>
            <View style={styles.title} />
            <View style={styles.subtitle} />
          </View>
          <View style={styles.price} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.md },
  row: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  image: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.gray200 },
  text: { flex: 1, gap: spacing.sm },
  title: { height: 14, width: '75%', borderRadius: radius.sm, backgroundColor: colors.gray200 },
  subtitle: { height: 12, width: '45%', borderRadius: radius.sm, backgroundColor: colors.gray200 },
  price: { height: 14, width: 45, borderRadius: radius.sm, backgroundColor: colors.gray200 },
});
