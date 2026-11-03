import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav } from '../types';
import { fetchRecentOrders } from '../features/order-payment/services/orderPaymentService';
import { orderPaymentStore } from '../features/order-payment/store/orderPaymentStore';
import {
  isOrderResumable,
  type CheckoutPaymentMethod,
  type RecentOrderSummary,
} from '../features/order-payment/types/orderPayment';

const ORDER_STATUS_COLORS = {
  PENDING_PAYMENT: colors.warning,
  PAYMENT_IN_PROGRESS: colors.primary,
  PAID: colors.success,
  PAYMENT_FAILED: colors.error,
  CANCELLED: colors.gray500,
} as const;

function formatAmount(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amountMinor / 100);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function preferredMethodFor(order: RecentOrderSummary): CheckoutPaymentMethod | undefined {
  const session = orderPaymentStore.getSession(order.orderId);
  return session?.selectedMethod;
}

function availableChannelsFor(order: RecentOrderSummary) {
  const session = orderPaymentStore.getSession(order.orderId);
  if (session?.availableChannels?.length) return session.availableChannels;
  return session?.selectedChannel ? [session.selectedChannel] : undefined;
}

function formatMerchantLabel(order: RecentOrderSummary): string | null {
  return order.merchantName ?? order.branchName ?? null;
}

function isInvoiceOrder(order: RecentOrderSummary): boolean {
  return order.usesDeferredPayment === true && order.targetShopperId != null;
}

function formatDueDate(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export default function VaultScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootStackNav>();
  const [orders, setOrders] = useState<RecentOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    // ponytail: loading starts true for first load only; refocus refreshes silently.
    setError(null);
    try {
      const recentOrders = await fetchRecentOrders();
      setOrders(recentOrders);
      orderPaymentStore.setRecentOrders(recentOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Tab screens stay mounted, so reload on every focus to pick up webhook-driven status changes (e.g. PAID).
  useFocusEffect(
    useCallback(() => {
      void loadOrders();
    }, [loadOrders]),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('vault_recent_orders_title')}</Text>
        <Text style={styles.subtitle}>{t('vault_recent_orders_subtitle')}</Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>{t('vault_orders_loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={42} color={colors.error} />
          <Text style={styles.centerTitle}>{t('vault_orders_error_title')}</Text>
          <Text style={styles.centerText}>{t('vault_orders_error_body')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadOrders()}>
            <Text style={styles.retryButtonText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="receipt-outline" size={42} color={colors.gray400} />
          <Text style={styles.centerTitle}>{t('vault_orders_empty_title')}</Text>
          <Text style={styles.centerText}>{t('vault_orders_empty_body')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 96 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {orders.map((order) => {
            const resumable = isOrderResumable(order.status);
            const color = ORDER_STATUS_COLORS[order.status];
            const merchantLabel = formatMerchantLabel(order);
            const invoice = isInvoiceOrder(order);
            return (
              <TouchableOpacity
                key={order.orderId}
                style={[styles.orderCard, invoice && styles.invoiceOrderCard, shadow.sm]}
                activeOpacity={0.85}
                onPress={() =>
                    navigation.navigate('OrderDetail', {
                      orderId: order.orderId,
                      merchantName: order.merchantName,
                      branchName: order.branchName,
                      merchantLogoUrl: order.merchantLogoUrl,
                      availableChannels: availableChannelsFor(order),
                      preferredMethod: preferredMethodFor(order),
                    })}
              >
                <View style={styles.orderHeaderRow}>
                  <View style={styles.orderHeaderText}>
                    {invoice ? (
                      <View style={styles.invoiceBadgeRow}>
                        <View style={styles.invoiceBadge}>
                          <Ionicons name="document-text-outline" size={11} color={colors.secondary} />
                          <Text style={styles.invoiceBadgeText}>{t('order_invoice_badge')}</Text>
                        </View>
                      </View>
                    ) : null}
                    <Text style={styles.orderIdLabel}>{t('order_reference_label', { orderId: order.orderId })}</Text>
                    {merchantLabel ? (
                      <Text style={styles.orderMeta}>
                        {merchantLabel}
                        {order.merchantName && order.branchName ? ` · ${order.branchName}` : ''}
                      </Text>
                    ) : null}
                    {invoice && order.dueDate ? (
                      <View style={styles.dueDateRow}>
                        <Ionicons name="calendar-outline" size={12} color={colors.warning} />
                        <Text style={styles.dueDateText}>{t('order_due_date', { date: formatDueDate(order.dueDate) })}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.orderMeta}>{formatDate(order.createdAt)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: `${color}18` }]}>
                    <Text style={[styles.statusText, { color }]}>{t(`order_status_${order.status}` as never)}</Text>
                  </View>
                </View>

                <View style={styles.orderFooterRow}>
                  <Text style={styles.amountText}>{formatAmount(order.totalAmountMinor, order.currency)}</Text>
                  {resumable ? (
                    <View style={styles.resumePill}>
                      <Text style={styles.resumePillText}>{t('resume_payment')}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.onSurface },
  subtitle: { marginTop: 4, fontSize: 13, color: colors.gray600 },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  centerTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  centerText: { fontSize: 14, color: colors.gray600, textAlign: 'center' },
  retryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: { color: colors.black, fontWeight: '700' },
  orderCard: {
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  orderHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  orderHeaderText: { flex: 1 },
  orderIdLabel: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  orderMeta: { marginTop: 4, fontSize: 12, color: colors.gray600 },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '700' },
  orderFooterRow: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountText: { fontSize: 18, fontWeight: '800', color: colors.onSurface },
  resumePill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: `${colors.primary}20`,
  },
  resumePillText: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  invoiceOrderCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
  },
  invoiceBadgeRow: { flexDirection: 'row', marginBottom: 4 },
  invoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.secondary}15`,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  invoiceBadgeText: { fontSize: 11, fontWeight: '700', color: colors.secondary },
  dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  dueDateText: { fontSize: 12, fontWeight: '500', color: colors.warning },
});
