import { colors, theme } from '../lib/theme';
import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { spacing, radius, shadow } from '../lib/theme';
import { useSettlementSummary } from '../features/reporting/hooks/useSettlementSummary';
import { useMerchantKpi, toIsoDate } from '../features/reporting/hooks/useMerchantKpi';
import { useMerchantOrders } from '../features/orders/hooks/useMerchantOrders';
import { useMerchantProducts } from '../features/products/hooks/useMerchantProducts';
import { useMerchantFeatures } from '../lib/useMerchantFeatures';
import { formatPickupNumber, getMerchantOrderStatusLabelKey } from '../features/orders/orderPresentation';
import type { MerchantOrderStatus } from '../features/orders/types/order';
import type { PaymentMethodFrequency } from '../features/reporting/types/kpi';
import type { RootStackNav } from '../types';

type Period = 'today' | 'week' | 'month';

const ORDER_STATUS_COLORS: Record<MerchantOrderStatus, string> = {
  awaiting_payment: colors.warning,
  payment_in_progress: colors.primary,
  payment_failed: colors.error,
  paid: colors.success,
  cancelled: colors.error,
};

function formatCurrency(minorUnits: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(minorUnits / 100);
}

function computeDateRange(period: Period): { from: string; to: string } {
  const today = new Date();
  const to = toIsoDate(today);
  if (period === 'today') return { from: to, to };
  if (period === 'week') {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return { from: toIsoDate(d), to };
  }
  return { from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, loading }: {
  label: string; value: string;
  icon: React.ComponentProps<typeof Ionicons>['name']; color: string; loading?: boolean;
}) {
  return (
    <View style={[styles.statCard, shadow.sm]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      {loading
        ? <ActivityIndicator color={color} size="small" style={styles.statLoader} />
        : <Text style={styles.statValue}>{value}</Text>
      }
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function KpiCardShell({ icon, title, loading, children }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string; loading: boolean; children: React.ReactNode;
}) {
  return (
    <View style={[styles.kpiCard, shadow.sm]}>
      <View style={styles.kpiCardHeader}>
        <View style={styles.kpiCardIcon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <Text style={styles.kpiCardTitle}>{title}</Text>
      </View>
      {loading
        ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />
        : children}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { headerGradient } = theme;
  const { t } = useLanguage();
  const { user, activeBranchScope, branchScopeError } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();

  const [period, setPeriod] = useState<Period>('week');

  const merchantId = activeBranchScope?.merchantId ?? user?.merchantId ?? null;
  const branchId = user?.role === 'EMPLOYEE' ? (activeBranchScope?.branchId ?? null) : null;

  const { from, to } = useMemo(() => computeDateRange(period), [period]);

  const { report, loading: kpiLoading } = useMerchantKpi(merchantId, from, to, branchId);
  const { orders, loading: ordersLoading } = useMerchantOrders(activeBranchScope?.branchId ?? null);
  const { products } = useMerchantProducts(activeBranchScope, branchScopeError);
  const { appointmentsEnabled } = useMerchantFeatures();
  const { summary: settlementSummary, loading: settlementLoading, error: settlementError } =
    useSettlementSummary(activeBranchScope?.merchantId ?? null);

  const recentOrders = orders.slice(0, 5);

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: t('period_today') },
    { key: 'week',  label: t('period_week')  },
    { key: 'month', label: t('period_month') },
  ];

  const periodLabel =
    period === 'today' ? t('revenue_today') :
    period === 'week'  ? t('revenue_week')  :
                         t('revenue_month');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Dark header ── */}
        <LinearGradient colors={headerGradient} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Good morning,</Text>
              <Text style={styles.merchantName}>{activeBranchScope?.merchantName ?? user?.name ?? 'Merchant'}</Text>
              {activeBranchScope?.branchName ? <Text style={styles.greeting}>{activeBranchScope.branchName}</Text> : null}
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

          {/* Period selector — lives inside the gradient so it reads as part of the hero */}
          <View style={styles.periodRow}>
            {PERIODS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.periodBtn, period === key && styles.periodBtnActive]}
                onPress={() => setPeriod(key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.periodBtnText, period === key && styles.periodBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Net revenue card */}
          <View style={styles.revenueCard}>
            <Text style={styles.revenueLabel}>{t('kpi_revenue_net')} · {periodLabel}</Text>
            {kpiLoading
              ? <ActivityIndicator color={colors.white} size="large" style={{ marginVertical: 8 }} />
              : <Text style={styles.revenueValue}>
                  {report ? formatCurrency(report.revenue.netAmountMinor, report.revenue.currency) : '—'}
                </Text>
            }
            <View style={styles.revenueSub}>
              <View style={styles.revenueSubItem}>
                <Text style={styles.revenueSubLabel}>{t('kpi_revenue_gross')}</Text>
                <Text style={styles.revenueSubValue}>
                  {report ? formatCurrency(report.revenue.grossAmountMinor, report.revenue.currency) : '—'}
                </Text>
              </View>
              <View style={styles.revenueSubDivider} />
              <View style={styles.revenueSubItem}>
                <Text style={styles.revenueSubLabel}>{t('kpi_revenue_settled_count')}</Text>
                <Text style={styles.revenueSubValue}>
                  {report ? String(report.revenue.settledTransactionCount) : '—'}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── Stats grid ── */}
        <View style={styles.statsGrid}>
          <StatCard
            label={t('pending_orders')}
            value={report ? String(report.orders.pendingCount) : '0'}
            icon="time-outline"
            color={colors.warning}
            loading={kpiLoading}
          />
          <StatCard
            label={t('completed_orders')}
            value={report ? String(report.orders.paidCount) : '0'}
            icon="checkmark-circle-outline"
            color={colors.success}
            loading={kpiLoading}
          />
          <StatCard
            label={t('total_products')}
            value={String(products.length)}
            icon="grid-outline"
            color={colors.secondary}
          />
        </View>

        {/* ── Settlement summary (always this month) ── */}
        <View style={styles.section}>
          <View style={[styles.settlementCard, shadow.sm]}>
            <View style={styles.settlementHeader}>
              <View style={styles.settlementIcon}>
                <Ionicons name="card-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.settlementTitle}>{t('settlements_this_month')}</Text>
            </View>
            {settlementLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.settlementLoader} />
            ) : settlementError ? (
              <Text style={styles.settlementError}>{t('settlements_summary_load_failed')}</Text>
            ) : (
              <View style={styles.settlementRow}>
                <View style={styles.settlementStat}>
                  <Text style={styles.settlementStatLabel}>{t('settlements_transactions')}</Text>
                  <Text style={styles.settlementStatValue}>
                    {String(settlementSummary?.transactionCount ?? 0)}
                  </Text>
                </View>
                <View style={styles.settlementDivider} />
                <View style={styles.settlementStat}>
                  <Text style={styles.settlementStatLabel}>{t('settlements_gross')}</Text>
                  <Text style={styles.settlementStatValue}>
                    {formatCurrency(settlementSummary?.grossAmountMinor ?? 0, settlementSummary?.currency ?? 'EUR')}
                  </Text>
                </View>
                <View style={styles.settlementDivider} />
                <View style={styles.settlementStat}>
                  <Text style={styles.settlementStatLabel}>{t('settlements_net')}</Text>
                  <Text style={[styles.settlementStatValue, styles.settlementNetValue]}>
                    {formatCurrency(settlementSummary?.netAmountMinor ?? 0, settlementSummary?.currency ?? 'EUR')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ── Appointments KPI ── */}
        {appointmentsEnabled && (
          <View style={styles.section}>
            <KpiCardShell icon="calendar-outline" title={`${t('kpi_appointments_section')} · ${periodLabel}`} loading={kpiLoading}>
              <View style={styles.kpiRow}>
                <View style={styles.kpiStat}>
                  <Text style={styles.kpiStatValue}>{String(report?.appointments.bookedCount ?? 0)}</Text>
                  <Text style={styles.kpiStatLabel}>{t('kpi_appointments_booked')}</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpiStat}>
                  <Text style={[styles.kpiStatValue, { color: colors.success }]}>{String(report?.appointments.completedCount ?? 0)}</Text>
                  <Text style={styles.kpiStatLabel}>{t('kpi_appointments_completed')}</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpiStat}>
                  <Text style={[styles.kpiStatValue, { color: colors.error }]}>{String(report?.appointments.cancelledCount ?? 0)}</Text>
                  <Text style={styles.kpiStatLabel}>{t('kpi_appointments_cancelled')}</Text>
                </View>
              </View>
            </KpiCardShell>
          </View>
        )}

        {/* ── Payment methods ── */}
        {!kpiLoading && (report?.paymentMethodFrequency.length ?? 0) > 0 && (
          <View style={styles.section}>
            <KpiCardShell icon="card-outline" title={t('kpi_payment_methods_section')} loading={false}>
              {report!.paymentMethodFrequency.map((item: PaymentMethodFrequency) => (
                <View key={item.paymentMethod} style={styles.methodRow}>
                  <Text style={styles.methodName}>{item.paymentMethod.replace(/_/g, ' ')}</Text>
                  <View style={styles.methodBarWrap}>
                    <View style={[styles.methodBar, { width: `${Math.min(item.sharePercent, 100)}%` as any }]} />
                  </View>
                  <Text style={styles.methodShare}>{item.sharePercent.toFixed(1)}%</Text>
                </View>
              ))}
            </KpiCardShell>
          </View>
        )}

        {/* ── Recent orders ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('recent_orders')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Main')}>
              <Text style={styles.viewAll}>{t('view_all')}</Text>
            </TouchableOpacity>
          </View>

          {ordersLoading && (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          )}

          {!ordersLoading && recentOrders.map((order) => (
            <TouchableOpacity
              key={order.orderId}
              style={[styles.orderRow, shadow.sm]}
              onPress={() => navigation.navigate('OrderDetail', { orderId: order.orderId })}
              activeOpacity={0.7}
            >
              <View style={styles.orderLeft}>
                <Text style={styles.orderNum}>
                  {order.pickupNumber != null ? `${formatPickupNumber(order.pickupNumber)} · ` : ''}
                  {order.orderId.slice(-8).toUpperCase()}
                </Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderAmount}>{formatCurrency(order.amountMinor, order.currency)}</Text>
                <View style={[styles.statusPill, { backgroundColor: `${ORDER_STATUS_COLORS[order.status]}20` }]}>
                  <Text style={[styles.statusText, { color: ORDER_STATUS_COLORS[order.status] }]}>
                    {t(getMerchantOrderStatusLabelKey(order.status))}
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  // Header
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

  // Period selector
  periodRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.full,
    padding: 4,
    alignSelf: 'flex-start',
  },
  periodBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  periodBtnActive: {
    backgroundColor: colors.primary,
  },
  periodBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  periodBtnTextActive: {
    color: colors.onPrimary,
  },

  // Revenue card
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

  // Stats grid
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
  statLoader: { marginVertical: 4 },

  // Sections
  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  viewAll: { fontSize: 14, color: colors.primary, fontWeight: '600' },

  // Settlement card
  settlementCard: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.md },
  settlementHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  settlementIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: `${colors.primary}15`, justifyContent: 'center', alignItems: 'center',
  },
  settlementTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  settlementLoader: { marginVertical: spacing.sm },
  settlementError: { fontSize: 13, color: colors.error },
  settlementRow: { flexDirection: 'row', alignItems: 'center' },
  settlementStat: { flex: 1, alignItems: 'center' },
  settlementStatLabel: { fontSize: 11, color: colors.gray500, fontWeight: '600', marginBottom: 4 },
  settlementStatValue: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  settlementNetValue: { color: colors.success },
  settlementDivider: { width: 1, height: 32, backgroundColor: colors.surface },

  // KPI cards (appointments, payment methods)
  kpiCard: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.md },
  kpiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  kpiCardIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: `${colors.primary}15`, justifyContent: 'center', alignItems: 'center',
  },
  kpiCardTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  kpiRow: { flexDirection: 'row', alignItems: 'center' },
  kpiStat: { flex: 1, alignItems: 'center' },
  kpiStatValue: { fontSize: 20, fontWeight: '800', color: colors.onSurface },
  kpiStatLabel: { fontSize: 11, color: colors.gray500, fontWeight: '600', marginTop: 2 },
  kpiDivider: { width: 1, height: 36, backgroundColor: colors.surface },

  // Payment method bars
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  methodName: { fontSize: 12, color: colors.gray700, width: 110 },
  methodBarWrap: {
    flex: 1, height: 6, backgroundColor: colors.surface,
    borderRadius: radius.full, overflow: 'hidden',
  },
  methodBar: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
  methodShare: { fontSize: 12, fontWeight: '600', color: colors.onSurface, width: 44, textAlign: 'right' },

  // Recent orders
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
