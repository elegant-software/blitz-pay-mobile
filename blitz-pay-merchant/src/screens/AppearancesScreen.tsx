import { useTheme } from "../lib/ThemeContext";
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { radius, shadow, spacing, type ThemeColors } from '../lib/theme';
import { useAppearances } from '../features/appearances/hooks/useAppearances';
import type { AppearanceHistoryStatus, MerchantAppearance } from '../features/appearances/types/appearance';
import type { RootStackNav } from '../types';

type Tab = 'ACTIVE' | 'UPCOMING' | 'HISTORY';
const yearAgo = () => new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

export default function AppearancesScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { user, activeBranchScope } = useAuth();
  const { t, language } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const vm = useAppearances(user, activeBranchScope);
  const [tab, setTab] = useState<Tab>('ACTIVE');
  const [status, setStatus] = useState<AppearanceHistoryStatus | undefined>();
  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(0);

  const loadHistory = useCallback(() => vm.loadHistory({
    status,
    from: new Date(`${from}T00:00:00`).toISOString(),
    to: new Date(`${to}T23:59:59`).toISOString(),
    page,
  }), [from, page, status, to, vm.loadHistory]);

  useFocusEffect(useCallback(() => {
    if (vm.eligible) void (tab === 'HISTORY' ? loadHistory() : vm.loadOperational());
  }, [loadHistory, tab, vm.eligible, vm.loadOperational]));

  useEffect(() => { if (tab === 'HISTORY' && vm.eligible) void loadHistory(); }, [loadHistory, tab, vm.eligible]);

  if (!vm.eligible) {
    return <ScreenFrame title={t('merchant_appearances')} onBack={() => navigation.goBack()} top={insets.top}>
      <State icon="lock-closed-outline" text={t('merchant_appearance_access_denied')} />
    </ScreenFrame>;
  }

  const items = tab === 'ACTIVE' ? vm.active : tab === 'UPCOMING' ? vm.upcoming : vm.history?.content ?? [];
  const cancel = (item: MerchantAppearance) => Alert.alert(
    t('merchant_appearance_cancel_title'),
    t('merchant_appearance_cancel_body'),
    [{ text: t('cancel'), style: 'cancel' }, {
      text: t('confirm'), style: 'destructive', onPress: () => void vm.cancel(item.appearanceId).catch(() => undefined),
    }],
  );

  return <ScreenFrame title={t('merchant_appearances')} onBack={() => navigation.goBack()} top={insets.top}>
    <Text style={styles.scope}>{activeBranchScope?.branchName}</Text>
    <View style={styles.tabs}>
      {(['ACTIVE', 'UPCOMING', 'HISTORY'] as Tab[]).map(value => (
        <TouchableOpacity key={value} style={[styles.tab, tab === value && styles.tabActive]} onPress={() => { setTab(value); setPage(0); }}>
          <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{t(`merchant_appearance_${value.toLowerCase()}` as Parameters<typeof t>[0])}</Text>
        </TouchableOpacity>
      ))}
    </View>
    {tab === 'HISTORY' ? <View style={styles.filters}>
      <View style={styles.filterRow}>
        {[undefined, 'COMPLETED', 'CANCELLED'].map(value => (
          <TouchableOpacity key={value ?? 'ALL'} style={[styles.filterPill, status === value && styles.filterPillActive]} onPress={() => { setStatus(value as AppearanceHistoryStatus | undefined); setPage(0); }}>
            <Text style={{ color: colors.onSurface }}>{value ? t(`merchant_appearance_status_${value.toLowerCase()}` as Parameters<typeof t>[0]) : t('all')}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.filterRow}>
        <TextInput style={styles.dateInput} value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" />
        <TextInput style={styles.dateInput} value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" />
      </View>
    </View> : null}
    {vm.loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : vm.error ? <State icon="alert-circle-outline" text={vm.error} /> :
      items.length === 0 ? <State icon="calendar-outline" text={t('merchant_appearance_empty')} /> :
      items.map(item => <AppearanceCard key={item.appearanceId} item={item} locale={language === 'de' ? 'de-DE' : 'en-US'} cancelLabel={t('cancel')} onCancel={vm.canCreate && tab !== 'HISTORY' ? () => cancel(item) : undefined} />)}
    {tab === 'HISTORY' && (vm.history?.totalPages ?? 0) > 1 ? <View style={styles.pagination}>
      <TouchableOpacity disabled={page === 0} onPress={() => setPage(p => p - 1)}><Text style={{ color: colors.onSurface }}>{t('previous')}</Text></TouchableOpacity>
      <Text style={{ color: colors.onSurface }}>{page + 1} / {vm.history?.totalPages}</Text>
      <TouchableOpacity disabled={page + 1 >= (vm.history?.totalPages ?? 0)} onPress={() => setPage(p => p + 1)}><Text style={{ color: colors.onSurface }}>{t('next')}</Text></TouchableOpacity>
    </View> : null}
    {vm.canCreate && <TouchableOpacity style={styles.create} onPress={() => navigation.navigate('CreateAppearance')}>
      <Ionicons name="add" size={20} color={colors.black} /><Text style={styles.createText}>{t('merchant_appearance_create_cta')}</Text>
    </TouchableOpacity>}
  </ScreenFrame>;
}

function ScreenFrame({ title, onBack, top, children }: { title: string; onBack: () => void; top: number; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return <View style={[styles.container, { paddingTop: top }]}>
    <View style={styles.header}><TouchableOpacity onPress={onBack}><Ionicons name="chevron-back" size={24} /></TouchableOpacity><Text style={styles.title}>{title}</Text></View>
    <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
  </View>;
}

function State({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return <View style={[styles.state, shadow.sm]}><Ionicons name={icon} size={28} color={colors.gray500} /><Text style={styles.stateText}>{text}</Text></View>;
}

function AppearanceCard({ item, locale, cancelLabel, onCancel }: { item: MerchantAppearance; locale: string; cancelLabel: string; onCancel?: () => void }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const format = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  return <View style={[styles.card, shadow.sm]}>
    <View style={styles.cardHeader}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.status}>{item.status}</Text></View>
    <Text style={styles.meta}>{format(item.startTime)} - {format(item.endTime)}</Text>
    <Text style={styles.meta}>{item.declaredLatitude.toFixed(5)}, {item.declaredLongitude.toFixed(5)}</Text>
    {item.cancelledAt ? <Text style={styles.meta}>{format(item.cancelledAt)}</Text> : null}
    {onCancel ? <TouchableOpacity onPress={onCancel}><Text style={styles.cancelText}>{cancelLabel}</Text></TouchableOpacity> : null}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', padding: spacing.md, backgroundColor: colors.background },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: '800' }, content: { padding: spacing.md, paddingBottom: 120, gap: spacing.sm }, scope: { color: colors.gray600 },
  tabs: { flexDirection: 'row', backgroundColor: colors.cardBg, borderRadius: radius.full, padding: 4 }, tab: { flex: 1, padding: spacing.sm, alignItems: 'center', borderRadius: radius.full },
  tabActive: { backgroundColor: colors.primary }, tabText: { color: colors.onSurface, fontSize: 12, fontWeight: '600' }, tabTextActive: { color: colors.black },
  filters: { gap: spacing.sm }, filterRow: { flexDirection: 'row', gap: spacing.sm }, filterPill: { padding: spacing.sm, backgroundColor: colors.cardBg, borderRadius: radius.full },
  filterPillActive: { backgroundColor: colors.primary }, dateInput: { flex: 1, backgroundColor: colors.cardBg, padding: spacing.sm, borderRadius: radius.lg },
  loader: { marginTop: spacing.xl }, state: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, backgroundColor: colors.cardBg, borderRadius: radius.xl },
  stateText: { textAlign: 'center', color: colors.gray600 }, card: { backgroundColor: colors.cardBg, padding: spacing.md, borderRadius: radius.xl, gap: spacing.xs },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' }, cardTitle: { color: colors.onSurface, fontWeight: '700', fontSize: 16 }, status: { fontSize: 11, color: colors.secondary },
  meta: { color: colors.gray600, fontSize: 12 }, cancelText: { color: colors.error, fontWeight: '700', marginTop: spacing.xs },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md }, create: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.full },
  createText: { color: colors.onSurface, fontWeight: '700' },
});
