import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../../lib/LanguageContext';
import { colors, radius, spacing } from '../../../lib/theme';

type Props = {
  loading: boolean;
  hasMore: boolean;
  error?: string;
  onLoadMore: () => void;
  onRetry: () => void;
};

export function CatalogListFooter({ loading, hasMore, error, onLoadMore, onRetry }: Props) {
  const { t } = useLanguage();
  if (!loading && !hasMore && !error) return null;
  return (
    <View style={styles.container}>
      {loading ? (
        <View accessibilityRole="progressbar" accessibilityLabel={t('catalog_loading_more')}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={styles.button}>
            <Text style={styles.label}>{t('retry')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity accessibilityRole="button" onPress={onLoadMore} style={styles.button}>
          <Text style={styles.label}>{t('catalog_load_more')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, alignItems: 'center', gap: spacing.sm },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, backgroundColor: colors.primary, borderRadius: radius.full },
  label: { color: colors.black, fontWeight: '600' },
  error: { color: colors.error, textAlign: 'center' },
});
