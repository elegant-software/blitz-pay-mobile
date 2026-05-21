import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { PaymentRecord } from '../types';

const METHOD_ICONS: Record<PaymentRecord['method'], React.ComponentProps<typeof Ionicons>['name']> = {
  bank_transfer: 'git-merge-outline',
  card: 'card-outline',
  paypal: 'logo-paypal',
  qr: 'qr-code-outline',
};

const STATUS_COLORS: Record<PaymentRecord['status'], string> = {
  succeeded: colors.success,
  pending: colors.warning,
  failed: colors.error,
  refunded: colors.gray500,
};

const MOCK_PAYMENTS: PaymentRecord[] = [
  { id: 'p1', orderId: '2', amount: 245.0, currency: 'EUR', method: 'bank_transfer', status: 'succeeded', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'p2', orderId: '4', amount: 312.0, currency: 'EUR', method: 'card', status: 'succeeded', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'p3', amount: 45.0, currency: 'EUR', method: 'qr', status: 'succeeded', createdAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'p4', orderId: '5', amount: 78.0, currency: 'EUR', method: 'card', status: 'refunded', createdAt: new Date(Date.now() - 259200000).toISOString() },
];

function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PaymentsHistoryScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const total = MOCK_PAYMENTS.filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('payments_history')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Summary */}
      <View style={styles.summaryBanner}>
        <Text style={styles.summaryLabel}>Total received</Text>
        <Text style={styles.summaryAmount}>{formatCurrency(total)}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.xl, paddingTop: spacing.sm }} showsVerticalScrollIndicator={false}>
        {MOCK_PAYMENTS.map((payment) => (
          <View key={payment.id} style={[styles.paymentCard, shadow.sm]}>
            <View style={[styles.methodIcon, { backgroundColor: `${STATUS_COLORS[payment.status]}15` }]}>
              <Ionicons name={METHOD_ICONS[payment.method]} size={20} color={STATUS_COLORS[payment.status]} />
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentOrderId}>{payment.orderId ? `Order #${payment.orderId}` : payment.id.toUpperCase()}</Text>
              <Text style={styles.paymentDate}>{formatDate(payment.createdAt)}</Text>
              <Text style={styles.paymentMethod}>via {payment.method.replace('_', ' ')}</Text>
            </View>
            <View style={styles.paymentRight}>
              <Text style={[styles.paymentAmount, payment.status === 'refunded' && styles.refunded]}>
                {payment.status === 'refunded' ? '-' : '+'}{formatCurrency(payment.amount, payment.currency)}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[payment.status]}15` }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[payment.status] }]}>
                  {payment.status}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
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
  summaryBanner: {
    backgroundColor: colors.onSurface, paddingHorizontal: spacing.md, paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 13, color: colors.gray500 },
  summaryAmount: { fontSize: 32, fontWeight: '800', color: colors.white, letterSpacing: -1 },
  paymentCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.md, marginBottom: spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  methodIcon: { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  paymentInfo: { flex: 1 },
  paymentOrderId: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  paymentDate: { fontSize: 12, color: colors.gray500, marginTop: 1 },
  paymentMethod: { fontSize: 11, color: colors.gray400, marginTop: 1, textTransform: 'capitalize' },
  paymentRight: { alignItems: 'flex-end', gap: 4 },
  paymentAmount: { fontSize: 15, fontWeight: '700', color: colors.success },
  refunded: { color: colors.gray500 },
  statusPill: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
});
