import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav } from '../types';
import { resolveCurrentCoordinates } from '../lib/location';
import { resolveNearbyMerchantScope, type MerchantScope } from '../lib/merchantProducts';
import { useMerchantOrders } from '../features/orders/hooks/useMerchantOrders';
import type { MerchantOrderFilter, MerchantOrderStatus } from '../features/orders/types/order';

const STATUS_COLORS: Record<MerchantOrderStatus, string> = {
  pending: colors.warning,
  processing: colors.primary,
  completed: colors.success,
  cancelled: colors.error,
};

const FILTER_TABS: Array<{ key: MerchantOrderFilter; labelKey: 'all_orders' | 'status_processing' | 'status_completed' | 'status_cancelled' }> = [
  { key: 'ALL', labelKey: 'all_orders' },
  { key: 'PROCESSING', labelKey: 'status_processing' },
  { key: 'COMPLETED', labelKey: 'status_completed' },
  { key: 'CANCELLED', labelKey: 'status_cancelled' },
];

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

export default function OrdersScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<MerchantOrderFilter>('ALL');
  const [merchantScope, setMerchantScope] = useState<MerchantScope | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const { orders, loading, error, reload } = useMerchantOrders(merchantScope?.branchId ?? null, activeFilter);

  useEffect(() => {
    let active = true;
    void resolveCurrentCoordinates()
      .then(resolveNearbyMerchantScope)
      .then((scope) => {
        if (!active) return;
        setMerchantScope(scope);
        setScopeError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setMerchantScope(null);
        setScopeError(err instanceof Error ? err.message : 'merchant_products_branch_missing');
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          order.orderNumber.toLowerCase().includes(q) ||
          (order.customerName ?? '').toLowerCase().includes(q)
        );
      }),
    [orders, search],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('orders_today_title')}</Text>
        <Text style={styles.subtitle}>
          {merchantScope?.branchName
            ? `${t('merchant_branch_scope')}: ${merchantScope.branchName}`
            : t('orders_today_subtitle')}
        </Text>
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 90 + insets.bottom, paddingTop: spacing.sm }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.emptyText}>{t('merchant_orders_loading')}</Text>
          </View>
        ) : scopeError || error ? (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
            <Text style={styles.emptyTitle}>{t('merchant_orders_error_title')}</Text>
            <Text style={styles.emptyText}>{t((scopeError ?? error ?? 'merchant_orders_error_body') as Parameters<typeof t>[0])}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => void reload()}>
              <Text style={styles.retryBtnText}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color={colors.gray300} />
            <Text style={styles.emptyTitle}>{t('merchant_orders_empty_title')}</Text>
            <Text style={styles.emptyText}>{t('merchant_orders_empty_body')}</Text>
          </View>
        ) : filtered.map((order) => (
          <TouchableOpacity
            key={order.orderId}
            style={[styles.orderCard, shadow.sm]}
            onPress={() => navigation.navigate('OrderDetail', { orderId: order.orderId })}
            activeOpacity={0.7}
          >
            <View style={styles.orderTop}>
              <View>
                <Text style={styles.orderNum}>{t('order_number')}{order.orderNumber}</Text>
                <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[order.status]}15` }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[order.status] }]}>
                  {t(`status_${order.status}` as Parameters<typeof t>[0])}
                </Text>
              </View>
            </View>
            <View style={styles.orderBottom}>
              <View style={styles.customerRow}>
                <Ionicons name="person-outline" size={14} color={colors.gray500} />
                <Text style={styles.customerName}>{order.customerName ?? t('customer_unknown')}</Text>
              </View>
              <Text style={styles.orderAmount}>{formatCurrency(order.amountMinor, order.currency)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  title: { fontSize: 24, fontWeight: '800', color: colors.onSurface },
  subtitle: { marginTop: 4, marginBottom: spacing.sm, fontSize: 13, color: colors.gray600 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.onSurface },
  filterRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: colors.white },
  filterTab: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.full, backgroundColor: colors.surface,
  },
  filterTabActive: { backgroundColor: colors.primary },
  filterTabText: { fontSize: 13, fontWeight: '600', color: colors.gray600 },
  filterTabTextActive: { color: colors.black },
  orderCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  orderNum: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  orderDate: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  statusPill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  orderBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  customerName: { fontSize: 13, color: colors.gray600 },
  orderAmount: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
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
});
