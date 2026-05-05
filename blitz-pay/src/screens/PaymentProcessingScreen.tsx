import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { usePaymentResult } from '../hooks/usePaymentResult';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';

export default function PaymentProcessingScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'PaymentProcessing'>>();
  const { paymentRequestId, orderId, amount, currency, merchantName, branchName, merchantLogoUrl, invoiceId } = route.params;

  const state = usePaymentResult(paymentRequestId, orderId);

  useEffect(() => {
    if (state.status === 'processing') return;

    if (state.status === 'timeout') {
      navigation.replace('PaymentPending', {
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

    navigation.replace('PaymentResult', {
      paymentRequestId,
      orderId: state.result.orderId ?? orderId,
      status: state.status,
      amount: state.result.amount ?? amount,
      currency: state.result.currency ?? currency,
      merchantName,
      branchName,
      merchantLogoUrl,
      paymentProvider: state.result.provider ?? undefined,
      reason: state.result.reason ?? undefined,
    });
  }, [state, navigation, paymentRequestId, orderId, amount, currency, merchantName, branchName, merchantLogoUrl, invoiceId]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.title}>{t('payment_processing_title')}</Text>
        <Text style={styles.body}>{t('payment_processing_body')}</Text>
        {merchantName ? (
          <Text style={styles.meta}>
            {merchantName}
            {typeof amount === 'number' ? ` · ${currency ?? '€'}${amount.toFixed(2)}` : ''}
          </Text>
        ) : null}
        {orderId ? <Text style={styles.meta}>{t('order_reference_label', { orderId })}</Text> : null}
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
  meta: { fontSize: 12, color: colors.gray600, marginTop: spacing.sm },
});
