import { useTheme } from "../lib/ThemeContext";
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { spacing, radius, shadow, type ThemeColors } from '../lib/theme';
import { useMerchantKpi, toIsoDate } from '../features/reporting/hooks/useMerchantKpi';
import type { PaymentMethodFrequency, OrderTypeCount } from '../features/reporting/types/kpi';
import type { TranslationKeys } from '../lib/translations';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatCurrency(minorUnits: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(minorUnits / 100);
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return toIsoDate(d);
}

function defaultTo(): string {
  return toIsoDate(new Date());
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function KpiRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.kpiRow}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, highlight && styles.kpiValueHighlight]}>{value}</Text>
    </View>
  );
}

function KpiCard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return <View style={[styles.card, shadow.sm]}>{children}</View>;
}

function PaymentMethodBar({ item }: { item: PaymentMethodFrequency }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.methodRow}>
      <Text style={styles.methodName}>{item.paymentMethod}</Text>
      <View style={styles.methodBarWrap}>
        <View style={[styles.methodBar, { width: `${Math.min(item.sharePercent, 100)}%` }]} />
      </View>
      <Text style={styles.methodCount}>{String(item.transactionCount)}</Text>
      <Text style={styles.methodShare}>{item.sharePercent.toFixed(1)}%</Text>
    </View>
  );
}

function OrderTypeRow({ item }: { item: OrderTypeCount }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.kpiRow}>
      <Text style={styles.kpiLabel}>{item.orderType.replace(/_/g, ' ')}</Text>
      <Text style={styles.kpiValue}>{String(item.count)}</Text>
    </View>
  );
}

// ──────────────────────────────────────────────
// DateRangePicker — lightweight plain-text inputs
// ──────────────────────────────────────────────

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  fromLabel: string;
  toLabel: string;
}

function DateRangePicker({ from, to, onFromChange, onToChange, fromLabel, toLabel }: DateRangePickerProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.dateRangeRow}>
      <View style={styles.dateField}>
        <Text style={styles.dateFieldLabel}>{fromLabel}</Text>
        <TextInput
          style={styles.dateInput}
          value={from}
          onChangeText={onFromChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.gray400}
          keyboardType={Platform.OS === 'ios' ? 'default' : 'default'}
          maxLength={10}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
      <Ionicons name="arrow-forward" size={16} color={colors.gray500} style={styles.dateArrow} />
      <View style={styles.dateField}>
        <Text style={styles.dateFieldLabel}>{toLabel}</Text>
        <TextInput
          style={styles.dateInput}
          value={to}
          onChangeText={onToChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.gray400}
          keyboardType="default"
          maxLength={10}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────

export default function MerchantKpiDashboardScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLanguage();
  const { activeBranchScope, user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const merchantId = activeBranchScope?.merchantId ?? user?.merchantId ?? null;
  // Managers see merchant-wide; employees see branch-scoped KPIs
  const branchId = user?.role === 'EMPLOYEE' ? (activeBranchScope?.branchId ?? null) : null;

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const { report, loading, error, refetch } = useMerchantKpi(merchantId, from, to, branchId);

  const scopeLabel =
    branchId
      ? `${t('kpi_scope_branch')}: ${activeBranchScope?.branchName ?? branchId}`
      : t('kpi_scope_merchant');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('kpi_dashboard_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Scope pill */}
        <View style={styles.scopePill}>
          <Ionicons
            name={branchId ? 'storefront-outline' : 'business-outline'}
            size={13}
            color={colors.primary}
          />
          <Text style={styles.scopeText}>{scopeLabel}</Text>
        </View>

        {/* Date range */}
        <KpiCard>
          <SectionHeader title={t('kpi_date_range')} icon="calendar-outline" />
          <DateRangePicker
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            fromLabel={t('kpi_from')}
            toLabel={t('kpi_to')}
          />
        </KpiCard>

        {/* Loading */}
        {loading && (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.stateText}>{t('kpi_loading')}</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error && (
          <View style={styles.stateBox}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
            <Text style={styles.stateText}>{t('kpi_load_failed')}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => void refetch()} activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>{t('kpi_retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* No data */}
        {!loading && !error && !report && (
          <View style={styles.stateBox}>
            <Ionicons name="bar-chart-outline" size={40} color={colors.gray400} />
            <Text style={styles.stateText}>{t('kpi_no_data')}</Text>
          </View>
        )}

        {/* KPI cards */}
        {!loading && !error && report && (
          <>
            {/* Revenue */}
            <KpiCard>
              <SectionHeader title={t('kpi_revenue_section')} icon="cash-outline" />
              <KpiRow
                label={t('kpi_revenue_gross')}
                value={formatCurrency(report.revenue.grossAmountMinor, report.revenue.currency)}
              />
              <KpiRow
                label={t('kpi_revenue_processing_fee')}
                value={formatCurrency(report.revenue.processingFeeMinor, report.revenue.currency)}
              />
              <KpiRow
                label={t('kpi_revenue_platform_fee')}
                value={formatCurrency(report.revenue.platformFeeMinor, report.revenue.currency)}
              />
              <View style={styles.divider} />
              <KpiRow
                label={t('kpi_revenue_net')}
                value={formatCurrency(report.revenue.netAmountMinor, report.revenue.currency)}
                highlight
              />
              <KpiRow
                label={t('kpi_revenue_settled_count')}
                value={String(report.revenue.settledTransactionCount)}
              />
            </KpiCard>

            {/* Orders */}
            <KpiCard>
              <SectionHeader title={t('kpi_orders_section')} icon="receipt-outline" />
              <KpiRow label={t('kpi_orders_paid')} value={String(report.orders.paidCount)} />
              <KpiRow label={t('kpi_orders_pending')} value={String(report.orders.pendingCount)} />
              <KpiRow
                label={t('kpi_orders_failed_cancelled')}
                value={String(report.orders.failedOrCancelledCount)}
              />
              {report.orders.byOrderType.length > 0 && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.subSectionLabel}>{t('kpi_orders_by_type')}</Text>
                  {report.orders.byOrderType.map((item) => (
                    <OrderTypeRow key={item.orderType} item={item} />
                  ))}
                </>
              )}
            </KpiCard>

            {/* Appointments */}
            <KpiCard>
              <SectionHeader title={t('kpi_appointments_section')} icon="calendar-outline" />
              <KpiRow label={t('kpi_appointments_booked')} value={String(report.appointments.bookedCount)} />
              <KpiRow label={t('kpi_appointments_completed')} value={String(report.appointments.completedCount)} />
              <KpiRow label={t('kpi_appointments_cancelled')} value={String(report.appointments.cancelledCount)} />
            </KpiCard>

            {/* Payment methods */}
            {report.paymentMethodFrequency.length > 0 && (
              <KpiCard>
                <SectionHeader title={t('kpi_payment_methods_section')} icon="card-outline" />
                {report.paymentMethodFrequency.map((item) => (
                  <PaymentMethodBar key={item.paymentMethod} item={item} />
                ))}
              </KpiCard>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: `${colors.primary}15`,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  scopeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  kpiLabel: { fontSize: 14, color: colors.gray700, flex: 1 },
  kpiValue: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  kpiValueHighlight: { fontSize: 16, fontWeight: '800', color: colors.success },
  divider: { height: 1, backgroundColor: colors.gray200, marginVertical: spacing.xs },
  subSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  methodName: { fontSize: 13, color: colors.gray700, width: 100 },
  methodBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: colors.gray200,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  methodBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  methodCount: { fontSize: 12, color: colors.gray700, width: 28, textAlign: 'right' },
  methodShare: { fontSize: 12, fontWeight: '600', color: colors.onSurface, width: 44, textAlign: 'right' },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dateField: { flex: 1 },
  dateFieldLabel: { fontSize: 11, color: colors.gray600, fontWeight: '600', marginBottom: 4 },
  dateInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  dateArrow: { marginTop: spacing.md },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  stateText: { fontSize: 14, color: colors.gray600, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: colors.black },
});
