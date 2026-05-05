import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../lib/LanguageContext';
import { resolveFailureReasonKey } from '../lib/payments/failureReasons';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function PaymentResultScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'PaymentResult'>>();
  const insets = useSafeAreaInsets();
  const { status, amount, currency, merchantName, orderId, reason } = route.params;

  // Translate the raw SDK/backend reason into a user-friendly bucket; fall
  // back to the generic body copy if we don't recognise the code.
  const reasonKey = resolveFailureReasonKey(reason);
  const translatedReason = reasonKey ? t(reasonKey) : null;

  const config: Record<
    typeof status,
    { title: string; icon: IconName; color: string; body: string }
  > = {
    succeeded: {
      title: t('payment_result_success_title'),
      icon: 'checkmark-circle',
      color: colors.success,
      body: t('payment_result_success_body'),
    },
    failed: {
      title: t('payment_result_failed_title'),
      icon: 'close-circle',
      color: colors.error,
      body: translatedReason ?? t('payment_result_failed_body'),
    },
    cancelled: {
      title: t('payment_result_cancelled_title'),
      icon: 'alert-circle',
      color: colors.warning,
      body: t('payment_result_cancelled_body'),
    },
  };

  const view = config[status];
  const amountLabel =
    typeof amount === 'number' ? `${currency ?? '€'}${amount.toFixed(2)}` : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.card}>
        <Ionicons name={view.icon} size={72} color={view.color} />
        <Text style={styles.title}>{view.title}</Text>
        {amountLabel ? (
          <Text style={styles.amount}>
            {amountLabel}
            {merchantName ? ` · ${merchantName}` : ''}
          </Text>
        ) : null}
        {orderId ? <Text style={styles.reference}>{t('order_reference_label', { orderId })}</Text> : null}
        <Text style={styles.body}>{view.body}</Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, { marginBottom: insets.bottom + spacing.md }]}
        onPress={() => navigation.navigate('Main')}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryBtnText}>{t('continue')}</Text>
      </TouchableOpacity>
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
  title: { fontSize: 24, fontWeight: '800', color: colors.onSurface, marginTop: spacing.md },
  amount: { fontSize: 16, fontWeight: '600', color: colors.gray700 },
  reference: { fontSize: 13, color: colors.gray600 },
  body: { fontSize: 14, color: colors.gray700, textAlign: 'center', marginTop: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.onSurface,
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
