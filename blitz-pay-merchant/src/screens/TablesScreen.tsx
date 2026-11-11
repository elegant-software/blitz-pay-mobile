import { useTheme } from "../lib/ThemeContext";
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { spacing, type ThemeColors } from '../lib/theme';
import type { RootStackNav } from '../types';
import { useTableSetup } from '../features/tables/hooks/useTableSetup';
import { parseBulkTableNames, parseSeatsInput } from '../features/tables/tableLogic';
import {
  CapacityWarning,
  CenterState,
  ErrorBanner,
  TablesScreenFrame,
  createTableStyles,
  useErrorText,
} from '../features/tables/components/TablesChrome';

export default function TablesScreen() {
  const { colors } = useTheme();
  const tableStyles = createTableStyles(colors);
  const styles = createStyles(colors);

  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const vm = useTableSetup();
  const errorText = useErrorText();
  const [bulkInput, setBulkInput] = useState('');
  const [seatsInput, setSeatsInput] = useState('');
  const preview = parseBulkTableNames(bulkInput);
  const seats = parseSeatsInput(seatsInput);

  const frame = (children: React.ReactNode) => (
    <TablesScreenFrame
      title={t('tables_title')}
      onBack={() => navigation.goBack()}
      right={vm.canManage ? { icon: 'map-outline', label: t('floor_plans_title'), onPress: () => navigation.navigate('FloorPlans') } : undefined}
    >
      {children}
    </TablesScreenFrame>
  );

  if (!vm.canManage) return frame(<CenterState icon="lock-closed-outline" text={t('tables_manager_only')} />);
  if (vm.loading) return frame(<CenterState loading text={t('loading')} />);
  if (vm.loadError) {
    return frame(
      <CenterState icon="alert-circle-outline" text={errorText(vm.loadError)} action={{ label: t('kpi_retry'), onPress: () => void vm.reload() }} />,
    );
  }

  return frame(
    <FlatList
      data={vm.tables}
      keyExtractor={(table) => table.id}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <>
          <View style={tableStyles.card}>
            <Text style={tableStyles.sectionTitle}>{t('tables_bulk_create_title')}</Text>
            <Text style={tableStyles.hint}>{t('tables_bulk_create_hint')}</Text>
            <TextInput
              style={[tableStyles.input, styles.bulkInput]}
              value={bulkInput}
              onChangeText={setBulkInput}
              placeholder={t('tables_bulk_create_placeholder')}
              placeholderTextColor={colors.gray500}
              multiline
            />
            <View style={[tableStyles.row, styles.seatsRow]}>
              <Text style={styles.seatsLabel}>{t('table_seats_label')}</Text>
              <TextInput
                style={[tableStyles.input, styles.seatsInput, !seats.valid && styles.invalid]}
                value={seatsInput}
                onChangeText={setSeatsInput}
                placeholder={t('table_seats_placeholder')}
                placeholderTextColor={colors.gray500}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            {!seats.valid ? <Text style={styles.invalidText}>{t('table_seats_invalid')}</Text> : null}
            <TouchableOpacity
              style={[tableStyles.primaryBtn, (vm.busy || preview.length === 0 || !seats.valid) && tableStyles.disabled]}
              disabled={vm.busy || preview.length === 0 || !seats.valid}
              onPress={async () => {
                if (await vm.createFromInput(bulkInput, seats.seats)) setBulkInput('');
              }}
            >
              <Ionicons name="add" size={18} color={colors.black} />
              <Text style={tableStyles.primaryBtnText}>
                {t('tables_bulk_create_action', { count: preview.length })}
              </Text>
            </TouchableOpacity>
          </View>
          <ErrorBanner error={vm.actionError} />
          <CapacityWarning seated={vm.seatedCapacity} capacity={vm.branchCapacity} />
          <Text style={styles.listTitle}>{t('tables_list_title', { count: vm.tables.length })}</Text>
        </>
      }
      ListEmptyComponent={<Text style={styles.empty}>{t('tables_empty')}</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('TableSettings', { tableId: item.id })}
        >
          <View style={[styles.dot, { backgroundColor: item.active ? colors.success : colors.gray400 }]} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t('table_label', { name: item.name })}</Text>
            <Text style={styles.rowSub}>
              {item.active ? t('table_active') : t('table_inactive')}
              {` · ${t('table_seats_value', { seats: item.seats ?? '?' })}`}
              {item.placement ? ` · ${t('table_placed')}` : ''}
            </Text>
          </View>
          <Ionicons name="qr-code-outline" size={18} color={colors.gray600} />
          <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
        </TouchableOpacity>
      )}
    />,
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  seatsRow: { marginBottom: spacing.sm },
  seatsLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.onSurface },
  seatsInput: { width: 72, textAlign: 'center' },
  invalid: { borderColor: colors.error },
  invalidText: { fontSize: 12, color: colors.error, marginBottom: spacing.sm },
  bulkInput: { minHeight: 64, marginVertical: spacing.sm, textAlignVertical: 'top' },
  listTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray600,
    textTransform: 'uppercase',
  },
  empty: { textAlign: 'center', color: colors.gray600, padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cardBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  rowSub: { fontSize: 12, color: colors.gray600, marginTop: 2 },
});
