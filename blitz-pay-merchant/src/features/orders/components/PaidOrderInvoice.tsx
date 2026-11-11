import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLanguage } from '../../../lib/LanguageContext';
import { useTheme } from '../../../lib/ThemeContext';
import type { ActiveBranchScope } from '../../../lib/auth';
import { useOrderInvoice } from '../hooks/useOrderInvoice';

export function PaidOrderInvoice(props: { orderId: string; paid: boolean; scope: ActiveBranchScope | null }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { url, loading, error, retry, download } = useOrderInvoice(props.orderId, props.paid, props.scope);
  if (!props.paid) return null;
  return (
    <View style={{ marginVertical: 16, alignItems: 'center', gap: 12 }}>
      <Text style={{ color: colors.onSurface, fontWeight: '700', fontSize: 17 }}>{t('invoice_download_title')}</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error !== null ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{error || t('invoice_download_failed')}</Text> : null}
      {!loading && !url && error === null ? <Text style={{ color: colors.onSurface }}>{t('invoice_download_pending')}</Text> : null}
      {url ? <>
        <View style={{ padding: 16, backgroundColor: '#fff' }} accessibilityLabel={t('invoice_download_scan')}>
          <QRCode value={url} size={200} color="#000" backgroundColor="#fff" />
        </View>
        <Text style={{ color: colors.onSurface }}>{t('invoice_download_scan')}</Text>
        <Text style={{ color: colors.onSurface, textAlign: 'center' }}>{t('invoice_download_expiry')}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => void download()} style={{ padding: 12 }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('invoice_download_action')}</Text>
        </TouchableOpacity>
      </> : null}
      <TouchableOpacity accessibilityRole="button" onPress={retry} disabled={loading} style={{ padding: 12 }}>
        <Text style={{ color: colors.primary }}>{t('invoice_download_refresh')}</Text>
      </TouchableOpacity>
    </View>
  );
}
