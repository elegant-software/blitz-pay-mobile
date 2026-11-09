import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import type { TranslationKeys } from '../lib/translations';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackNav } from '../types';
import { useLiveFloor } from '../features/tables/hooks/useLiveFloor';
import { useBranchRef } from '../features/tables/hooks/useBranchRef';
import { FloorPlanCanvas, LiveTablePin, PIN_COLORS } from '../features/tables/components/FloorPlanCanvas';
import {
  CenterState,
  TablesScreenFrame,
  tableStyles,
  useErrorText,
} from '../features/tables/components/TablesChrome';
import { exceedsBranchCapacity, seatedFor, tablePinTone, type TablePinTone } from '../features/tables/tableLogic';

const TONE_LABELS: Record<TablePinTone, TranslationKeys> = {
  free: 'table_status_free',
  unpaid: 'table_status_unpaid',
  paid: 'table_status_paid',
  reserved: 'table_status_reserved',
};

export default function FloorViewScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const { isManager } = useBranchRef();
  const vm = useLiveFloor({ live: true });
  const errorText = useErrorText();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  // Ticks every minute so "seated for" stays current between table events.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const frame = (children: React.ReactNode) => (
    <TablesScreenFrame
      title={t('floor_view_title')}
      onBack={() => navigation.goBack()}
      right={isManager ? { icon: 'settings-outline', label: t('tables_title'), onPress: () => navigation.navigate('Tables') } : undefined}
    >
      {children}
    </TablesScreenFrame>
  );

  if (vm.loading) return frame(<CenterState loading text={t('loading')} />);
  if (vm.loadError) {
    return frame(
      <CenterState icon="alert-circle-outline" text={errorText(vm.loadError)} action={{ label: t('kpi_retry'), onPress: () => void vm.reload() }} />,
    );
  }

  const { floorPlans, tables, summary } = vm.floor;
  if (tables.length === 0) {
    return frame(
      <CenterState
        icon="grid-outline"
        text={isManager ? t('floor_view_empty_manager') : t('floor_view_empty')}
        action={isManager ? { label: t('tables_title'), onPress: () => navigation.navigate('Tables') } : undefined}
      />,
    );
  }

  const plan = floorPlans.find((candidate) => candidate.id === selectedPlanId) ?? floorPlans[0] ?? null;
  const onPlan = plan ? tables.filter((live) => live.table.placement?.floorPlanId === plan.id) : [];
  const openTable = (tableId: string) => navigation.navigate('TableDetail', { tableId });

  return frame(
    <ScrollView
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={vm.refreshing} onRefresh={() => void vm.reload()} />}
    >
      <View style={styles.summary}>
        <SummaryStat icon="grid-outline" value={`${summary.occupiedTables}/${summary.totalTables}`} label={t('floor_summary_tables')} />
        <SummaryStat icon="people-outline" value={`${summary.totalGuests}/${summary.seatedCapacity}`} label={t('floor_summary_guests')} />
        <SummaryStat
          icon="business-outline"
          value={summary.branchCapacity != null ? String(summary.branchCapacity) : '–'}
          label={t('floor_summary_branch_capacity')}
          warn={exceedsBranchCapacity(summary.seatedCapacity, summary.branchCapacity)}
        />
      </View>
      {!vm.connected ? (
        <View style={styles.offline}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.gray600} />
          <Text style={styles.offlineText}>{t('floor_live_reconnecting')}</Text>
        </View>
      ) : null}

      {floorPlans.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {floorPlans.map((candidate) => (
            <TouchableOpacity
              key={candidate.id}
              style={[styles.tab, candidate.id === plan?.id && styles.tabActive]}
              onPress={() => setSelectedPlanId(candidate.id)}
            >
              <Text style={[styles.tabText, candidate.id === plan?.id && styles.tabTextActive]}>{candidate.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {plan ? (
        <View style={tableStyles.card}>
          <FloorPlanCanvas imageUrl={plan.imageUrl} areas={plan.areas} emptyLabel={t('floor_plan_no_photo')}>
            {(size) =>
              onPlan.map((live) => (
                <LiveTablePin
                  key={live.table.id}
                  label={live.table.name}
                  seats={live.table.seats}
                  guests={live.guestCount}
                  tone={tablePinTone(live)}
                  caption={live.status === 'OCCUPIED' ? seatedFor(live.occupiedSince, now) : undefined}
                  x={live.table.placement!.x}
                  y={live.table.placement!.y}
                  size={size}
                  onPress={() => openTable(live.table.id)}
                />
              ))
            }
          </FloorPlanCanvas>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendFree]} />
              <Text style={styles.legendText}>{t('table_status_free')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: PIN_COLORS.paid }]} />
              <Text style={styles.legendText}>{t('table_status_occupied')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendUnpaid]}>
                <Text style={styles.legendEuro}>€</Text>
              </View>
              <Text style={styles.legendText}>{t('table_status_unpaid')}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <Text style={styles.listTitle}>{t('floor_view_all_tables')}</Text>
      <View style={styles.grid}>
        {tables.map((live) => {
          const tone = tablePinTone(live);
          return (
            <TouchableOpacity
              key={live.table.id}
              style={[styles.tile, { borderColor: PIN_COLORS[tone] }]}
              onPress={() => openTable(live.table.id)}
            >
              <View style={tableStyles.row}>
                <Text style={[styles.tileName, styles.flex]} numberOfLines={1}>{live.table.name}</Text>
                <Ionicons name="people" size={12} color={colors.gray600} />
                <Text style={styles.tileMeta}>{`${live.guestCount ?? '–'}/${live.table.seats ?? '?'}`}</Text>
              </View>
              <Text style={[styles.tileStatus, { color: PIN_COLORS[tone] }]}>{t(TONE_LABELS[tone])}</Text>
              {live.orders.length > 0 ? (
                <View style={tableStyles.row}>
                  <Ionicons name="receipt-outline" size={12} color={colors.gray600} />
                  <Text style={styles.tileMeta}>{live.orders.length}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>,
  );
}

function SummaryStat({
  icon,
  value,
  label,
  warn,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  label: string;
  warn?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <View style={tableStyles.row}>
        <Ionicons name={icon} size={14} color={warn ? colors.warning : colors.gray600} />
        <Text style={[styles.statValue, warn && { color: colors.warning }]}>{value}</Text>
      </View>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  offlineText: { fontSize: 12, color: colors.gray600 },
  summary: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.sm, gap: 2 },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.onSurface },
  statLabel: { fontSize: 11, color: colors.gray600 },
  tabs: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  tabActive: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  tabTextActive: { color: colors.white },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  legendFree: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: '#B4B2A9' },
  legendUnpaid: { backgroundColor: '#EF9F27' },
  legendEuro: { fontSize: 8, fontWeight: '800', color: '#412402' },
  legendText: { fontSize: 12, color: colors.gray700 },
  listTitle: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray600,
    textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  tile: {
    width: '31%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing.sm,
    gap: 2,
  },
  tileName: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  tileStatus: { fontSize: 11, fontWeight: '700' },
  tileMeta: { fontSize: 11, color: colors.gray600 },
});
