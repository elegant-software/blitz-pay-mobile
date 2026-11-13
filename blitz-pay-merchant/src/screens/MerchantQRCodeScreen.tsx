import { useTheme } from "../lib/ThemeContext";
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Share, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { spacing, radius, shadow, type ThemeColors } from '../lib/theme';
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
  const { width } = useWindowDimensions();
  const qrSize = Math.max(120, Math.min(220, width - 2 * (spacing.md + spacing.xl + spacing.md)));
  const { colors } = useTheme();
  const styles = createStyles(colors);

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
    await Share.share({ message: qrValue, title: t('merchant_qr') });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('back')} onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('merchant_qr')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        {/* QR code */}
        <View style={[styles.qrCard, shadow.lg]}>
          <View style={styles.qrFrame}>
            <QRCode value={qrValue} size={qrSize} color={colors.black} backgroundColor={colors.white} />
          </View>
          <Text style={styles.merchantName}>{activeBranchScope?.branchName ?? activeBranchScope?.merchantName ?? user?.name ?? t('account_merchant')}</Text>
          {activeBranchScope?.branchName && activeBranchScope.merchantName ? <Text style={styles.amountHint}>{activeBranchScope.merchantName}</Text> : null}
          {amount ? (
            <Text style={styles.amountHint}>
              {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)}
            </Text>
          ) : (
            <Text style={styles.amountHint}>{t('qr_any_amount')}</Text>
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
            placeholder={t('qr_label_placeholder')}
            placeholderTextColor={colors.gray400}
          />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.copyBtn]} onPress={handleCopy} activeOpacity={0.85}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={colors.primary} />
            <Text style={styles.copyBtnText} numberOfLines={1}>{t(copied ? 'qr_copied' : 'copy_link')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={handleShare} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={18} color={colors.black} />
            <Text style={styles.shareBtnText}>{t('qr_share')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  qrFrame: { backgroundColor: colors.white, padding: spacing.md, borderRadius: radius.lg },
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  scroll: { padding: spacing.md, alignItems: 'center' },
  qrCard: {
    backgroundColor: colors.cardBg, borderRadius: radius.xxl,
    padding: spacing.xl, alignItems: 'center', gap: spacing.sm,
    width: '100%', marginBottom: spacing.md,
  },
  merchantName: { fontSize: 17, fontWeight: '700', color: colors.onSurface, marginTop: spacing.sm },
  amountHint: { fontSize: 14, color: colors.gray500 },
  fieldsCard: {
    backgroundColor: colors.cardBg, borderRadius: radius.xl,
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
  copyBtnText: { fontSize: 13, fontWeight: '600', color: colors.secondary, flexShrink: 1 },
  shareBtn: { backgroundColor: colors.primary },
  shareBtnText: { fontSize: 13, fontWeight: '700', color: colors.black, flexShrink: 1 },
});
