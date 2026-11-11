import { useTheme } from "../lib/ThemeContext";
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow, type ThemeColors } from '../lib/theme';

interface Notification {
  id: string;
  type: 'new_order' | 'payment_received' | 'low_stock' | 'system';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

const MOCK: Notification[] = [
  { id: '1', type: 'new_order', title: 'New Order', body: 'Order #1042 from Anna Müller — €89.90', createdAt: new Date().toISOString(), read: false },
  { id: '2', type: 'payment_received', title: 'Payment Received', body: '€245.00 from Thomas Weber', createdAt: new Date(Date.now() - 3600000).toISOString(), read: false },
  { id: '3', type: 'low_stock', title: 'Low Stock Alert', body: 'Blueberry Muffin is out of stock', createdAt: new Date(Date.now() - 7200000).toISOString(), read: true },
  { id: '4', type: 'system', title: 'System Update', body: 'BlitzPay Merchant v1.1 is available', createdAt: new Date(Date.now() - 86400000).toISOString(), read: true },
];

const TYPE_ICONS: Record<Notification['type'], React.ComponentProps<typeof Ionicons>['name']> = {
  new_order: 'receipt-outline',
  payment_received: 'checkmark-circle-outline',
  low_stock: 'warning-outline',
  system: 'information-circle-outline',
};

const TYPE_COLORS: Record<Notification['type'], string> = {
  new_order: colors.primary,
  payment_received: colors.success,
  low_stock: colors.warning,
  system: colors.secondary,
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLanguage();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.xl, paddingTop: spacing.sm }} showsVerticalScrollIndicator={false}>
        {MOCK.map((n) => (
          <View key={n.id} style={[styles.card, shadow.sm, !n.read && styles.cardUnread]}>
            <View style={[styles.iconBox, { backgroundColor: `${TYPE_COLORS[n.type]}15` }]}>
              <Ionicons name={TYPE_ICONS[n.type]} size={20} color={TYPE_COLORS[n.type]} />
            </View>
            <View style={styles.info}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{n.title}</Text>
                {!n.read && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.body}>{n.body}</Text>
              <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  card: {
    backgroundColor: colors.cardBg, borderRadius: radius.xl,
    padding: spacing.md, marginBottom: spacing.sm,
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
  },
  cardUnread: {
    borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  iconBox: { width: 40, height: 40, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  title: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  body: { fontSize: 13, color: colors.gray600, lineHeight: 18 },
  time: { fontSize: 11, color: colors.gray400, marginTop: 4 },
});