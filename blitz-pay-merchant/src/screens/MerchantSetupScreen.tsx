import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius } from '../lib/theme';
export default function MerchantSetupScreen() {
  const {retryBranchScope, logout} = useAuth();
  const {t} = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  return <View style={styles.page}>
    <Text style={styles.title}>{t('registration_branch_setup_title')}</Text>
    <Text style={styles.body}>{t('registration_branch_setup_body')}</Text>
    {failed ? <Text accessibilityRole="alert" style={styles.body}>{t('network_error')}</Text> : null}
    <TouchableOpacity style={styles.button} disabled={refreshing} onPress={async () => {
      setRefreshing(true); setFailed(false);
      try { await retryBranchScope(); } catch { setFailed(true); } finally { setRefreshing(false); }
    }}>{refreshing ? <ActivityIndicator color={colors.black}/> : <Text>{t('registration_refresh_access')}</Text>}</TouchableOpacity>
    <TouchableOpacity onPress={() => void logout()}><Text style={styles.body}>{t('logout')}</Text></TouchableOpacity>
  </View>;
}
const styles = StyleSheet.create({
  page: {flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background},
  title: {fontSize: 24, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.md},
  body: {fontSize: 16, lineHeight: 24, color: colors.gray600, marginBottom: spacing.lg},
  button: {alignItems: 'center', padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, marginBottom: spacing.lg},
});
