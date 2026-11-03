import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { colors, spacing, radius, shadow } from '../lib/theme';
import { useOrderPayment } from '../features/order-payment/hooks/useOrderPayment';
import { orderPaymentStore } from '../features/order-payment/store/orderPaymentStore';
import {
  formatPickupNumber,
  isMethodAvailable,
  isOrderResumable,
  type CheckoutPaymentMethod,
  type OrderPaymentChannel,
  type OrderSummary,
  type PreparationStatus,
} from '../features/order-payment/types/orderPayment';
import { fetchMerchantStripeConnectStatus } from '../features/merchant-catalog/services/merchantCatalogService';
import type { PaymentChannel } from '../features/merchant-catalog/types/catalog';
import { observability } from '../lib/observability';
import type { RootStackNav, RootStackParamList } from '../types';
import { fetchOrderInvoice } from '../lib/api/shopperInvoice';

const METHODS: Array<{
  key: CheckoutPaymentMethod;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  labelKey: 'bank_account_direct' | 'credit_debit_card' | 'pay_by_bank' | 'tap_to_pay' | 'paypal';
}> = [
  { key: 'bank', icon: 'business-outline', labelKey: 'bank_account_direct' },
  { key: 'card', icon: 'card-outline', labelKey: 'credit_debit_card' },
  { key: 'pay_by_bank', icon: 'swap-horizontal-outline', labelKey: 'pay_by_bank' },
  { key: 'tap_to_pay', icon: 'phone-portrait-outline', labelKey: 'tap_to_pay' },
  { key: 'paypal', icon: 'logo-paypal', labelKey: 'paypal' },
];

const STATUS_COLORS = {
  PENDING_PAYMENT: colors.warning,
  PAYMENT_IN_PROGRESS: colors.primary,
  PAID: colors.success,
  PAYMENT_FAILED: colors.error,
  CANCELLED: colors.gray500,
} as const;

const PREPARATION_STATUS_COLORS: Record<PreparationStatus, string> = {
  RECEIVED: colors.gray700,
  PREPARING: colors.warning,
  READY: colors.success,
};

function formatAmount(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amountMinor / 100);
}

function mergePaymentChannels(...channelGroups: Array<readonly OrderPaymentChannel[] | undefined>): OrderPaymentChannel[] {
  return Array.from(new Set(channelGroups.flatMap((channels) => channels ?? []))) as OrderPaymentChannel[];
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<CheckoutPaymentMethod | null>(
    route.params.preferredMethod ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [activePaymentChannels, setActivePaymentChannels] = useState<PaymentChannel[]>([]);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [invoiceChecked, setInvoiceChecked] = useState(false);
  const isInvoiceOrder = order?.usesDeferredPayment === true && order?.targetShopperId != null;
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

  const reloadOrder = useCallback(async () => {
    try {
      setOrder(await refreshOrder(route.params.orderId));
    } catch (err: unknown) {
      observability.warn('order_detail_reload_failed', {
        orderId: route.params.orderId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [refreshOrder, route.params.orderId]);

  const onPullToRefresh = useCallback(() => {
    setRefreshing(true);
    void reloadOrder().finally(() => setRefreshing(false));
  }, [reloadOrder]);

  // The backend sends an ORDER_READY push when the kitchen marks the order ready for pickup.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.type === 'ORDER_READY' && data.orderId === route.params.orderId) {
        void reloadOrder();
      }
    });
    return () => sub.remove();
  }, [reloadOrder, route.params.orderId]);

  useEffect(() => {
    if (!order?.orderId) return;
    const orderId = order.orderId;
    setInvoiceChecked(false);
    void fetchOrderInvoice(orderId)
      .then((inv) => { setInvoiceUrl(inv?.url ?? null); })
      .catch(() => { setInvoiceUrl(null); })
      .finally(() => { setInvoiceChecked(true); });
  }, [order?.orderId]);

  useEffect(() => {
    let active = true;
    const merchantId = order?.merchantId;

    observability.info('order_detail_channels_effect', {
      merchantId: merchantId ?? null,
      orderStatus: order?.status ?? null,
    });

    if (!merchantId) {
      setActivePaymentChannels([]);
      return () => { active = false; };
    }

    void fetchMerchantStripeConnectStatus(merchantId)
      .then((status) => {
        if (!active) return;
        const channels: PaymentChannel[] = [
          ...(status?.charges_enabled === true ? ['STRIPE' as const] : []),
          ...(status?.pay_by_bank_enabled === true ? ['PAY_BY_BANK' as const] : []),
          ...(status?.tap_to_pay_enabled === true ? ['TAP_TO_PAY' as const] : []),
        ];
        observability.info('order_detail_channels_set', {
          merchantId,
          chargesEnabled: status?.charges_enabled ?? null,
          payByBankEnabled: status?.pay_by_bank_enabled ?? null,
          tapToPayEnabled: status?.tap_to_pay_enabled ?? null,
          channels: channels.join(',') || 'none',
        });
        setActivePaymentChannels(channels);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        observability.warn('order_detail_stripe_status_load_failed', {
          merchantId,
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        });
        setActivePaymentChannels([]);
      });

    return () => { active = false; };
  }, [order?.merchantId]);

  const canResume = Boolean(order && isOrderResumable(order.status));
  const showPreparation = Boolean(
    order && order.status !== 'CANCELLED' && (order.pickupNumber != null || order.preparationStatus),
  );
  const availableChannels = useMemo<OrderPaymentChannel[]>(
    () => mergePaymentChannels(
      route.params.availableChannels,
      session?.availableChannels,
      session?.selectedChannel ? [session.selectedChannel] : undefined,
      activePaymentChannels,
    ),
    [route.params.availableChannels, session?.availableChannels, session?.selectedChannel, activePaymentChannels],
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
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 120 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullToRefresh} />}
        >
          {showPreparation ? (
            <View style={[styles.pickupCard, shadow.sm]}>
              {order.pickupNumber != null ? (
                <>
                  <Text style={styles.pickupLabel}>{t('order_pickup_number_label')}</Text>
                  <Text style={styles.pickupNumber}>{formatPickupNumber(order.pickupNumber)}</Text>
                </>
              ) : null}
              {order.preparationStatus ? (
                <View
                  style={[
                    styles.statusBadge,
                    styles.preparationBadge,
                    { backgroundColor: `${PREPARATION_STATUS_COLORS[order.preparationStatus]}18` },
                  ]}
                >
                  <Text style={[styles.preparationText, { color: PREPARATION_STATUS_COLORS[order.preparationStatus] }]}>
                    {t(`preparation_status_${order.preparationStatus}`)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
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

          {isInvoiceOrder ? (
            !invoiceChecked ? (
              <View style={styles.invoiceButton}>
                <ActivityIndicator size="small" color={colors.gray400} />
                <Text style={[styles.invoiceButtonText, { color: colors.gray400 }]}>{t('invoice_checking')}</Text>
              </View>
            ) : invoiceUrl ? (
              <TouchableOpacity
                style={styles.invoiceButton}
                onPress={() => navigation.navigate('InvoicePdf', { url: invoiceUrl, title: t('invoice_view') })}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.onSurface} />
                <Text style={styles.invoiceButtonText}>{t('invoice_view')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.invoiceButton, { opacity: 0.6 }]}>
                <Ionicons name="time-outline" size={18} color={colors.gray500} />
                <Text style={[styles.invoiceButtonText, { color: colors.gray500 }]}>{t('invoice_pending')}</Text>
              </View>
            )
          ) : null}

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
  pickupCard: {
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
  },
  pickupLabel: { fontSize: 12, fontWeight: '600', color: colors.gray600, textTransform: 'uppercase' },
  pickupNumber: { marginTop: spacing.xs, fontSize: 48, fontWeight: '800', color: colors.onSurface },
  preparationBadge: { alignSelf: 'center', marginTop: spacing.sm, paddingHorizontal: 14, paddingVertical: 6 },
  preparationText: { fontSize: 13, fontWeight: '700' },
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
  invoiceButton: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  invoiceButtonText: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
});
