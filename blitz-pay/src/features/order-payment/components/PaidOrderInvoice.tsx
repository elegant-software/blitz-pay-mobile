import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLanguage } from '../../../lib/LanguageContext';
import { colors } from '../../../lib/theme';
import { useOrderInvoice } from '../hooks/useOrderInvoice';

export function PaidOrderInvoice(props: { orderId: string; paid: boolean }) {
  const { t } = useLanguage();
  const { url, loading, error, retry, download } = useOrderInvoice(props.orderId, props.paid);
  if (!props.paid) return null;
  return (
    <View style={{ marginVertical: 16, alignItems: 'center', gap: 12 }}>
      <Text style={{ color: colors.onSurface, fontWeight: '700', fontSize: 17 }}>{t('invoice_download_title')}</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error !== null ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{error || t('invoice_download_failed')}</Text> : null}
      {!loading && !url && error === null ? <Text style={{ color: colors.onSurface }}>{t('invoice_download_pending')}</Text> : null}
      {url ? <>
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
