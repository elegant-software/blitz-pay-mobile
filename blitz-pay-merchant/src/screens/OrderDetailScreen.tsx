import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackParamList } from '../types';
import { useMerchantOrderDetail } from '../features/orders/hooks/useMerchantOrderDetail';

type RouteProps = RouteProp<RootStackParamList, 'OrderDetail'>;

const STATUS_COLORS = {
  pending: colors.warning,
  processing: colors.primary,
  completed: colors.success,
  cancelled: colors.error,
} as const;

function formatCurrency(amountMinor: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amountMinor / 100);
}

export default function OrderDetailScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { order, loading, error } = useMerchantOrderDetail(route.params.orderId);

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
          <Text style={styles.centerText}>{t('merchant_order_detail_error_body')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 96 + insets.bottom }} showsVerticalScrollIndicator={false}>
          <View style={[styles.summaryCard, shadow.md]}>
            <View style={styles.summaryTop}>
              <View>
                <Text style={styles.orderNum}>{t('order_number')}{order.orderNumber}</Text>
                <Text style={styles.orderId}>ID: {order.orderId}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[order.status]}15` }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[order.status] }]}>
                  {t(`status_${order.status}` as Parameters<typeof t>[0])}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('customer')}</Text>
              <Text style={styles.detailValue}>{order.customerName ?? t('customer_unknown')}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('order_total')}</Text>
              <Text style={[styles.detailValue, styles.amountText]}>
                {formatCurrency(order.amountMinor, order.currency)}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('order_items')}</Text>
            <View style={[styles.itemsCard, shadow.sm]}>
              {order.items.length === 0 ? (
                <Text style={styles.emptyItemsText}>{t('merchant_order_items_empty')}</Text>
              ) : (
                order.items.map((item) => (
                  <View key={`${order.orderId}-${item.productId}`} style={styles.itemRow}>
                    <View style={styles.itemText}>
                      <Text style={styles.itemName}>{item.quantity}× {item.name}</Text>
                      <Text style={styles.itemMeta}>{formatCurrency(item.unitPriceMinor, order.currency)}</Text>
                    </View>
                    <Text style={styles.itemTotal}>{formatCurrency(item.lineTotalMinor, order.currency)}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>
      )}
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
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNum: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  orderId: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  statusPill: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.gray200, marginVertical: spacing.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  detailLabel: { fontSize: 14, color: colors.gray600 },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  amountText: { fontSize: 18, fontWeight: '800' },
  section: { paddingHorizontal: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.sm },
  itemsCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.lg,
  },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.sm },
  itemText: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  itemMeta: { marginTop: 4, fontSize: 12, color: colors.gray600 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  emptyItemsText: { fontSize: 13, color: colors.gray500 },
});
