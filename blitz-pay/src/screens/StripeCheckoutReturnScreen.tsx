import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { paymentResultTracker } from '../lib/payments/paymentResultTracker';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';
import { fetchOrder } from '../features/order-payment/services/orderPaymentService';
import { orderPaymentStore } from '../features/order-payment/store/orderPaymentStore';
import { isOrderStatusTerminal, mapOrderStatusToPaymentResult } from '../features/order-payment/types/orderPayment';

export default function StripeCheckoutReturnScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'StripeCheckoutReturn'>>();

  useEffect(() => {
    let active = true;

    void (async () => {
      const { orderId, status } = route.params;
      const session = orderPaymentStore.getSession(orderId);
      const order = await fetchOrder(orderId).catch(() => null);
      if (!active) return;

      const paymentRequestId = order?.lastPaymentRequestId ?? session?.paymentRequestId ?? orderId;
      const amount = order ? order.totalAmountMinor / 100 : session?.amount;
      const currency = order?.currency ?? session?.currency;
      const merchantName = order?.merchantName ?? session?.merchantName;
      const branchName = order?.branchName ?? session?.branchName;
      const merchantLogoUrl = order?.merchantLogoUrl;

      if (status === 'cancelled') {
        navigation.replace('PaymentResult', {
          paymentRequestId,
          orderId,
          status: 'cancelled',
          amount,
          currency,
          merchantName,
          branchName,
          merchantLogoUrl,
          paymentProvider: order?.lastPaymentProvider ?? 'STRIPE',
          paymentSource: order?.paymentSource,
        });
        return;
      }

      if (order && !isOrderStatusTerminal(order.status)) {
        if (!paymentResultTracker.isTracking(paymentRequestId)) {
          void paymentResultTracker.start(paymentRequestId);
        }
        navigation.replace('PaymentProcessing', {
          paymentRequestId,
          orderId,
          amount,
          currency,
          merchantName,
          branchName,
          merchantLogoUrl,
        });
        return;
      }

      if (order) {
        const resultStatus = mapOrderStatusToPaymentResult(order.status);
        navigation.replace('PaymentResult', {
          paymentRequestId,
          orderId,
          status: resultStatus === 'processing' || resultStatus === 'pending' ? 'succeeded' : resultStatus,
          amount,
          currency,
          merchantName,
          branchName,
          merchantLogoUrl,
          paymentProvider: order.lastPaymentProvider,
          paymentSource: order.paymentSource,
        });
        return;
      }

      navigation.replace('PaymentResult', {
        paymentRequestId,
        orderId,
        status: 'failed',
        amount,
        currency,
        merchantName,
        branchName,
        merchantLogoUrl,
        paymentProvider: 'STRIPE',
        reason: 'stripe_pay_by_bank_return_failed',
      });
    })();

    return () => {
      active = false;
    };
  }, [navigation, route.params]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.title}>{t('payment_processing_title')}</Text>
        <Text style={styles.body}>{t('stripe_pay_by_bank_returning')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.onSurface, marginTop: spacing.md },
  body: { fontSize: 14, color: colors.gray700, textAlign: 'center' },
});
