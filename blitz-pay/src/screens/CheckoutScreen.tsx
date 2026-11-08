import React, { useEffect, useMemo, useState } from 'react';
import { ProductImage } from '../features/merchant-catalog/components/ProductImage';
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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { observability } from '../lib/observability';
import { config } from '../lib/config';
import { colors, spacing, radius } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';
import { useOrderPayment } from '../features/order-payment/hooks/useOrderPayment';
import type { CheckoutIntent, CheckoutPaymentMethod } from '../features/order-payment/types/orderPayment';
import { isMethodAvailable } from '../features/order-payment/types/orderPayment';
import { fetchMerchantStripeConnectStatus } from '../features/merchant-catalog/services/merchantCatalogService';
import type { PaymentChannel } from '../features/merchant-catalog/types/catalog';

function resolveImageUri(uri?: string): string | undefined {
  if (!uri) return undefined;
  if (/^https?:\/\//i.test(uri)) return uri;
  const baseUrl = config.apiUrl.replace(/\/+$/, '');
  const path = uri.startsWith('/') ? uri : `/${uri}`;
  return `${baseUrl}${path}`;
}

function summarizeImageUri(uri?: string): { host: string | null; path: string | null } {
  if (!uri) return { host: null, path: null };
  try {
    const parsed = new URL(uri);
    return {
      host: parsed.host,
      path: parsed.pathname.slice(0, 160),
    };
  } catch {
    return {
      host: null,
      path: uri.slice(0, 160),
    };
  }
}

function mergePaymentChannels(...channelGroups: Array<readonly PaymentChannel[] | undefined>): PaymentChannel[] {
  return Array.from(new Set(channelGroups.flatMap((channels) => channels ?? []))) as PaymentChannel[];
}

export default function CheckoutScreen() {
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Checkout'>>();
  const insets = useSafeAreaInsets();
  const { confirmCheckout } = useOrderPayment();

  const amount = route.params?.amount ?? 24.5;
  const merchantName = route.params?.merchantName ?? 'Merchant';
  const merchantId = route.params?.merchantId;
  const branchId = route.params?.branchId;
  const branchName = route.params?.branchName;
  const merchantLogoUrl = route.params?.merchantLogoUrl;
  const basketSummary = route.params?.basketSummary;
  const basketItemCount = route.params?.basketItemCount ?? route.params?.basketItems?.length ?? 0;
  const basketItems = route.params?.basketItems ?? [];
  const invoiceId = route.params?.invoiceId;
  const tableCode = route.params?.tableCode;
  const tableName = route.params?.tableName;
  const guestCount = route.params?.guestCount;
  // At a Table, signed-in shoppers may always defer payment or pay cash to staff.
  const delayedPaymentEnabled = (route.params?.delayedPaymentEnabled ?? false) || Boolean(tableCode);

  const [selectedIntent, setSelectedIntent] = useState<CheckoutIntent>(
    route.params?.delayedPaymentEnabled ? 'PAY_LATER' : 'PAY_NOW',
  );
  const [selectedMethod, setSelectedMethod] = useState<CheckoutPaymentMethod | null>(null);
  const [payCash, setPayCash] = useState(false);
  const canConfirm = selectedIntent === 'PAY_LATER' || Boolean(selectedMethod) || payCash;
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const routePaymentChannels = useMemo(
    () => route.params?.activePaymentChannels ?? [],
    [route.params?.activePaymentChannels],
  );
  const [activePaymentChannels, setActivePaymentChannels] = useState<PaymentChannel[]>(routePaymentChannels);

  useEffect(() => {
    let active = true;

    if (!merchantId) {
      setActivePaymentChannels(routePaymentChannels);
      return () => {
        active = false;
      };
    }

    void fetchMerchantStripeConnectStatus(merchantId)
      .then((status) => {
        if (!active) return;
        const stripeChannels: PaymentChannel[] = [
          ...(status?.charges_enabled === true ? ['STRIPE' as const] : []),
          ...(status?.pay_by_bank_enabled === true ? ['PAY_BY_BANK' as const] : []),
          ...(status?.tap_to_pay_enabled === true ? ['TAP_TO_PAY' as const] : []),
        ];
        const channels = mergePaymentChannels(routePaymentChannels, stripeChannels);
        setActivePaymentChannels(channels);
        setSelectedMethod((current) => {
          if (!current) return current;
          return isMethodAvailable(current, channels) ? current : null;
        });
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        observability.warn('checkout_stripe_status_load_failed', {
          merchantId,
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        });
        setActivePaymentChannels(routePaymentChannels);
        setSelectedMethod(null);
      });

    return () => {
      active = false;
    };
  }, [merchantId, routePaymentChannels]);

  const methods = useMemo(
    () =>
      [
        {
          key: 'bank' as const,
          icon: 'business-outline',
          label: t('bank_account_direct'),
          sub: t('ach_transfer'),
        },
        {
          key: 'card' as const,
          icon: 'card-outline',
          label: t('credit_debit_card'),
          sub: t('visa_mastercard'),
        },
        {
          key: 'pay_by_bank' as const,
          icon: 'swap-horizontal-outline',
          label: t('pay_by_bank'),
          sub: t('stripe_pay_by_bank_subtitle'),
        },
        {
          key: 'tap_to_pay' as const,
          icon: 'phone-portrait-outline',
          label: t('tap_to_pay'),
          sub: t('tap_to_pay_subtitle'),
        },
        {
          key: 'paypal' as const,
          icon: 'logo-paypal',
          label: t('paypal'),
          sub: t('express_checkout'),
        },
      ].filter((method) => isMethodAvailable(method.key, activePaymentChannels)),
    [activePaymentChannels, t],
  );

  const handleConfirm = async () => {
    setError('');
    setProcessing(true);

    observability.info('checkout_confirm_started', {
      method: selectedMethod ?? null,
      checkoutIntent: selectedIntent,
      amount,
      merchantName,
      merchantId: merchantId ?? null,
      branchId: branchId ?? null,
      basketItemCount,
      basketSummary: basketSummary ?? null,
      invoiceId: invoiceId ?? null,
    });

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await confirmCheckout({
        token,
        amount,
        merchantName,
        merchantId,
        branchId,
        branchName,
        merchantLogoUrl,
        basketSummary,
        basketItemCount,
        basketItems,
        invoiceId,
        user,
        selectedIntent,
        selectedMethod: payCash ? null : selectedMethod,
        availableChannels: activePaymentChannels,
        navigation,
        table: tableCode ? { tableCode, guestCount } : undefined,
        payWithCash: payCash,
      });

      observability.info('checkout_confirm_succeeded', {
        method: selectedMethod ?? null,
        checkoutIntent: selectedIntent,
        amount,
        merchantId: merchantId ?? null,
        branchId: branchId ?? null,
        basketItemCount,
        invoiceId: invoiceId ?? null,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const isNetworkError =
        rawMessage === 'Network request failed' ||
        rawMessage.toLowerCase().includes('network') ||
        rawMessage.toLowerCase().includes('fetch');
      const key = isNetworkError
        ? 'error_server_unreachable'
        : rawMessage === 'truelayer_invalid_response'
          ? 'truelayer_request_failed'
          : (err instanceof Error ? err.message : 'truelayer_reason_unknown');

      observability.error(
        'checkout_confirm_failed',
        {
          method: selectedMethod ?? null,
          amount,
          merchantId: merchantId ?? null,
          branchId: branchId ?? null,
          basketItemCount,
          basketSummary: basketSummary ?? null,
          invoiceId: invoiceId ?? null,
          reasonKey: key,
          checkoutIntent: selectedIntent,
          message: rawMessage,
        },
        err instanceof Error ? err : undefined,
      );
      setError(t(key as Parameters<typeof t>[0]));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('secure_checkout')}</Text>
        <View style={styles.secureIcon}>
          <Ionicons name="lock-closed" size={14} color={colors.success} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>{t('total_due')}</Text>
          <Text style={styles.amountValue}>€{amount.toFixed(2)}</Text>
          <Text style={styles.amountMerchant}>{merchantName}</Text>
          {tableName ? <Text style={styles.amountSummary}>{t('table_banner', { name: tableName })}</Text> : null}
          {basketSummary ? <Text style={styles.amountSummary}>{basketSummary}</Text> : null}
          {basketItems.length > 0 ? (
            <View style={styles.basketSummaryCard}>
              <Text style={styles.basketSummaryTitle}>{t('selected_items_count', { count: basketItemCount })}</Text>
              {basketItems.map((item) => {
                const productImageUri = resolveImageUri(item.imageUrl);
                const imageMeta = summarizeImageUri(productImageUri);
                return (
                  <View key={item.productId} style={styles.basketRow}>
                    <View style={styles.basketRowMain}>
                      {productImageUri ? (
                        <ProductImage
                          merchantId={merchantId}
                          branchId={branchId}
                          productId={item.productId}
                          source={{
                            uri: productImageUri,
                            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                          }}
                          style={styles.basketRowImage}
                          contentFit="cover" cachePolicy="memory-disk"
                          onLoadStart={() => {
                            observability.info('checkout_product_image_load_started', {
                              merchantId: merchantId ?? null,
                              branchId: branchId ?? null,
                              productId: item.productId,
                              imageHost: imageMeta.host,
                              imagePath: imageMeta.path,
                            });
                          }}
                          onLoad={() => {
                            observability.info('checkout_product_image_loaded', {
                              merchantId: merchantId ?? null,
                              branchId: branchId ?? null,
                              productId: item.productId,
                              imageHost: imageMeta.host,
                              imagePath: imageMeta.path,
                            });
                          }}
                          onError={(event) => {
                            observability.warn('checkout_product_image_failed', {
                              merchantId: merchantId ?? null,
                              branchId: branchId ?? null,
                              productId: item.productId,
                              imageHost: imageMeta.host,
                              imagePath: imageMeta.path,
                              reason: event.error ?? 'unknown_image_error',
                            });
                          }}
                        />
                      ) : (
                        <View style={styles.basketRowIcon}>
                          <Ionicons name="cube-outline" size={16} color={colors.gray600} />
                        </View>
                      )}
                      <Text style={styles.basketRowName}>{item.quantity}× {item.productName}</Text>
                    </View>
                    <Text style={styles.basketRowPrice}>€{item.lineTotal.toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          {delayedPaymentEnabled ? (
            <>
              <Text style={styles.sectionTitle}>{t('checkout_timing_title')}</Text>
              <Text style={styles.sectionSubtitle}>{t('checkout_timing_subtitle')}</Text>
              <View style={styles.intentGrid}>
                <TouchableOpacity
                  style={[styles.intentCard, selectedIntent === 'PAY_LATER' && styles.intentCardSelected]}
                  onPress={() => setSelectedIntent('PAY_LATER')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="time-outline" size={18} color={colors.onSurface} />
                  <Text style={styles.intentTitle}>{t('checkout_intent_pay_later')}</Text>
                  <Text style={styles.intentBody}>{t('checkout_intent_pay_later_hint')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.intentCard, selectedIntent === 'PAY_NOW' && styles.intentCardSelected]}
                  onPress={() => setSelectedIntent('PAY_NOW')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="flash-outline" size={18} color={colors.onSurface} />
                  <Text style={styles.intentTitle}>{t('checkout_intent_pay_now')}</Text>
                  <Text style={styles.intentBody}>{t('checkout_intent_pay_now_hint')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('payment_method')}</Text>
          {selectedIntent === 'PAY_LATER' ? (
            <View style={styles.infoBox}>
              <Ionicons name="wallet-outline" size={16} color={colors.primary} />
              <Text style={styles.infoText}>{t('checkout_intent_pay_later_hint')}</Text>
            </View>
          ) : null}
          {selectedIntent === 'PAY_LATER'
            ? null
            : methods.map((method) => (
            <TouchableOpacity
              key={method.key}
              style={[styles.methodRow, selectedMethod === method.key && styles.methodRowSelected]}
              onPress={() => {
                setSelectedMethod(method.key);
                setPayCash(false);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.methodIcon, selectedMethod === method.key && styles.methodIconSelected]}>
                <Ionicons
                  name={method.icon as React.ComponentProps<typeof Ionicons>['name']}
                  size={20}
                  color={selectedMethod === method.key ? colors.primary : colors.gray600}
                />
              </View>
              <View style={styles.methodInfo}>
                <Text style={[styles.methodLabel, selectedMethod === method.key && styles.methodLabelSelected]}>
                  {method.label}
                </Text>
                <Text style={styles.methodSub}>{method.sub}</Text>
              </View>
              <View style={[styles.radio, selectedMethod === method.key && styles.radioSelected]}>
                {selectedMethod === method.key && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
            ))}
          {selectedIntent === 'PAY_NOW' ? (
            <TouchableOpacity
              style={[styles.methodRow, payCash && styles.methodRowSelected]}
              onPress={() => {
                setPayCash(true);
                setSelectedMethod(null);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.methodIcon, payCash && styles.methodIconSelected]}>
                <Ionicons name="cash-outline" size={20} color={payCash ? colors.primary : colors.gray600} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={[styles.methodLabel, payCash && styles.methodLabelSelected]}>{t('checkout_cash')}</Text>
                <Text style={styles.methodSub}>{t('checkout_cash_hint')}</Text>
              </View>
              <View style={[styles.radio, payCash && styles.radioSelected]}>
                {payCash && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
          <View style={styles.securityTextBox}>
            <Text style={styles.securityTitle}>{t('encrypted_transaction')}</Text>
            <Text style={styles.securityDesc}>
              {selectedMethod === 'bank'
                ? t('truelayer_secure_checkout')
                : selectedMethod === 'pay_by_bank'
                  ? t('stripe_pay_by_bank_secure_checkout')
                  : t('secure_msg')}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.authorizedBy}>{t('authorized_by')}</Text>
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            (processing || !canConfirm) && styles.confirmBtnDisabled,
          ]}
          onPress={handleConfirm}
          disabled={processing || !canConfirm}
          activeOpacity={0.85}
        >
          {processing ? (
            <ActivityIndicator color={colors.black} size="small" />
          ) : (
            <>
              <Ionicons name="flash" size={18} color={colors.black} />
              <Text style={styles.confirmBtnText}>
                {selectedIntent === 'PAY_LATER'
                  ? `${t('checkout_intent_pay_later')} · €${amount.toFixed(2)}`
                  : payCash
                    ? `${t('checkout_cash_confirm')} · €${amount.toFixed(2)}`
                    : `${selectedMethod === 'bank'
                      ? t('pay_with_truelayer')
                      : selectedMethod === 'pay_by_bank'
                        ? t('pay_with_stripe_pay_by_bank')
                        : t('confirm_payment')} · €${amount.toFixed(2)}`}
              </Text>
            </>
          )}
        </TouchableOpacity>
        {processing ? <Text style={styles.processingText}>{t('processing_payment')}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  secureIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.success}15`,
    borderRadius: radius.full,
    padding: 6,
  },
  amountCard: {
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xxl,
    backgroundColor: colors.onSurface,
    alignItems: 'center',
  },
  amountLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  amountValue: { fontSize: 40, fontWeight: '800', color: colors.white, letterSpacing: -1 },
  amountMerchant: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  amountSummary: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  basketSummaryCard: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    gap: spacing.xs,
  },
  basketSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  basketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  basketRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  basketRowImage: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  basketRowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  basketRowName: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  basketRowPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.sm },
  sectionSubtitle: { fontSize: 13, color: colors.gray600, marginBottom: spacing.sm },
  intentGrid: { gap: spacing.sm },
  intentCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  intentCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  intentTitle: { marginTop: spacing.xs, fontSize: 15, fontWeight: '700', color: colors.onSurface },
  intentBody: { marginTop: 4, fontSize: 13, color: colors.gray600 },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    marginBottom: 8,
    gap: spacing.sm,
  },
  methodRowSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}08`,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodIconSelected: {
    backgroundColor: `${colors.primary}15`,
  },
  methodInfo: { flex: 1 },
  methodLabel: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  methodLabelSelected: { color: colors.primary },
  methodSub: { fontSize: 12, color: colors.gray600, marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.gray300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  securityNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    backgroundColor: `${colors.success}08`,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: `${colors.success}20`,
  },
  securityTextBox: { flex: 1 },
  securityTitle: { fontSize: 13, fontWeight: '600', color: colors.onSurface, marginBottom: 2 },
  securityDesc: { fontSize: 12, color: colors.gray600, lineHeight: 16 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: `${colors.error}30`,
    backgroundColor: `${colors.error}10`,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: `${colors.primary}10`,
  },
  infoText: { flex: 1, fontSize: 13, color: colors.onSurface, lineHeight: 18 },
  bottomBar: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  authorizedBy: {
    fontSize: 11,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  confirmBtnDisabled: { opacity: 0.7 },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: colors.black },
  processingText: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.gray600,
    textAlign: 'center',
  },
});
