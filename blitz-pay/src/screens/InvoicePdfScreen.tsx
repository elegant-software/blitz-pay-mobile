import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { colors, spacing } from '../lib/theme';
import type { RootStackParamList } from '../types';

type RouteProps = RouteProp<RootStackParamList, 'InvoicePdf'>;

function pdfUri(url: string): string {
  if (Platform.OS === 'ios') return url;
  return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
}

export default function InvoicePdfScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { url, title } = route.params;
  const [loading, setLoading] = useState(true);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title ?? 'Invoice'}</Text>
        <View style={styles.headerButton} />
      </View>
      <WebView
        source={{ uri: pdfUri(url) }}
        style={styles.webview}
        onLoadEnd={() => setLoading(false)}
      />
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : null}
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
  headerButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  webview: { flex: 1 },
  loader: { position: 'absolute', top: '50%', alignSelf: 'center' },
});
