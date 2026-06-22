import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
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
  fetchBranchCustomers,
  searchShopperByEmail,
  MerchantOrderError,
} from '../features/orders/services/orderService';
import type { BranchCustomer } from '../features/orders/types/order';
import type { RootStackNav } from '../types';
import type { Product } from '../types';

const APP_LOGO = require('../../assets/app-icon.png');

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 100; // 5 minutes

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

type Mode = 'compose' | 'intent' | 'shopper' | 'qr' | 'paid' | 'expired' | 'invoice_sent';

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

  // Invoice flow state
  const [customers, setCustomers] = useState<BranchCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState('');
  const [selectedShopper, setSelectedShopper] = useState<BranchCustomer | null>(null);
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResult, setSearchResult] = useState<BranchCustomer | null | undefined>(undefined);
  const [dueDate, setDueDate] = useState('');

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

  // Load past customers when entering shopper picker
  useEffect(() => {
    if (mode !== 'shopper' || !activeBranchScope) return;
    let cancelled = false;
    setCustomersLoading(true);
    setCustomersError('');
    void (async () => {
      try {
        const result = await fetchBranchCustomers(activeBranchScope.branchId);
        if (!cancelled) setCustomers(result);
      } catch {
        if (!cancelled) setCustomersError(t('create_order_customers_load_failed'));
      } finally {
        if (!cancelled) setCustomersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, activeBranchScope, t]);

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

  const handleProceed = () => {
    if (selectedCount === 0) return;
    setMode('intent');
  };

  const handleQrIntent = async () => {
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

  const handleInvoiceIntent = () => {
    setSelectedShopper(null);
    setSearchEmail('');
    setSearchError('');
    setSearchResult(undefined);
    setDueDate('');
    setMode('shopper');
  };

  const handleSearchShopper = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(undefined);
    try {
      const result = await searchShopperByEmail(searchEmail.trim());
      setSearchResult(result);
      if (!result) setSearchError(t('create_order_shopper_not_found'));
    } catch {
      setSearchError(t('create_order_shopper_not_found'));
    } finally {
      setSearching(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!activeBranchScope || !selectedShopper || selectedCount === 0) return;
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
        {
          targetShopperId: selectedShopper.shopperAccountId,
          dueDate: dueDate || undefined,
        },
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreatedOrderId(order.orderId);
      setOrderTotal(runningTotal);
      setMode('invoice_sent');
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
    setSelectedShopper(null);
    setSearchEmail('');
    setSearchError('');
    setSearchResult(undefined);
    setDueDate('');
    setCustomers([]);
    setCustomersError('');
  };

  const qrValue = `blitzpay://order/${createdOrderId}`;

  // ---------- Result screens ----------

  if (mode === 'invoice_sent') {
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
              <Ionicons name="paper-plane" size={48} color={colors.white} />
            </View>
            <Text style={styles.resultTitle}>{t('create_order_invoice_sent_title')}</Text>
            <Text style={styles.resultSubtitle}>{t('create_order_invoice_sent_subtitle')}</Text>
            <Text style={styles.resultAmount}>{formatCurrency(orderTotal)}</Text>
            {selectedShopper ? (
              <Text style={styles.resultOrderId}>{selectedShopper.name}</Text>
            ) : null}
            {dueDate ? (
              <Text style={styles.resultOrderId}>{t('create_order_due_date')}: {formatDate(dueDate)}</Text>
            ) : null}
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

  // ---------- Checkout intent selector ----------

  if (mode === 'intent') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('compose')} style={styles.closeBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('create_order')}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        <View style={styles.intentContainer}>
          <Text style={styles.intentTitle}>{t('create_order_checkout_intent')}</Text>
          <View style={styles.intentSummary}>
            <Text style={styles.intentSummaryLabel}>{t('create_order_total')}</Text>
            <Text style={styles.intentSummaryAmount}>{formatCurrency(runningTotal)}</Text>
          </View>

          {createError ? <Text style={styles.errorText}>{createError}</Text> : null}

          <TouchableOpacity
            style={[styles.intentCard, shadow.sm]}
            onPress={() => void handleQrIntent()}
            activeOpacity={0.85}
            disabled={creating}
          >
            <View style={styles.intentCardIcon}>
              <Ionicons name="qr-code-outline" size={28} color={colors.primary} />
            </View>
            <View style={styles.intentCardContent}>
              <Text style={styles.intentCardTitle}>{t('create_order_intent_qr')}</Text>
              <Text style={styles.intentCardDesc}>{t('create_order_intent_qr_desc')}</Text>
            </View>
            {creating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.intentCard, shadow.sm]}
            onPress={handleInvoiceIntent}
            activeOpacity={0.85}
            disabled={creating}
          >
            <View style={styles.intentCardIcon}>
              <Ionicons name="document-text-outline" size={28} color={colors.secondary} />
            </View>
            <View style={styles.intentCardContent}>
              <Text style={styles.intentCardTitle}>{t('create_order_intent_invoice')}</Text>
              <Text style={styles.intentCardDesc}>{t('create_order_intent_invoice_desc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- Shopper picker ----------

  if (mode === 'shopper') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('intent')} style={styles.closeBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('create_order_select_customer')}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={[]} // use ListHeaderComponent for content since list is heterogeneous
          renderItem={null}
          keyExtractor={() => ''}
          contentContainerStyle={styles.shopperContent}
          ListHeaderComponent={
            <>
              {/* Email search */}
              <Text style={styles.sectionLabel}>{t('create_order_search_by_email')}</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('create_order_search_email_placeholder')}
                  placeholderTextColor={colors.gray400}
                  value={searchEmail}
                  onChangeText={setSearchEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="search"
                  onSubmitEditing={() => void handleSearchShopper()}
                />
                <TouchableOpacity
                  style={[styles.searchBtn, (!searchEmail.trim() || searching) && styles.searchBtnDisabled]}
                  onPress={() => void handleSearchShopper()}
                  disabled={!searchEmail.trim() || searching}
                  activeOpacity={0.85}
                >
                  {searching ? (
                    <ActivityIndicator size="small" color={colors.black} />
                  ) : (
                    <Text style={styles.searchBtnText}>{t('create_order_search')}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {searchError ? <Text style={styles.searchErrorText}>{searchError}</Text> : null}

              {searchResult ? (
                <TouchableOpacity
                  style={[
                    styles.customerRow,
                    selectedShopper?.shopperAccountId === searchResult.shopperAccountId && styles.customerRowSelected,
                  ]}
                  onPress={() => setSelectedShopper(searchResult)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="person-circle-outline" size={32} color={colors.primary} />
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName}>{searchResult.name}</Text>
                    <Text style={styles.customerMeta}>{searchEmail}</Text>
                  </View>
                  {selectedShopper?.shopperAccountId === searchResult.shopperAccountId ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  ) : null}
                </TouchableOpacity>
              ) : null}

              {/* Past customers */}
              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>{t('create_order_past_customers')}</Text>

              {customersLoading ? (
                <View style={styles.centeredSmall}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>{t('create_order_customers_loading')}</Text>
                </View>
              ) : customersError ? (
                <Text style={styles.searchErrorText}>{customersError}</Text>
              ) : customers.length === 0 ? (
                <Text style={styles.emptyCustomersText}>{t('create_order_no_customers')}</Text>
              ) : (
                customers.map((customer) => (
                  <TouchableOpacity
                    key={customer.shopperAccountId}
                    style={[
                      styles.customerRow,
                      selectedShopper?.shopperAccountId === customer.shopperAccountId && styles.customerRowSelected,
                    ]}
                    onPress={() => setSelectedShopper(customer)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="person-circle-outline" size={32} color={colors.gray600} />
                    <View style={styles.customerInfo}>
                      <Text style={styles.customerName}>{customer.name}</Text>
                    </View>
                    {selectedShopper?.shopperAccountId === customer.shopperAccountId ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                ))
              )}

              {/* Due date */}
              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>{t('create_order_due_date')}</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.gray400}
                value={dueDate}
                onChangeText={setDueDate}
                keyboardType="default"
                returnKeyType="done"
              />
            </>
          }
        />

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          {createError ? <Text style={styles.errorText}>{createError}</Text> : null}
          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>{t('create_order_total')}</Text>
              {selectedShopper ? (
                <Text style={styles.selectedShopperLabel}>{selectedShopper.name}</Text>
              ) : null}
            </View>
            <Text style={styles.totalAmount}>{formatCurrency(runningTotal)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.generateBtn, styles.invoiceBtn, (!selectedShopper || creating) && styles.generateBtnDisabled]}
            onPress={() => void handleSendInvoice()}
            disabled={!selectedShopper || creating}
            activeOpacity={0.85}
          >
            {creating ? (
              <ActivityIndicator size="small" color={colors.black} />
            ) : (
              <Ionicons name="paper-plane-outline" size={18} color={colors.black} />
            )}
            <Text style={styles.generateBtnText}>
              {creating ? t('create_order_sending_invoice') : t('create_order_send_invoice_cta')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- Compose (product selection) ----------

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
              style={[styles.generateBtn, selectedCount === 0 && styles.generateBtnDisabled]}
              onPress={handleProceed}
              disabled={selectedCount === 0}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-forward" size={18} color={colors.black} />
              <Text style={styles.generateBtnText}>{t('next')}</Text>
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
  centeredSmall: { alignItems: 'center', gap: spacing.sm, padding: spacing.md },
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
  selectedShopperLabel: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
  },
  invoiceBtn: {
    // same as generateBtn — kept as a hook for future differentiation
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
  // Intent selector
  intentContainer: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  intentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  intentSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  intentSummaryLabel: { fontSize: 15, color: colors.gray600, fontWeight: '600' },
  intentSummaryAmount: { fontSize: 20, fontWeight: '800', color: colors.onSurface },
  intentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.md,
  },
  intentCardIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  intentCardContent: { flex: 1 },
  intentCardTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  intentCardDesc: { fontSize: 13, color: colors.gray500, marginTop: 2 },
  // Shopper picker
  shopperContent: { padding: spacing.md, paddingBottom: 200 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray700,
    marginBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnDisabled: { opacity: 0.45 },
  searchBtnText: { fontSize: 14, fontWeight: '700', color: colors.black },
  searchErrorText: { fontSize: 13, color: colors.error, marginBottom: spacing.sm },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  customerRowSelected: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  customerMeta: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  emptyCustomersText: { fontSize: 13, color: colors.gray500, textAlign: 'center', paddingVertical: spacing.md },
  loadingText: { fontSize: 13, color: colors.gray500 },
  dateInput: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
});
