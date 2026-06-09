import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { colors, spacing, radius, shadow } from '../lib/theme';

export default function MyQRCodeScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [qrValue, setQrValue] = useState('');
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    const generate = () => {
      const ts = Date.now();
      setQrValue(`blitzpay://pay/${user?.username ?? 'user'}?ts=${ts}&nonce=${Math.random().toString(36).slice(2)}`);
      setCountdown(60);
    };
    generate();
    const interval = setInterval(generate, 60_000);
    const countdownTimer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1_000);
    return () => {
      clearInterval(interval);
      clearInterval(countdownTimer);
    };
  }, [user?.id]);

  const handleShare = async () => {
    await Share.share({ message: qrValue });
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(qrValue);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('my_qr')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Mode tabs */}
      <View style={styles.modeTabs}>
        <View style={[styles.modeTab, styles.modeTabActive]}>
          <Ionicons name="qr-code-outline" size={14} color={colors.black} />
          <Text style={styles.modeTabTextActive}>{t('you_scan_me')}</Text>
        </View>
        <View style={styles.modeTab}>
          <Ionicons name="scan-outline" size={14} color={colors.gray600} />
          <Text style={styles.modeTabText}>{t('i_scan_you')}</Text>
        </View>
      </View>

      {/* QR Card */}
      <View style={styles.qrCard}>
        {/* Profile */}
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? 'U'}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{user?.name ?? 'BlitzPay User'}</Text>
            <Text style={styles.profileId}>{t('personal_id')} · {user?.username ?? '—'}</Text>
          </View>
        </View>

        {/* QR Code */}
        <View style={styles.qrWrapper}>
          {qrValue ? (
            <QRCode
              value={qrValue}
              size={200}
              color={colors.onSurface}
              backgroundColor={colors.white}
              logo={undefined}
            />
          ) : null}
        </View>

        {/* Countdown */}
        <View style={styles.countdownRow}>
          <Ionicons name="time-outline" size={13} color={colors.gray500} />
          <Text style={styles.countdownText}>Refreshes in {countdown}s</Text>
        </View>

        {/* Security badge */}
        <View style={styles.securityBadge}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
          <Text style={styles.securityText}>{t('secure')} · {t('dynamic_qr_msg').split('.')[0]}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCopy} activeOpacity={0.8}>
          <Ionicons name="copy-outline" size={20} color={colors.onSurface} />
          <Text style={styles.actionText}>{t('save')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handleShare} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={20} color={colors.black} />
          <Text style={styles.actionTextPrimary}>{t('share')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.disclaimer}>{t('dynamic_qr_msg')}</Text>
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
  modeTabs: {
    flexDirection: 'row',
    margin: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  modeTabActive: { backgroundColor: colors.primary },
  modeTabText: { fontSize: 13, fontWeight: '600', color: colors.gray600 },
  modeTabTextActive: { fontSize: 13, fontWeight: '600', color: colors.black },
  qrCard: {
    margin: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadow.lg,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.black },
  profileName: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  profileId: { fontSize: 11, color: colors.gray500 },
  qrWrapper: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  countdownText: { fontSize: 12, color: colors.gray500 },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.success}10`,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  securityText: { fontSize: 11, color: colors.success, fontWeight: '500', flexShrink: 1 },
  actions: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: radius.full,
    padding: spacing.md,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionText: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  actionTextPrimary: { fontSize: 15, fontWeight: '600', color: colors.black },
  disclaimer: {
    fontSize: 11,
    color: colors.gray500,
    textAlign: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    lineHeight: 16,
  },
});
