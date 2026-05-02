import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../lib/LanguageContext';
import { usePaymentResult } from '../hooks/usePaymentResult';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';

export default function PaymentPendingScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'PaymentPending'>>();
  const insets = useSafeAreaInsets();
  const { paymentRequestId, orderId, amount, currency, merchantName, branchName, merchantLogoUrl } = route.params;

  // Keep listening — a late push or recovery signal should still flip us to the
  // real result screen even after timeout.
  const state = usePaymentResult(paymentRequestId, orderId);

  useEffect(() => {
    if (state.status === 'processing' || state.status === 'timeout') return;
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
  }, [state, navigation, paymentRequestId, orderId, amount, currency, merchantName, branchName, merchantLogoUrl]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.card}>
        <Ionicons name="hourglass-outline" size={64} color={colors.warning} />
        <Text style={styles.title}>{t('payment_pending_title')}</Text>
        <Text style={styles.body}>{t('payment_pending_body')}</Text>
        {merchantName ? (
          <Text style={styles.meta}>
            {merchantName}
            {typeof amount === 'number' ? ` · ${currency ?? '€'}${amount.toFixed(2)}` : ''}
          </Text>
        ) : null}
        {orderId ? <Text style={styles.meta}>{t('order_reference_label', { orderId })}</Text> : null}
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Invoices')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{t('payment_pending_invoices_cta')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Main')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>{t('continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.onSurface, marginTop: spacing.md },
  body: {
    fontSize: 14,
    color: colors.gray700,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  meta: { fontSize: 12, color: colors.gray600, marginTop: spacing.md },
  actions: { gap: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.onSurface,
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.onSurface, fontWeight: '700', fontSize: 16 },
});
