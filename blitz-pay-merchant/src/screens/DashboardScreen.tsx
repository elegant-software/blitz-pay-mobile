import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { listMerchantAppearances, MerchantAppearanceError } from '../lib/merchantAppearances';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav, Order, OrderStatus } from '../types';

const MOCK_STATS = {
  revenueToday: 1284.5,
  revenueWeek: 8943.2,
  revenueMonth: 34210.8,
  pendingOrders: 7,
  completedOrders: 142,
  totalProducts: 38,
};

const MOCK_RECENT_ORDERS: Order[] = [
  { id: '1', orderNumber: '1042', amount: 89.9, currency: 'EUR', status: 'pending', createdAt: new Date().toISOString(), items: [] },
  { id: '2', orderNumber: '1041', amount: 245.0, currency: 'EUR', status: 'completed', createdAt: new Date(Date.now() - 3600000).toISOString(), items: [] },
  { id: '3', orderNumber: '1040', amount: 55.5, currency: 'EUR', status: 'processing', createdAt: new Date(Date.now() - 7200000).toISOString(), items: [] },
];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: colors.warning,
  processing: colors.primary,
  completed: colors.success,
  cancelled: colors.error,
  refunded: colors.gray500,
};

function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount);
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }) {
  return (
    <View style={[styles.statCard, shadow.sm]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { t } = useLanguage();
  const { user, activeBranchScope } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const [appearanceLoading, setAppearanceLoading] = useState(true);
  const [appearanceErrorKey, setAppearanceErrorKey] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);

  const loadAppearanceSummary = useCallback(async () => {
    if (!activeBranchScope) {
      setAppearanceLoading(false);
      setAppearanceErrorKey('merchant_branch_access_missing');
      setActiveCount(0);
      setUpcomingCount(0);
      return;
    }

    setAppearanceLoading(true);
    setAppearanceErrorKey(null);
    try {
      const appearances = await listMerchantAppearances(activeBranchScope.merchantId, activeBranchScope.branchId);
      const now = Date.now();
      setActiveCount(appearances.filter((appearance) => {
        const start = new Date(appearance.startTime).getTime();
        const end = new Date(appearance.endTime).getTime();
        return start <= now && end > now;
      }).length);
      setUpcomingCount(appearances.filter((appearance) => new Date(appearance.startTime).getTime() > now).length);
      setAppearanceLoading(false);
    } catch (error) {
      setActiveCount(0);
      setUpcomingCount(0);
      setAppearanceErrorKey(error instanceof MerchantAppearanceError ? error.key : 'merchant_appearances_load_failed');
      setAppearanceLoading(false);
    }
  }, [activeBranchScope]);

  useFocusEffect(
    useCallback(() => {
      void loadAppearanceSummary();
    }, [loadAppearanceSummary]),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 90 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={['#000000', '#0D0D2B']} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Good morning,</Text>
              <Text style={styles.merchantName}>{user?.name ?? 'Merchant'}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
                <Ionicons name="notifications-outline" size={22} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('MerchantQRCode', {})}>
                <Ionicons name="qr-code-outline" size={22} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Main revenue card */}
          <View style={styles.revenueCard}>
            <Text style={styles.revenueLabel}>{t('revenue_today')}</Text>
            <Text style={styles.revenueValue}>{formatCurrency(MOCK_STATS.revenueToday)}</Text>
            <View style={styles.revenueSub}>
              <View style={styles.revenueSubItem}>
                <Text style={styles.revenueSubLabel}>{t('revenue_week')}</Text>
                <Text style={styles.revenueSubValue}>{formatCurrency(MOCK_STATS.revenueWeek)}</Text>
              </View>
              <View style={styles.revenueSubDivider} />
              <View style={styles.revenueSubItem}>
                <Text style={styles.revenueSubLabel}>{t('revenue_month')}</Text>
                <Text style={styles.revenueSubValue}>{formatCurrency(MOCK_STATS.revenueMonth)}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard label={t('pending_orders')} value={String(MOCK_STATS.pendingOrders)} icon="time-outline" color={colors.warning} />
          <StatCard label={t('completed_orders')} value={String(MOCK_STATS.completedOrders)} icon="checkmark-circle-outline" color={colors.success} />
          <StatCard label={t('total_products')} value={String(MOCK_STATS.totalProducts)} icon="grid-outline" color={colors.secondary} />
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.appearanceCard, shadow.sm]}
            onPress={() => navigation.navigate('Appearances')}
            activeOpacity={0.8}
          >
            <View style={styles.appearanceCardHeader}>
              <View style={styles.appearanceIcon}>
                <Ionicons name="radio-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.appearanceCardContent}>
                <Text style={styles.appearanceCardTitle}>{t('merchant_appearances')}</Text>
                <Text style={styles.appearanceCardSubtitle}>{t('merchant_appearance_dashboard_body')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.gray500} />
            </View>

            {appearanceLoading ? (
              <View style={styles.appearanceSummaryLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.appearanceSummaryText}>{t('merchant_appearances_loading')}</Text>
              </View>
            ) : appearanceErrorKey ? (
              <Text style={styles.appearanceSummaryText}>{t(appearanceErrorKey as Parameters<typeof t>[0])}</Text>
            ) : (
              <View style={styles.appearanceSummaryRow}>
                <View style={styles.appearanceSummaryPill}>
                  <Text style={styles.appearanceSummaryLabel}>{t('merchant_appearance_active')}</Text>
                  <Text style={styles.appearanceSummaryValue}>{String(activeCount)}</Text>
                </View>
                <View style={styles.appearanceSummaryPill}>
                  <Text style={styles.appearanceSummaryLabel}>{t('merchant_appearance_upcoming')}</Text>
                  <Text style={styles.appearanceSummaryValue}>{String(upcomingCount)}</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Recent orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('recent_orders')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Main')}>
              <Text style={styles.viewAll}>{t('view_all')}</Text>
            </TouchableOpacity>
          </View>

          {MOCK_RECENT_ORDERS.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={[styles.orderRow, shadow.sm]}
              onPress={() => navigation.navigate('OrderDetail', {
                orderId: order.id,
                orderNumber: order.orderNumber,
                amount: order.amount,
                currency: order.currency,
                status: order.status,
              })}
              activeOpacity={0.7}
            >
              <View style={styles.orderLeft}>
                <Text style={styles.orderNum}>{t('order_number')}{order.orderNumber}</Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderAmount}>{formatCurrency(order.amount, order.currency)}</Text>
                <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[order.status]}20` }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[order.status] }]}>
                    {t(`status_${order.status}` as Parameters<typeof t>[0])}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  greeting: { fontSize: 13, color: colors.gray500 },
  merchantName: { fontSize: 22, fontWeight: '700', color: colors.white },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  revenueCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  revenueLabel: { fontSize: 13, color: colors.gray400, marginBottom: 4 },
  revenueValue: { fontSize: 36, fontWeight: '800', color: colors.white, letterSpacing: -1 },
  revenueSub: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.md },
  revenueSubItem: { flex: 1 },
  revenueSubDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  revenueSubLabel: { fontSize: 11, color: colors.gray500 },
  revenueSubValue: { fontSize: 15, fontWeight: '600', color: colors.white },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1, backgroundColor: colors.white,
    borderRadius: radius.xl, padding: spacing.md, alignItems: 'flex-start',
  },
  statIcon: { width: 36, height: 36, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.onSurface },
  statLabel: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  viewAll: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  appearanceCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  appearanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  appearanceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appearanceCardContent: { flex: 1 },
  appearanceCardTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  appearanceCardSubtitle: { marginTop: 2, fontSize: 12, color: colors.gray600 },
  appearanceSummaryLoading: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  appearanceSummaryRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  appearanceSummaryPill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  appearanceSummaryLabel: { fontSize: 11, color: colors.gray500, fontWeight: '600' },
  appearanceSummaryValue: { marginTop: 4, fontSize: 18, fontWeight: '800', color: colors.onSurface },
  appearanceSummaryText: { marginTop: spacing.md, fontSize: 13, color: colors.gray600 },
  orderRow: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.md, marginBottom: spacing.sm,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  orderLeft: { flex: 1 },
  orderNum: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  orderRight: { alignItems: 'flex-end', gap: 4 },
  orderAmount: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  statusPill: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '600' },
});
