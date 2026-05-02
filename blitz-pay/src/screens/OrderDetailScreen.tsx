import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { colors, spacing, radius, shadow } from '../lib/theme';
import { fetchOrder } from '../features/order-payment/services/orderPaymentService';
import { useOrderPayment } from '../features/order-payment/hooks/useOrderPayment';
import {
  isOrderResumable,
  type CheckoutPaymentMethod,
  type OrderPaymentChannel,
  type OrderSummary,
} from '../features/order-payment/types/orderPayment';
import type { RootStackNav, RootStackParamList } from '../types';

const METHODS: Array<{ key: CheckoutPaymentMethod; icon: React.ComponentProps<typeof Ionicons>['name']; labelKey: 'bank_account_direct' | 'credit_debit_card' | 'paypal' }> = [
  { key: 'bank', icon: 'business-outline', labelKey: 'bank_account_direct' },
  { key: 'card', icon: 'card-outline', labelKey: 'credit_debit_card' },
  { key: 'paypal', icon: 'logo-paypal', labelKey: 'paypal' },
];

const STATUS_COLORS = {
  PENDING_PAYMENT: colors.warning,
  PAYMENT_IN_PROGRESS: colors.primary,
  PAID: colors.success,
  PAYMENT_FAILED: colors.error,
  CANCELLED: colors.gray500,
} as const;

function formatAmount(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amountMinor / 100);
}

export default function OrderDetailScreen() {
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'OrderDetail'>>();
  const insets = useSafeAreaInsets();
  const { resumeOrderPayment } = useOrderPayment();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<CheckoutPaymentMethod | null>(
    route.params.preferredMethod ?? null,
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void fetchOrder(route.params.orderId)
      .then((nextOrder) => {
        if (!active) return;
        setOrder(nextOrder);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'unknown_error');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [route.params.orderId]);

  const canResume = Boolean(order && isOrderResumable(order.status));
  const availableChannels = useMemo<OrderPaymentChannel[]>(
    () => route.params.availableChannels ?? ['TRUELAYER', 'STRIPE', 'PAYPAL'],
    [route.params.availableChannels],
  );

  const onResume = async () => {
    if (!order || !selectedMethod) return;
    setSubmitting(true);
    setError(null);
    try {
      await resumeOrderPayment({
        order,
        merchantName: route.params.merchantName ?? t('merchant_mode'),
        branchName: route.params.branchName,
        merchantLogoUrl: route.params.merchantLogoUrl,
        selectedMethod,
        availableChannels,
        navigation,
        token,
        user,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('order_detail_title')}</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>{t('order_detail_loading')}</Text>
        </View>
      ) : !order ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={42} color={colors.error} />
          <Text style={styles.centerTitle}>{t('order_detail_error_title')}</Text>
          <Text style={styles.centerText}>{t('order_detail_error_body')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 120 + insets.bottom }}>
          <View style={[styles.summaryCard, shadow.sm]}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryText}>
                <Text style={styles.summaryTitle}>{t('order_reference_label', { orderId: order.orderId })}</Text>
                <Text style={styles.summaryMeta}>{route.params.merchantName ?? t('merchant_mode')}</Text>
                {route.params.branchName ? <Text style={styles.summaryMeta}>{route.params.branchName}</Text> : null}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[order.status]}18` }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[order.status] }]}>
                  {t(`order_status_${order.status}` as never)}
                </Text>
              </View>
            </View>
            <Text style={styles.amountText}>{formatAmount(order.totalAmountMinor, order.currency)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('order_items_title')}</Text>
            {order.items.map((item) => (
              <View key={`${order.orderId}-${item.productId}`} style={styles.itemRow}>
                <View style={styles.itemText}>
                  <Text style={styles.itemName}>{item.quantity}× {item.name}</Text>
                  <Text style={styles.itemMeta}>{formatAmount(item.unitPriceMinor, order.currency)}</Text>
                </View>
                <Text style={styles.itemTotal}>{formatAmount(item.lineTotalMinor, order.currency)}</Text>
              </View>
            ))}
          </View>

          {canResume ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('resume_payment')}</Text>
              <Text style={styles.sectionSubtitle}>{t('order_resume_select_method')}</Text>
              {METHODS.map((method) => (
                <TouchableOpacity
                  key={method.key}
                  style={[styles.methodCard, selectedMethod === method.key && styles.methodCardSelected]}
                  onPress={() => setSelectedMethod(method.key)}
                >
                  <Ionicons name={method.icon} size={18} color={colors.onSurface} />
                  <Text style={styles.methodLabel}>{t(method.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('order_resume_unavailable_title')}</Text>
              <Text style={styles.sectionSubtitle}>{t('order_resume_unavailable_body')}</Text>
            </View>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{t(error as never)}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {canResume ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            style={[styles.resumeButton, (!selectedMethod || submitting) && styles.resumeButtonDisabled]}
            disabled={!selectedMethod || submitting}
            onPress={() => void onResume()}
          >
            <Text style={styles.resumeButtonText}>
              {submitting ? t('processing_payment') : t('resume_payment')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  centerTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  centerText: { fontSize: 14, color: colors.gray600, textAlign: 'center' },
  summaryCard: { marginTop: spacing.md, backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.md },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  summaryText: { flex: 1 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  summaryMeta: { marginTop: 4, fontSize: 12, color: colors.gray600 },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '700' },
  amountText: { marginTop: spacing.md, fontSize: 24, fontWeight: '800', color: colors.onSurface },
  section: { marginTop: spacing.md, backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  sectionSubtitle: { marginTop: 6, fontSize: 13, color: colors.gray600 },
  itemRow: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  itemText: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  itemMeta: { marginTop: 4, fontSize: 12, color: colors.gray600 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  methodCard: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  methodCardSelected: { borderColor: colors.primary, backgroundColor: `${colors.primary}12` },
  methodLabel: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  errorBox: {
    marginTop: spacing.md,
    backgroundColor: `${colors.error}12`,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  errorText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  resumeButton: { backgroundColor: colors.primary, borderRadius: radius.full, padding: spacing.md, alignItems: 'center' },
  resumeButtonDisabled: { opacity: 0.5 },
  resumeButtonText: { color: colors.black, fontSize: 15, fontWeight: '700' },
});
