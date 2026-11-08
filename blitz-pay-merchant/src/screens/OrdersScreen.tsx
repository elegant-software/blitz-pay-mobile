import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import type { TranslationKeys } from '../lib/translations';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav } from '../types';
import { useMerchantOrders } from '../features/orders/hooks/useMerchantOrders';
import {
  getMerchantOrderSection,
  getMerchantOrderSectionTitleKey,
  getMerchantOrderStatusIcon,
  getMerchantOrderStatusLabelKey,
  formatPickupNumber,
  MERCHANT_ORDER_PREVIEW_COUNT,
  MERCHANT_ORDER_SECTION_ORDER,
  type MerchantOrderSectionKey,
} from '../features/orders/orderPresentation';
import type { MerchantOrderStatus, MerchantOrderSummary } from '../features/orders/types/order';
import { PreparationStatusBadge } from '../features/orders/components/PreparationStatusBadge';

const STATUS_COLORS: Record<MerchantOrderStatus, string> = {
  awaiting_payment: colors.warning,
  payment_in_progress: colors.primary,
  payment_failed: colors.error,
  paid: colors.success,
  cancelled: colors.error,
};

function formatCurrency(amountMinor: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amountMinor / 100);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatItemCount(template: string, count: number) {
  return template.replace('{{count}}', String(count));
}

function getCheckoutIntentLabel(
  t: (key: TranslationKeys) => string,
  checkoutIntent: MerchantOrderSummary['checkoutIntent'],
) {
  return checkoutIntent === 'PAY_LATER'
    ? t('merchant_order_queue_checkout_pay_later')
    : t('merchant_order_queue_checkout_pay_now');
}

function getPaymentMethodMeta(
  t: (key: TranslationKeys) => string,
  order: MerchantOrderSummary,
): { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; color: string } {
  if (order.paymentSource === 'MANUAL_SETTLEMENT' || order.checkoutPaymentMethod === 'CASH') {
    return { icon: 'cash', label: t('merchant_payment_method_CASH'), color: colors.success };
  }
  if (order.checkoutPaymentMethod === 'TERMINAL') {
    return { icon: 'phone-portrait', label: t('merchant_payment_method_TERMINAL'), color: colors.primary };
  }
  if (order.checkoutPaymentMethod === 'CARD' || order.checkoutPaymentMethod === 'PAYPAL') {
    return { icon: 'card', label: t('merchant_payment_method_CARD'), color: colors.secondary };
  }
  if (order.checkoutPaymentMethod === 'BANK_ACCOUNT' || order.checkoutPaymentMethod === 'PAY_BY_BANK') {
    return { icon: 'wallet', label: t('merchant_payment_method_BANK_ACCOUNT'), color: colors.warning };
  }
  if (order.paymentProvider === 'STRIPE_TERMINAL' || order.paymentProvider === 'TERMINAL') {
    return { icon: 'phone-portrait', label: t('merchant_payment_method_TERMINAL'), color: colors.primary };
  }
  if (order.paymentProvider === 'STRIPE' || order.paymentProvider === 'BRAINTREE') {
    return { icon: 'card', label: t('merchant_payment_method_CARD'), color: colors.secondary };
  }
  if (order.paymentProvider === 'TRUELAYER' || order.paymentProvider === 'STRIPE_PAY_BY_BANK') {
    return { icon: 'wallet', label: t('merchant_payment_method_BANK_ACCOUNT'), color: colors.warning };
  }
  if (order.paymentProvider === 'QRPAY') {
    return { icon: 'wallet', label: t('merchant_payment_method_BANK_ACCOUNT'), color: colors.warning };
  }
  return {
    icon: order.checkoutIntent === 'PAY_LATER' ? 'calendar-outline' : 'flash-outline',
    label: getCheckoutIntentLabel(t, order.checkoutIntent),
    color: colors.gray500,
  };
}

function getVisibleOrders(orders: MerchantOrderSummary[], expanded: boolean, previewCount?: number) {
  if (!previewCount || expanded) return orders;
  return orders.slice(0, previewCount);
}

export default function OrdersScreen() {
  const { t } = useLanguage();
  const { activeBranchScope, branchScopeError, retryBranchScope } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<Partial<Record<MerchantOrderSectionKey, boolean>>>({});
  const [sectionOffsets, setSectionOffsets] = useState<Partial<Record<MerchantOrderSectionKey, number>>>({});
  const { orders, loading, error, reload } = useMerchantOrders(activeBranchScope?.branchId ?? null);

  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return order.orderId.toLowerCase().includes(q);
      }),
    [orders, search],
  );

  const sectionedOrders = useMemo(() => {
    const groups: Record<MerchantOrderSectionKey, MerchantOrderSummary[]> = {
      payment_failed: [],
      awaiting_payment: [],
      payment_in_progress: [],
      paid: [],
      cancelled: [],
    };

    for (const order of filtered) {
      groups[getMerchantOrderSection(order.status)].push(order);
    }

    return groups;
  }, [filtered]);

  const metrics = useMemo(
    () => [
      { section: 'payment_failed' as const, count: sectionedOrders.payment_failed.length },
      { section: 'awaiting_payment' as const, count: sectionedOrders.awaiting_payment.length },
      { section: 'payment_in_progress' as const, count: sectionedOrders.payment_in_progress.length },
    ].filter((entry) => entry.count > 0),
    [sectionedOrders],
  );

  const visibleSections = MERCHANT_ORDER_SECTION_ORDER.filter((section) => sectionedOrders[section].length > 0);

  const toggleSection = (section: MerchantOrderSectionKey) => {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const jumpToSection = (section: MerchantOrderSectionKey) => {
    const offset = sectionOffsets[section];
    if (offset != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, offset - spacing.lg), animated: true });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior="padding"
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('orders_today_title')}</Text>
        <Text style={styles.subtitle}>
          {activeBranchScope?.branchName ?? t('orders_today_subtitle')}
        </Text>
        {metrics.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
            {metrics.map((metric) => (
              <TouchableOpacity
                key={metric.section}
                style={styles.metricCard}
                onPress={() => jumpToSection(metric.section)}
                activeOpacity={0.8}
              >
                <Text style={styles.metricCount}>{metric.count}</Text>
                <Text style={styles.metricLabel}>{t(getMerchantOrderSectionTitleKey(metric.section))}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.gray500} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('merchant_orders_search_placeholder')}
            placeholderTextColor={colors.gray400}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.gray400} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.fab, { bottom: 90 + insets.bottom }]}
        onPress={() => navigation.navigate('CreateOrder')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color={colors.black} />
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 90 + insets.bottom, paddingTop: spacing.sm }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.emptyText}>{t('merchant_orders_loading')}</Text>
          </View>
        ) : branchScopeError || error ? (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
            <Text style={styles.emptyTitle}>{t('merchant_orders_error_title')}</Text>
            <Text style={styles.emptyText}>{t((branchScopeError ?? error ?? 'merchant_orders_error_body') as Parameters<typeof t>[0])}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void (branchScopeError ? retryBranchScope() : reload())}
            >
              <Text style={styles.retryBtnText}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color={colors.gray300} />
            <Text style={styles.emptyTitle}>{t('merchant_orders_empty_title')}</Text>
            <Text style={styles.emptyText}>{t('merchant_orders_empty_body')}</Text>
          </View>
        ) : visibleSections.map((section) => {
          const previewCount = MERCHANT_ORDER_PREVIEW_COUNT[section];
          const expanded = !!expandedSections[section];
          const sectionOrders = sectionedOrders[section];
          const visibleOrders = getVisibleOrders(sectionOrders, expanded, previewCount);
          const isPreviewed = !!previewCount && sectionOrders.length > previewCount;

          return (
            <View
              key={section}
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                setSectionOffsets((current) => (current[section] === y ? current : { ...current, [section]: y }));
              }}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t(getMerchantOrderSectionTitleKey(section))}</Text>
                <View style={styles.sectionHeaderRight}>
                  <Text style={styles.sectionCount}>{sectionOrders.length}</Text>
                  {isPreviewed ? (
                    <TouchableOpacity onPress={() => toggleSection(section)} style={styles.sectionToggle}>
                      <Text style={styles.sectionToggleText}>
                        {expanded ? t('merchant_order_queue_show_less') : t('merchant_order_queue_show_more')}
                      </Text>
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.gray600}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {visibleOrders.map((order) => (
                (() => {
                  const paymentMethod = getPaymentMethodMeta(t, order);
                  return (
                <TouchableOpacity
                  key={order.orderId}
                  style={[
                    styles.orderCard,
                    shadow.sm,
                    (section === 'paid' || section === 'cancelled') && styles.orderCardMuted,
                  ]}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: order.orderId })}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.orderIconWrap,
                      { backgroundColor: `${STATUS_COLORS[order.status]}15` },
                    ]}
                  >
                    <Ionicons
                      name={getMerchantOrderStatusIcon(order.status) as React.ComponentProps<typeof Ionicons>['name']}
                      size={22}
                      color={STATUS_COLORS[order.status]}
                    />
                  </View>

                  <View style={styles.orderBody}>
                    <View style={styles.orderTop}>
                      <View style={styles.orderHeading}>
                        {order.pickupNumber != null ? (
                          <Text style={styles.pickupNumber}>{formatPickupNumber(order.pickupNumber)}</Text>
                        ) : null}
                        <Text style={styles.orderNum}>{t('order_number')}{order.orderId}</Text>
                        <Text style={[styles.statusText, { color: STATUS_COLORS[order.status] }]}>
                          {t(getMerchantOrderStatusLabelKey(order.status))}
                        </Text>
                        {order.preparationStatus ? (
                          <View style={styles.preparationBadgeWrap}>
                            <PreparationStatusBadge status={order.preparationStatus} />
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.orderAmountStack}>
                        <Text style={styles.orderAmount}>{formatCurrency(order.amountMinor, order.currency)}</Text>
                        <View style={styles.paymentMethodRow}>
                          <View style={[styles.paymentMethodIconWrap, { backgroundColor: `${paymentMethod.color}18` }]}>
                            <Ionicons name={paymentMethod.icon} size={11} color={paymentMethod.color} />
                          </View>
                          <Text style={styles.paymentMethodText}>{paymentMethod.label}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.orderMetaRow}>
                      {order.itemCount != null ? (
                        <Text style={styles.orderMeta}>
                          {formatItemCount(t('merchant_order_queue_items_count'), order.itemCount)}
                        </Text>
                      ) : null}
                          <Text style={styles.orderMeta}>{getCheckoutIntentLabel(t, order.checkoutIntent)}</Text>
                      <Text style={styles.orderMeta}>
                        {t('order_updated')}: {formatDate(order.updatedAt)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
                  );
                })()
              ))}
            </View>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  title: { fontSize: 24, fontWeight: '800', color: colors.onSurface },
  subtitle: { marginTop: 4, marginBottom: spacing.sm, fontSize: 13, color: colors.gray600 },
  metricsRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  metricCard: {
    minWidth: 116,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  metricCount: { fontSize: 22, fontWeight: '800', color: colors.onSurface },
  metricLabel: { marginTop: 2, fontSize: 12, color: colors.gray600 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.onSurface },
  sectionHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  sectionCount: { fontSize: 13, fontWeight: '700', color: colors.gray600 },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionToggleText: { fontSize: 12, fontWeight: '600', color: colors.gray600 },
  orderCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', gap: spacing.md,
  },
  orderCardMuted: { opacity: 0.72 },
  orderIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBody: { flex: 1 },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' },
  orderHeading: { flex: 1 },
  orderNum: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  statusText: { marginTop: 4, fontSize: 12, fontWeight: '700' },
  pickupNumber: { fontSize: 18, fontWeight: '800', color: colors.onSurface, marginBottom: 2 },
  preparationBadgeWrap: { marginTop: 6 },
  orderMetaRow: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  orderMeta: { fontSize: 12, color: colors.gray600 },
  orderAmountStack: { alignItems: 'flex-end', gap: 4, maxWidth: 118 },
  orderAmount: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  paymentMethodIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethodText: { flexShrink: 1, fontSize: 11, fontWeight: '600', color: colors.gray500, textAlign: 'right' },
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  emptyText: { fontSize: 15, color: colors.gray500, textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryBtnText: { color: colors.black, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
