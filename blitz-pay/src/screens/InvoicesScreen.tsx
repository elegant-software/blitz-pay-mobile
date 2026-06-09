import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav } from '../types';

const INVOICES = [
  {
    id: 'INV-2026-001',
    invoiceNumber: 'INV-2026-001',
    from: 'Berlin Energy GmbH',
    amount: 142.5,
    dueDate: '2026-04-02',
    items: [
      { desc: 'Electricity (March 2026)', amount: 112.5 },
      { desc: 'Service fee', amount: 30.0 },
    ],
  },
  {
    id: 'INV-2026-002',
    invoiceNumber: 'INV-2026-002',
    from: 'Cloud Systems EU',
    amount: 89.0,
    dueDate: '2026-04-10',
    items: [
      { desc: 'Hosting (April 2026)', amount: 79.0 },
      { desc: 'Support', amount: 10.0 },
    ],
  },
];

export default function InvoicesScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const [selectedInvoice, setSelectedInvoice] = useState<typeof INVOICES[0] | null>(null);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('invoices')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Summary banner */}
      <View style={styles.banner}>
        <Ionicons name="document-text-outline" size={20} color={colors.primary} />
        <Text style={styles.bannerText}>
          {t('invoices_awaiting', { count: INVOICES.length })}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t('pending_invoices')}</Text>

        {INVOICES.map((invoice) => (
          <TouchableOpacity
            key={invoice.id}
            style={styles.invoiceCard}
            onPress={() => setSelectedInvoice(invoice)}
            activeOpacity={0.85}
          >
            <View style={styles.invoiceLeft}>
              <View style={styles.invoiceIcon}>
                <Ionicons name="business-outline" size={20} color={colors.secondary} />
              </View>
              <View style={styles.invoiceInfo}>
                <Text style={styles.invoiceFrom}>{invoice.from}</Text>
                <Text style={styles.invoiceId}>{t('invoice_no')} {invoice.invoiceNumber}</Text>
                <View style={styles.dueDateRow}>
                  <Ionicons name="calendar-outline" size={12} color={colors.warning} />
                  <Text style={styles.dueDate}>{t('due')} {invoice.dueDate}</Text>
                </View>
              </View>
            </View>
            <View style={styles.invoiceRight}>
              <Text style={styles.invoiceAmount}>€{invoice.amount.toFixed(2)}</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>{t('pending')}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Invoice detail modal */}
      <Modal visible={!!selectedInvoice} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 24 }]}>
            {selectedInvoice && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('invoice_detail')}</Text>
                  <TouchableOpacity onPress={() => setSelectedInvoice(null)} hitSlop={12}>
                    <Ionicons name="close" size={22} color={colors.onSurface} />
                  </TouchableOpacity>
                </View>

                <View style={styles.invoiceMetaGrid}>
                  <View style={styles.invoiceMetaItem}>
                    <Text style={styles.invoiceMetaLabel}>{t('invoice_no')}</Text>
                    <Text style={styles.invoiceMetaValue}>{selectedInvoice.invoiceNumber}</Text>
                  </View>
                  <View style={styles.invoiceMetaItem}>
                    <Text style={styles.invoiceMetaLabel}>{t('due_date')}</Text>
                    <Text style={styles.invoiceMetaValue}>{selectedInvoice.dueDate}</Text>
                  </View>
                </View>

                <Text style={styles.lineItemsTitle}>{t('line_items')}</Text>
                {selectedInvoice.items.map((item, idx) => (
                  <View key={idx} style={styles.lineItem}>
                    <Text style={styles.lineItemDesc}>{item.desc}</Text>
                    <Text style={styles.lineItemAmount}>€{item.amount.toFixed(2)}</Text>
                  </View>
                ))}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{t('total_amount_due')}</Text>
                  <Text style={styles.totalAmount}>€{selectedInvoice.amount.toFixed(2)}</Text>
                </View>

                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={() => {
                    setSelectedInvoice(null);
                    navigation.navigate('Checkout', {
                      amount: selectedInvoice.amount,
                      merchantName: selectedInvoice.from,
                      invoiceId: selectedInvoice.id,
                    });
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="flash" size={18} color={colors.black} />
                  <Text style={styles.payBtnText}>{t('pay_with_truelayer')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: `${colors.primary}10`,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: `${colors.primary}25`,
  },
  bannerText: { fontSize: 14, color: colors.onSurface, fontWeight: '500', flex: 1 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  invoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray200,
    ...shadow.sm,
  },
  invoiceLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  invoiceIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: `${colors.secondary}10`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  invoiceInfo: { flex: 1 },
  invoiceFrom: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  invoiceId: { fontSize: 11, color: colors.gray500, marginTop: 1 },
  dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  dueDate: { fontSize: 11, color: colors.warning, fontWeight: '500' },
  invoiceRight: { alignItems: 'flex-end', gap: 4 },
  invoiceAmount: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  pendingBadge: {
    backgroundColor: `${colors.warning}15`,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pendingText: { fontSize: 10, fontWeight: '700', color: colors.warning },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  invoiceMetaGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  invoiceMetaItem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  invoiceMetaLabel: { fontSize: 11, color: colors.gray600, marginBottom: 2 },
  invoiceMetaValue: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
  lineItemsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray600,
    marginBottom: spacing.sm,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  lineItemDesc: { fontSize: 14, color: colors.onSurface, flex: 1 },
  lineItemAmount: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  totalAmount: { fontSize: 20, fontWeight: '800', color: colors.onSurface },
  payBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  payBtnText: { fontSize: 16, fontWeight: '700', color: colors.black },
});
