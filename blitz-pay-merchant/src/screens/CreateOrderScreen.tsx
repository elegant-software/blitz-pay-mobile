import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { observability } from '../lib/observability';
import { colors, spacing, radius, shadow } from '../lib/theme';
import { useMerchantProducts } from '../features/products/hooks/useMerchantProducts';
import {
  createMerchantOrder,
  fetchMerchantOrderDetail,
  MerchantOrderError,
} from '../features/orders/services/orderService';
import type { RootStackNav } from '../types';
import type { Product } from '../types';

const APP_LOGO = require('../../assets/app-icon.png');

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 100; // 5 minutes

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

type Mode = 'compose' | 'qr' | 'paid' | 'expired';

export default function CreateOrderScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const { activeBranchScope, branchScopeError } = useAuth();

  const { products, loading, errorKey } = useMerchantProducts(activeBranchScope, branchScopeError);
  const activeProducts = products.filter((p) => p.active);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<Mode>('compose');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [orderTotal, setOrderTotal] = useState(0);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll order status while QR is displayed
  useEffect(() => {
    if (mode !== 'qr' || !createdOrderId || !activeBranchScope) return;

    let cancelled = false;
    let pollCount = 0;

    const poll = async () => {
      if (cancelled) return;
      try {
        const order = await fetchMerchantOrderDetail(createdOrderId, activeBranchScope);
        if (cancelled) return;
        observability.info('create_order_poll_result', {
          orderId: createdOrderId,
          status: order.status,
          pollCount,
        });
        if (order.status === 'paid') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setMode('paid');
          return;
        }
      } catch {
        // transient backend error — keep polling
      }

      pollCount += 1;
      if (pollCount >= MAX_POLLS) {
        if (!cancelled) {
          observability.info('create_order_poll_expired', { orderId: createdOrderId });
          setMode('expired');
        }
        return;
      }

      if (!cancelled) {
        pollTimerRef.current = setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
      }
    };

    pollTimerRef.current = setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [mode, createdOrderId, activeBranchScope]);

  const selectedCount = Object.values(quantities).filter((q) => q > 0).length;
  const runningTotal = activeProducts.reduce(
    (sum, p) => sum + p.unitPrice * (quantities[p.id] ?? 0),
    0,
  );

  const increment = (productId: string) =>
    setQuantities((q) => ({ ...q, [productId]: (q[productId] ?? 0) + 1 }));

  const decrement = (productId: string) =>
    setQuantities((q) => {
      const current = q[productId] ?? 0;
      if (current <= 1) {
        const next = { ...q };
        delete next[productId];
        return next;
      }
      return { ...q, [productId]: current - 1 };
    });

  const handleCreate = async () => {
    if (!activeBranchScope || selectedCount === 0) return;
    setCreating(true);
    setCreateError('');
    try {
      const items = activeProducts
        .filter((p) => (quantities[p.id] ?? 0) > 0)
        .map((p) => ({ productId: p.id, quantity: quantities[p.id]! }));
      const order = await createMerchantOrder(
        activeBranchScope.merchantId,
        activeBranchScope.branchId,
        items,
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreatedOrderId(order.orderId);
      setOrderTotal(runningTotal);
      setMode('qr');
    } catch (e) {
      setCreateError(e instanceof MerchantOrderError ? e.detail : t('create_order_failed'));
    } finally {
      setCreating(false);
    }
  };

  const handleReset = () => {
    setMode('compose');
    setQuantities({});
    setCreatedOrderId('');
    setCreateError('');
    setOrderTotal(0);
  };

  const qrValue = `blitzpay://order/${createdOrderId}`;

  if (mode === 'paid') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>{t('create_order')}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        <View style={styles.resultContainer}>
          <View style={[styles.resultCard, shadow.lg]}>
            <View style={[styles.resultIcon, styles.resultIconPaid]}>
              <Ionicons name="checkmark" size={48} color={colors.white} />
            </View>
            <Text style={styles.resultTitle}>{t('create_order_paid_title')}</Text>
            <Text style={styles.resultSubtitle}>{t('create_order_paid_subtitle')}</Text>
            <Text style={styles.resultAmount}>{formatCurrency(orderTotal)}</Text>
            <Text style={styles.resultOrderId}>#{createdOrderId}</Text>
          </View>

          <View style={styles.qrActions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.secondaryBtn]}
              onPress={() => navigation.navigate('OrderDetail', { orderId: createdOrderId })}
              activeOpacity={0.85}
            >
              <Ionicons name="receipt-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryBtnText}>{t('create_order_view_order')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryBtn]}
              onPress={handleReset}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color={colors.black} />
              <Text style={styles.primaryBtnText}>{t('create_order_new')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (mode === 'expired') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>{t('create_order')}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        <View style={styles.resultContainer}>
          <View style={[styles.resultCard, shadow.lg]}>
            <View style={[styles.resultIcon, styles.resultIconExpired]}>
              <Ionicons name="time-outline" size={48} color={colors.white} />
            </View>
            <Text style={styles.resultTitle}>{t('create_order_expired_title')}</Text>
            <Text style={styles.resultSubtitle}>{t('create_order_expired_subtitle')}</Text>
            <Text style={styles.resultAmount}>{formatCurrency(orderTotal)}</Text>
            <Text style={styles.resultOrderId}>#{createdOrderId}</Text>
          </View>

          <View style={styles.qrActions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.secondaryBtn]}
              onPress={() => navigation.navigate('OrderDetail', { orderId: createdOrderId })}
              activeOpacity={0.85}
            >
              <Ionicons name="receipt-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryBtnText}>{t('create_order_view_order')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryBtn]}
              onPress={handleReset}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color={colors.black} />
              <Text style={styles.primaryBtnText}>{t('create_order_new')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (mode === 'qr') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>{t('create_order')}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        <View style={styles.qrContainer}>
          <View style={[styles.qrCard, shadow.lg]}>
            <QRCode
              value={qrValue}
              size={240}
              color={colors.onSurface}
              backgroundColor={colors.white}
              logo={APP_LOGO}
              logoSize={52}
              logoBackgroundColor={colors.white}
              logoMargin={4}
              logoBorderRadius={10}
              ecl="H"
            />
            <Text style={styles.qrReadyText}>{t('create_order_qr_ready')}</Text>
            <View style={styles.qrMeta}>
              <Text style={styles.qrTotal}>{formatCurrency(orderTotal)}</Text>
              <Text style={styles.qrOrderId}>#{createdOrderId}</Text>
            </View>
            <View style={styles.waitingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.waitingText}>{t('create_order_waiting')}</Text>
            </View>
          </View>

          <View style={styles.qrActions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.secondaryBtn]}
              onPress={() => navigation.navigate('OrderDetail', { orderId: createdOrderId })}
              activeOpacity={0.85}
            >
              <Ionicons name="receipt-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryBtnText}>{t('create_order_view_order')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryBtn]}
              onPress={handleReset}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color={colors.black} />
              <Text style={styles.primaryBtnText}>{t('create_order_new')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('create_order')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : errorKey || activeProducts.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="cube-outline" size={48} color={colors.gray300} />
          <Text style={styles.emptyText}>{t('create_order_no_products')}</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={activeProducts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <Text style={styles.subtitle}>{t('create_order_subtitle')}</Text>
            }
            renderItem={({ item }) => (
              <ProductRow
                product={item}
                quantity={quantities[item.id] ?? 0}
                onIncrement={() => increment(item.id)}
                onDecrement={() => decrement(item.id)}
              />
            )}
          />

          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
            {createError ? <Text style={styles.errorText}>{createError}</Text> : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('create_order_total')}</Text>
              <Text style={styles.totalAmount}>{formatCurrency(runningTotal)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.generateBtn, (selectedCount === 0 || creating) && styles.generateBtnDisabled]}
              onPress={() => void handleCreate()}
              disabled={selectedCount === 0 || creating}
              activeOpacity={0.85}
            >
              {creating ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <Ionicons name="qr-code-outline" size={18} color={colors.black} />
              )}
              <Text style={styles.generateBtnText}>
                {creating ? t('create_order_generating') : t('create_order_generate_cta')}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function ProductRow({
  product,
  quantity,
  onIncrement,
  onDecrement,
}: {
  product: Product;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const selected = quantity > 0;
  return (
    <View style={[styles.productRow, selected && styles.productRowSelected]}>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>
        {product.categoryName ? (
          <Text style={styles.productCategory}>{product.categoryName}</Text>
        ) : null}
        <Text style={styles.productPrice}>
          {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
            product.unitPrice,
          )}
        </Text>
      </View>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={[styles.stepperBtn, quantity === 0 && styles.stepperBtnDisabled]}
          onPress={onDecrement}
          disabled={quantity === 0}
          hitSlop={8}
        >
          <Ionicons name="remove" size={16} color={quantity === 0 ? colors.gray300 : colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.stepperCount, selected && styles.stepperCountSelected]}>
          {quantity}
        </Text>
        <TouchableOpacity style={styles.stepperBtn} onPress={onIncrement} hitSlop={8}>
          <Ionicons name="add" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
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
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  emptyText: { fontSize: 15, color: colors.gray500, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.gray600, marginBottom: spacing.sm },
  listContent: { padding: spacing.md, paddingBottom: 160 },
  productRow: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  productRowSelected: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  productCategory: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: '700', color: colors.primary, marginTop: 4 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.full,
  },
  stepperBtnDisabled: { opacity: 0.4 },
  stepperCount: { fontSize: 15, fontWeight: '700', color: colors.gray400, minWidth: 20, textAlign: 'center' },
  stepperCountSelected: { color: colors.onSurface },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    gap: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 15, color: colors.gray600, fontWeight: '600' },
  totalAmount: { fontSize: 20, fontWeight: '800', color: colors.onSurface },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
  },
  generateBtnDisabled: { opacity: 0.45 },
  generateBtnText: { fontSize: 16, fontWeight: '700', color: colors.black },
  errorText: { fontSize: 13, color: colors.error, textAlign: 'center' },
  // QR mode
  qrContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.xl,
  },
  qrCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  qrReadyText: { fontSize: 14, color: colors.gray500, textAlign: 'center' },
  qrMeta: { alignItems: 'center', gap: 4 },
  qrTotal: { fontSize: 28, fontWeight: '800', color: colors.onSurface },
  qrOrderId: { fontSize: 13, color: colors.gray500 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  waitingText: { fontSize: 13, color: colors.gray500 },
  qrActions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.full,
  },
  primaryBtn: { backgroundColor: colors.primary },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: colors.black },
  secondaryBtn: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  // Paid / expired result modes
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.xl,
  },
  resultCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  resultIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultIconPaid: { backgroundColor: colors.success },
  resultIconExpired: { backgroundColor: colors.gray400 },
  resultTitle: { fontSize: 22, fontWeight: '800', color: colors.onSurface, textAlign: 'center' },
  resultSubtitle: { fontSize: 14, color: colors.gray500, textAlign: 'center' },
  resultAmount: { fontSize: 32, fontWeight: '800', color: colors.onSurface },
  resultOrderId: { fontSize: 13, color: colors.gray500 },
});
