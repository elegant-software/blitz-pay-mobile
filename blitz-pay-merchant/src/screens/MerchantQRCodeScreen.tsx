import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackParamList } from '../types';

type RouteProps = RouteProp<RootStackParamList, 'MerchantQRCode'>;

function buildPaymentUrl(merchantId: string, amount?: number, label?: string) {
  const base = `blitzpay://pay/${merchantId}`;
  const params = new URLSearchParams();
  if (amount) params.set('amount', String(amount));
  if (label) params.set('label', label);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export default function MerchantQRCodeScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { user, activeBranchScope } = useAuth();

  const [amountStr, setAmountStr] = useState(route.params?.amount ? String(route.params.amount) : '');
  const [label, setLabel] = useState(route.params?.label ?? '');
  const [copied, setCopied] = useState(false);

  const amount = Number(amountStr) || undefined;
  const qrValue = buildPaymentUrl(user?.username ?? 'merchant', amount, label || undefined);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(qrValue);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    await Share.share({ message: qrValue, title: 'BlitzPay Payment Link' });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('merchant_qr')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        {/* QR code */}
        <View style={[styles.qrCard, shadow.lg]}>
          <QRCode value={qrValue} size={220} color={colors.onSurface} backgroundColor={colors.white} />
          <Text style={styles.merchantName}>{activeBranchScope?.merchantName ?? user?.name ?? 'Merchant'}</Text>
          {activeBranchScope?.branchName ? <Text style={styles.amountHint}>{activeBranchScope.branchName}</Text> : null}
          {amount ? (
            <Text style={styles.amountHint}>
              {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)}
            </Text>
          ) : (
            <Text style={styles.amountHint}>Any amount</Text>
          )}
        </View>

        {/* Optional fields */}
        <View style={[styles.fieldsCard, shadow.sm]}>
          <Text style={styles.fieldLabel}>{t('qr_amount')}</Text>
          <View style={styles.inputRow}>
            <Text style={styles.currencyPrefix}>€</Text>
            <TextInput
              style={styles.input}
              value={amountStr}
              onChangeText={setAmountStr}
              placeholder="0.00"
              placeholderTextColor={colors.gray400}
              keyboardType="decimal-pad"
            />
          </View>

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>{t('qr_label')}</Text>
          <TextInput
            style={styles.inputFull}
            value={label}
            onChangeText={setLabel}
            placeholder="Table 5, Invoice #42..."
            placeholderTextColor={colors.gray400}
          />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.copyBtn]} onPress={handleCopy} activeOpacity={0.85}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={colors.primary} />
            <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={handleShare} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={18} color={colors.onPrimary} />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
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
  scroll: { padding: spacing.md, alignItems: 'center' },
  qrCard: {
    backgroundColor: colors.white, borderRadius: radius.xxl,
    padding: spacing.xl, alignItems: 'center', gap: spacing.sm,
    width: '100%', marginBottom: spacing.md,
  },
  merchantName: { fontSize: 17, fontWeight: '700', color: colors.onSurface, marginTop: spacing.sm },
  amountHint: { fontSize: 14, color: colors.gray500 },
  fieldsCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.lg, width: '100%', marginBottom: spacing.md,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.gray600, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.gray200, paddingLeft: spacing.md,
  },
  currencyPrefix: { fontSize: 16, color: colors.gray600, marginRight: 4 },
  input: { flex: 1, fontSize: 15, color: colors.onSurface, paddingVertical: spacing.sm, paddingRight: spacing.md },
  inputFull: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.gray200,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: 15, color: colors.onSurface,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, padding: spacing.md, borderRadius: radius.full,
  },
  copyBtn: {
    borderWidth: 1.5, borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  copyBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  shareBtn: { backgroundColor: colors.primary },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: colors.onPrimary },
});