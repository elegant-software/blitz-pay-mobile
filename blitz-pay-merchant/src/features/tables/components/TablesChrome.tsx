import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../../../lib/LanguageContext';
import type { TranslationKeys } from '../../../lib/translations';
import { colors, radius, spacing } from '../../../lib/theme';
import type { TableActionError } from '../hooks/useBranchRef';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function TablesScreenFrame({
  title,
  onBack,
  right,
  children,
}: {
  title: string;
  onBack: () => void;
  right?: { icon: IconName; label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {right ? (
          <TouchableOpacity onPress={right.onPress} style={styles.headerBtn} accessibilityLabel={right.label}>
            <Ionicons name={right.icon} size={22} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>
      {children}
    </View>
  );
}

export function useErrorText() {
  const { t } = useLanguage();
  return (error: TableActionError) => error.detail || t(error.key as TranslationKeys);
}

export function ErrorBanner({ error }: { error: TableActionError | null }) {
  const errorText = useErrorText();
  if (!error) return null;
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
      <Text style={styles.errorText}>{errorText(error)}</Text>
    </View>
  );
}

/** Branch Capacity never blocks; this only tells the manager the seats exceed it. */
export function CapacityWarning({ seated, capacity }: { seated: number; capacity: number | null }) {
  const { t } = useLanguage();
  if (capacity == null || seated <= capacity) return null;
  return (
    <View style={[styles.errorBanner, styles.warningBanner]}>
      <Ionicons name="warning-outline" size={16} color={colors.warning} />
      <Text style={styles.errorText}>{t('tables_capacity_warning', { seated, capacity })}</Text>
    </View>
  );
}

export function CenterState({
  loading,
  icon,
  text,
  action,
}: {
  loading?: boolean;
  icon?: IconName;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.center}>
      {loading ? <ActivityIndicator size="large" color={colors.primary} /> : icon ? <Ionicons name={icon} size={36} color={colors.gray500} /> : null}
      <Text style={styles.centerText}>{text}</Text>
      {action ? (
        <TouchableOpacity style={styles.centerAction} onPress={action.onPress}>
          <Text style={styles.centerActionText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export const tableStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.sm },
  hint: { fontSize: 13, color: colors.gray600, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.onSurface,
    backgroundColor: colors.white,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: colors.black },
  secondaryBtn: {
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  dangerBtnText: { fontSize: 14, fontWeight: '700', color: colors.error },
  disabled: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  errorBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.sm,
    backgroundColor: `${colors.error}10`,
  },
  errorText: { flex: 1, fontSize: 13, color: colors.onSurface },
  warningBanner: { backgroundColor: `${colors.warning}15` },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  centerText: { fontSize: 14, color: colors.gray600, textAlign: 'center' },
  centerAction: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  centerActionText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
