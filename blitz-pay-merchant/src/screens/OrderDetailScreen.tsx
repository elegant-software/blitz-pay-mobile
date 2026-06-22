import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackParamList } from '../types';
import { getMerchantOrderStatusIcon, getMerchantOrderStatusLabelKey } from '../features/orders/orderPresentation';
import { useMerchantOrderDetail } from '../features/orders/hooks/useMerchantOrderDetail';
import { useMerchantProducts } from '../features/products/hooks/useMerchantProducts';
import { useStripeTerminalPayment } from '../hooks/useStripeTerminalPayment';
import { fetchMerchantOrderInvoice } from '../features/orders/services/orderService';

type RouteProps = RouteProp<RootStackParamList, 'OrderDetail'>;

const STATUS_COLORS = {
  awaiting_payment: colors.warning,
  payment_in_progress: colors.primary,
  payment_failed: colors.error,
  paid: colors.success,
  cancelled: colors.error,
} as const;

function formatCurrency(amountMinor: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amountMinor / 100);
}

export default function OrderDetailScreen() {
  const { t } = useLanguage();
  const { activeBranchScope, branchScopeError } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const {
    order,
    loading,
    error,
    mutationError,
    mutating,
    addItem,
    updateLineQuantity,
    removeLine,
    cancelOrder,
    markManuallyPaid,
    reconcileTerminalPayment,
  } = useMerchantOrderDetail(route.params.orderId, activeBranchScope);
  const { products, loading: productsLoading } = useMerchantProducts(activeBranchScope, branchScopeError);
  const { status: terminalStatus, errorMessage: terminalError, collectPayment, reset: resetTerminal } = useStripeTerminalPayment();
  const [terminalReconciling, setTerminalReconciling] = React.useState(false);
  const [addItemVisible, setAddItemVisible] = React.useState(false);
  const [invoiceUrl, setInvoiceUrl] = React.useState<string | null>(null);
  const [invoiceChecked, setInvoiceChecked] = React.useState(false);
  const isInvoiceOrder = order?.checkoutIntent === 'PAY_LATER';
  const terminalBusy = terminalReconciling || (terminalStatus !== 'idle' && terminalStatus !== 'succeeded' && terminalStatus !== 'failed');
  const existingProductIds = new Set(order?.items.map((item) => item.productId) ?? []);
  const availableProducts = products.filter((product) => product.active && !existingProductIds.has(product.id));

  React.useEffect(() => {
    if (!order?.orderId || !activeBranchScope) {
      setInvoiceUrl(null);
      setInvoiceChecked(false);
      return;
    }
    let active = true;
    setInvoiceChecked(false);
    void fetchMerchantOrderInvoice(order.orderId, activeBranchScope)
      .then((invoice) => {
        if (!active) return;
        setInvoiceUrl(invoice?.url ?? null);
      })
      .catch(() => {
        if (!active) return;
        setInvoiceUrl(null);
      })
      .finally(() => {
        if (!active) return;
        setInvoiceChecked(true);
      });
    return () => {
      active = false;
    };
  }, [activeBranchScope, order?.orderId, order?.status]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('order_detail')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>{t('merchant_order_detail_loading')}</Text>
        </View>
      ) : !order || error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
          <Text style={styles.centerTitle}>{t('merchant_order_detail_error_title')}</Text>
          <Text style={styles.centerText}>{t((error ?? 'merchant_order_detail_error_body') as Parameters<typeof t>[0])}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 96 + insets.bottom }} showsVerticalScrollIndicator={false}>
          <View style={[styles.summaryCard, shadow.md]}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryIdentity}>
                <Text style={styles.orderNum}>{t('order_number')}{order.orderId}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[order.status]}15` }]}>
                <Ionicons
                  name={getMerchantOrderStatusIcon(order.status) as React.ComponentProps<typeof Ionicons>['name']}
                  size={14}
                  color={STATUS_COLORS[order.status]}
                />
                <Text style={[styles.statusText, { color: STATUS_COLORS[order.status] }]}>
                  {t(getMerchantOrderStatusLabelKey(order.status))}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('order_total')}</Text>
              <Text style={[styles.detailValue, styles.amountText]}>
                {formatCurrency(order.amountMinor, order.currency)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('merchant_checkout_intent_label')}</Text>
              <Text style={styles.detailValue}>
                {order.checkoutIntent === 'PAY_LATER'
                  ? t('merchant_order_queue_checkout_pay_later')
                  : t('merchant_order_queue_checkout_pay_now')}
              </Text>
            </View>
            {order.paymentSource ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('merchant_payment_source_label')}</Text>
                <Text style={styles.detailValue}>
                  {t(`merchant_payment_source_${order.paymentSource}` as Parameters<typeof t>[0])}
                </Text>
              </View>
            ) : null}
            {order.banner ? (
              <View style={styles.banner}>
                <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                <Text style={styles.bannerText}>{t(order.banner.messageKey)}</Text>
              </View>
            ) : null}
            {mutationError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={styles.errorBannerText}>{t(mutationError as Parameters<typeof t>[0])}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('order_items')}</Text>
            <View style={[styles.itemsCard, shadow.sm]}>
              {order.items.length === 0 ? (
                <Text style={styles.emptyItemsText}>{t('merchant_order_items_empty')}</Text>
              ) : (
                order.items.map((item) => (
                  <View key={item.lineId} style={styles.itemRow}>
                    <View style={styles.itemMain}>
                      <View style={styles.itemText}>
                        <Text style={styles.itemName}>{item.quantity}× {item.name}</Text>
                        <Text style={styles.itemMeta}>
                          {formatCurrency(item.unitPriceMinor, order.currency)}
                          {item.priceSource === 'MERCHANT_OVERRIDE'
                            ? ` · ${t('merchant_order_line_price_override')}`
                            : ''}
                        </Text>
                      </View>
                      <Text style={styles.itemTotal}>{formatCurrency(item.lineTotalMinor, order.currency)}</Text>
                    </View>
                    {order.status === 'awaiting_payment' || order.status === 'payment_failed' ? (
                      <View style={styles.itemActions}>
                        <TouchableOpacity
                          accessibilityLabel={t('merchant_order_decrease_quantity')}
                          style={styles.quantityButton}
                          disabled={mutating}
                          onPress={() => {
                            if (item.quantity <= 1) {
                              void removeLine(item.lineId);
                            } else {
                              void updateLineQuantity(item.lineId, item.quantity - 1);
                            }
                          }}
                        >
                          <Ionicons name="remove" size={18} color={colors.onSurface} />
                        </TouchableOpacity>
                        <Text style={styles.quantityValue}>{item.quantity}</Text>
                        <TouchableOpacity
                          accessibilityLabel={t('merchant_order_edit_quantity')}
                          style={styles.quantityButton}
                          disabled={mutating}
                          onPress={() => void updateLineQuantity(item.lineId, item.quantity + 1)}
                        >
                          <Ionicons name="add" size={18} color={colors.onSurface} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityLabel={t('merchant_order_remove_item')}
                          style={styles.removeItemButton}
                          disabled={mutating}
                          onPress={() => void removeLine(item.lineId)}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
              {order.status === 'awaiting_payment' || order.status === 'payment_failed' ? (
                <TouchableOpacity
                  style={styles.addItemButton}
                  disabled={mutating}
                  onPress={() => setAddItemVisible(true)}
                >
                  <Ionicons name="add-circle-outline" size={19} color={colors.primary} />
                  <Text style={styles.addItemButtonText}>{t('merchant_order_add_item')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {isInvoiceOrder ? (
            !invoiceChecked ? (
              <View style={styles.invoiceButton}>
                <ActivityIndicator size="small" color={colors.gray400} />
                <Text style={[styles.invoiceButtonText, { color: colors.gray400 }]}>{t('merchant_invoice_checking')}</Text>
              </View>
            ) : invoiceUrl ? (
              <TouchableOpacity
                style={styles.invoiceButton}
                onPress={() => navigation.navigate('InvoicePdf', { url: invoiceUrl, title: t('merchant_invoice_view') })}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.onSurface} />
                <Text style={styles.invoiceButtonText}>{t('merchant_invoice_view')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.invoiceButton, { opacity: 0.6 }]}>
                <Ionicons name="time-outline" size={18} color={colors.gray500} />
                <Text style={[styles.invoiceButtonText, { color: colors.gray500 }]}>{t('merchant_invoice_pending')}</Text>
              </View>
            )
          ) : null}

          {(order.status === 'awaiting_payment' || order.status === 'payment_failed' || order.status === 'payment_in_progress') ? (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.terminalAction, terminalBusy && styles.actionDisabled]}
                disabled={mutating || terminalBusy}
                onPress={async () => {
                  if (!activeBranchScope?.merchantId || !activeBranchScope?.branchId) return;
                  resetTerminal();
                  const result = await collectPayment({
                    orderId: order.orderId,
                    merchantId: activeBranchScope.merchantId,
                    branchId: activeBranchScope.branchId,
                    simulated: __DEV__,
                  });
                  if (result.succeeded) {
                    setTerminalReconciling(true);
                    try {
                      await reconcileTerminalPayment();
                    } finally {
                      setTerminalReconciling(false);
                    }
                  } else {
                    // Poll for the webhook revert after cancellation. The backend handles
                    // payment_intent.canceled and reverts the order to awaiting_payment;
                    // reconcileTerminalPayment exits as soon as it sees that status.
                    setTerminalReconciling(true);
                    try {
                      await reconcileTerminalPayment();
                    } finally {
                      setTerminalReconciling(false);
                    }
                  }
                }}
              >
                {terminalBusy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="phone-portrait-outline" size={16} color={colors.primary} />
                )}
                <Text style={styles.terminalActionText}>
                  {terminalReconciling ? t('merchant_terminal_payment_succeeded') : terminalBusy ? terminalStatus : t('merchant_collect_via_terminal')}
                </Text>
              </TouchableOpacity>
              {terminalError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                  <Text style={styles.errorBannerText}>{terminalError}</Text>
                </View>
              ) : null}
              {terminalStatus === 'succeeded' ? (
                <View style={styles.banner}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                  <Text style={styles.bannerText}>{t('merchant_terminal_payment_succeeded')}</Text>
                </View>
              ) : null}
              <TouchableOpacity style={styles.secondaryAction} disabled={mutating} onPress={() => void cancelOrder()}>
                <Text style={styles.secondaryActionText}>{t('cancel_order')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryAction} disabled={mutating} onPress={() => void markManuallyPaid()}>
                <Text style={styles.primaryActionText}>{t('merchant_mark_manual_paid')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}
      <Modal
        visible={addItemVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddItemVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAddItemVisible(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('merchant_order_add_item_title')}</Text>
            {productsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.modalLoading} />
            ) : (
              <FlatList
                data={availableProducts}
                keyExtractor={(product) => product.id}
                renderItem={({ item: product }) => (
                  <TouchableOpacity
                    style={styles.productOption}
                    disabled={mutating}
                    onPress={async () => {
                      await addItem(product.id, 1);
                      setAddItemVisible(false);
                    }}
                  >
                    <View style={styles.productOptionText}>
                      <Text style={styles.productOptionName}>{product.name}</Text>
                      <Text style={styles.productOptionPrice}>
                        {formatCurrency(Math.round(product.unitPrice * 100), order?.currency)}
                      </Text>
                    </View>
                    <Ionicons name="add" size={20} color={colors.primary} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.modalEmpty}>{t('merchant_order_add_item_empty')}</Text>
                }
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  centerTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  centerText: { fontSize: 14, color: colors.gray600, textAlign: 'center' },
  summaryCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    margin: spacing.md, padding: spacing.lg,
  },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  summaryIdentity: { flex: 1, minWidth: 0 },
  orderNum: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  statusPill: {
    maxWidth: '46%',
    minHeight: 30,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusText: { flexShrink: 1, fontSize: 12, lineHeight: 15, fontWeight: '700', textAlign: 'center' },
  divider: { height: 1, backgroundColor: colors.gray200, marginVertical: spacing.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  detailLabel: { fontSize: 14, color: colors.gray600 },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  amountText: { fontSize: 18, fontWeight: '800' },
  banner: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.sm,
    backgroundColor: `${colors.primary}10`,
  },
  bannerText: { flex: 1, fontSize: 13, color: colors.onSurface },
  errorBanner: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.sm,
    backgroundColor: `${colors.error}10`,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: colors.onSurface },
  section: { paddingHorizontal: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.sm },
  itemsCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.lg,
  },
  itemRow: { gap: spacing.sm, marginBottom: spacing.md },
  itemMain: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  itemText: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  itemMeta: { marginTop: 4, fontSize: 12, color: colors.gray600 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  quantityButton: {
    width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.gray100, borderWidth: 1, borderColor: colors.gray200,
  },
  quantityValue: { minWidth: 24, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.onSurface },
  removeItemButton: { width: 34, height: 34, marginLeft: 'auto', alignItems: 'center', justifyContent: 'center' },
  emptyItemsText: { fontSize: 13, color: colors.gray500 },
  addItemButton: {
    marginTop: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  addItemButtonText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  invoiceButton: {
    marginHorizontal: spacing.md,
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
  modalOverlay: { flex: 1, backgroundColor: colors.overlayDark, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.white, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingTop: spacing.sm, paddingBottom: spacing.xl, maxHeight: '65%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.gray300,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 17, fontWeight: '700', color: colors.onSurface,
    paddingHorizontal: spacing.lg, marginBottom: spacing.sm,
  },
  modalLoading: { margin: spacing.xl },
  productOption: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  productOptionText: { flex: 1 },
  productOptionName: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  productOptionPrice: { marginTop: 3, fontSize: 13, color: colors.gray600 },
  modalEmpty: { padding: spacing.xl, textAlign: 'center', fontSize: 14, color: colors.gray500 },
  actions: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  terminalAction: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: `${colors.primary}15`,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  terminalActionText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  actionDisabled: { opacity: 0.6 },
  secondaryAction: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  secondaryActionText: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  primaryAction: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  primaryActionText: { fontSize: 14, fontWeight: '700', color: colors.black },
});
