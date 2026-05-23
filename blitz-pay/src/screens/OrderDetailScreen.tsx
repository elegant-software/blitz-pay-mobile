import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { colors, spacing, radius, shadow } from '../lib/theme';
import { useOrderPayment } from '../features/order-payment/hooks/useOrderPayment';
import { orderPaymentStore } from '../features/order-payment/store/orderPaymentStore';
import {
  isMethodAvailable,
  isOrderResumable,
  type CheckoutPaymentMethod,
  type OrderPaymentChannel,
  type OrderSummary,
} from '../features/order-payment/types/orderPayment';
import type { RootStackNav, RootStackParamList } from '../types';

const METHODS: Array<{ key: CheckoutPaymentMethod; icon: React.ComponentProps<typeof Ionicons>['name']; labelKey: 'bank_account_direct' | 'credit_debit_card' | 'pay_by_bank' | 'paypal' }> = [
  { key: 'bank', icon: 'business-outline', labelKey: 'bank_account_direct' },
  { key: 'card', icon: 'card-outline', labelKey: 'credit_debit_card' },
  { key: 'pay_by_bank', icon: 'swap-horizontal-outline', labelKey: 'pay_by_bank' },
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

function formatMerchantLabel(merchantName?: string, branchName?: string): string | null {
  return merchantName ?? branchName ?? null;
}

export default function OrderDetailScreen() {
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'OrderDetail'>>();
  const insets = useSafeAreaInsets();
  const { resumeOrderPayment, refreshOrder, cancelOrder } = useOrderPayment();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<CheckoutPaymentMethod | null>(
    route.params.preferredMethod ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const session = orderPaymentStore.getSession(route.params.orderId);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void refreshOrder(route.params.orderId)
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
  }, [refreshOrder, route.params.orderId]);

  const canResume = Boolean(order && isOrderResumable(order.status));
  const availableChannels = useMemo<OrderPaymentChannel[]>(
    () => route.params.availableChannels ?? session?.availableChannels ?? (session?.selectedChannel ? [session.selectedChannel] : []),
    [route.params.availableChannels, session?.availableChannels, session?.selectedChannel],
  );
  const availableMethods = useMemo(
    () => METHODS.filter((method) => isMethodAvailable(method.key, availableChannels)),
    [availableChannels],
  );
  const effectiveSelectedMethod = selectedMethod ?? (availableMethods.length === 1 ? availableMethods[0].key : null);
  const merchantLabel = formatMerchantLabel(order?.merchantName ?? route.params.merchantName, order?.branchName ?? route.params.branchName);
  const branchLabel = (order?.merchantName ?? route.params.merchantName)
    ? (order?.branchName ?? route.params.branchName)
    : null;

  useEffect(() => {
    if (availableMethods.length === 1 && selectedMethod !== availableMethods[0].key) {
      setSelectedMethod(availableMethods[0].key);
      return;
    }
    if (selectedMethod && !isMethodAvailable(selectedMethod, availableChannels)) {
      setSelectedMethod(null);
    }
  }, [availableChannels, availableMethods, selectedMethod]);

  const onResume = async () => {
    if (!order || !effectiveSelectedMethod) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await resumeOrderPayment({
        order,
        merchantName: formatMerchantLabel(route.params.merchantName, route.params.branchName) ?? 'Merchant',
        branchName: route.params.branchName,
        merchantLogoUrl: route.params.merchantLogoUrl,
        selectedMethod: effectiveSelectedMethod,
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

  const onCancelOrder = () => {
    if (!order) return;
    Alert.alert(
      t('order_cancel_confirm_title'),
      t('order_cancel_confirm_body'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('order_cancel_confirm_action'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSubmitting(true);
              setError(null);
              setNotice(null);
              try {
                const nextOrder = await cancelOrder(order.orderId);
                setOrder(nextOrder);
                setNotice(t('order_cancelled_notice'));
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'unknown_error');
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              } finally {
                setSubmitting(false);
              }
            })();
          },
        },
      ],
    );
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
                {merchantLabel ? (
                  <Text style={styles.summaryMeta}>{merchantLabel}</Text>
                ) : null}
                {branchLabel ? (
                  <Text style={styles.summaryMeta}>{branchLabel}</Text>
                ) : null}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[order.status]}18` }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[order.status] }]}>
                  {t(`order_status_${order.status}` as never)}
                </Text>
              </View>
            </View>
            <Text style={styles.amountText}>{formatAmount(order.totalAmountMinor, order.currency)}</Text>
            <Text style={styles.summaryMeta}>{`${t('order_checkout_intent_label')}: ${order.checkoutIntent}`}</Text>
            {order.paymentSource ? (
              <Text style={styles.summaryMeta}>
                {`${t('order_payment_source_label')}: ${t(`payment_source_${order.paymentSource}` as never)}`}
              </Text>
            ) : null}
            {order.banner ? (
              <View style={styles.banner}>
                <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                <View style={styles.bannerTextWrap}>
                  <Text style={styles.bannerTitle}>{t('order_updated_banner_title')}</Text>
                  <Text style={styles.bannerText}>{t(order.banner.messageKey as never)}</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('order_items_title')}</Text>
            {order.items.map((item) => (
              <View key={item.lineId} style={styles.itemRow}>
                <View style={styles.itemText}>
                  <Text style={styles.itemName}>{item.quantity}× {item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {formatAmount(item.unitPriceMinor, order.currency)}
                    {item.priceSource === 'MERCHANT_OVERRIDE' ? ` · ${t('order_line_price_override')}` : ''}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>{formatAmount(item.lineTotalMinor, order.currency)}</Text>
              </View>
            ))}
          </View>

          {canResume ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('resume_payment')}</Text>
              <Text style={styles.sectionSubtitle}>{t('order_resume_select_method')}</Text>
              {availableMethods.length === 0 ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{t('payment_option_unavailable')}</Text>
                </View>
              ) : null}
              {availableMethods.map((method) => (
                <TouchableOpacity
                  key={method.key}
                  style={[styles.methodCard, effectiveSelectedMethod === method.key && styles.methodCardSelected]}
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

          {notice ? (
            <View style={styles.noticeBox}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {order.status === 'PENDING_PAYMENT' ? (
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.cancelButton, submitting && styles.cancelButtonDisabled]}
                disabled={submitting}
                onPress={onCancelOrder}
              >
                <Text style={styles.cancelButtonText}>{t('order_cancel')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}

      {canResume ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            style={[styles.resumeButton, (!effectiveSelectedMethod || submitting) && styles.resumeButtonDisabled]}
            disabled={!effectiveSelectedMethod || submitting}
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
  banner: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.sm,
    backgroundColor: `${colors.primary}10`,
  },
  bannerTextWrap: { flex: 1 },
  bannerTitle: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  bannerText: { marginTop: 2, fontSize: 12, color: colors.gray600 },
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
  noticeBox: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: `${colors.success}12`,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  noticeText: { flex: 1, color: colors.success, fontSize: 13, fontWeight: '600' },
  cancelButton: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  cancelButtonDisabled: { opacity: 0.6 },
  cancelButtonText: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
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
