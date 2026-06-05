import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav } from '../types';
import { bookMerchantAppointment } from '../features/appointments/services/appointmentService';
import { fetchBranchProducts } from '../lib/merchantProducts';
import type { Product } from '../types';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function buildISODateTime(date: string, time: string): string {
  // date: YYYY-MM-DD, time: HH:MM
  return new Date(`${date}T${time}:00`).toISOString();
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function currentTimeString(): string {
  const d = new Date();
  const minutes = Math.ceil(d.getMinutes() / 15) * 15;
  const h = d.getHours() + Math.floor(minutes / 60);
  return `${pad2(h % 24)}:${pad2(minutes % 60)}`;
}

export default function NewAppointmentScreen() {
  const { t } = useLanguage();
  const { activeBranchScope } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const merchantId = activeBranchScope?.merchantId ?? null;
  const branchId = activeBranchScope?.branchId ?? null;

  // Form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(todayString());
  const [time, setTime] = useState(currentTimeString());
  const [note, setNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const { data: products, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: merchantId && branchId ? ['products', merchantId, branchId] : ['products', 'missing'],
    queryFn: () => fetchBranchProducts(merchantId!, branchId!),
    enabled: !!merchantId && !!branchId,
    staleTime: 5 * 60_000,
  });

  const activeProducts = (products ?? []).filter((p) => p.active);

  function validate(): string | null {
    if (!contactName.trim()) return t('appointment_validation_failed');
    if (!selectedProduct) return t('appointment_validation_failed');
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) return t('appointment_validation_failed');
    if (!time.match(/^\d{2}:\d{2}$/)) return t('appointment_validation_failed');
    if (!branchId || !merchantId) return t('merchant_branch_access_missing');
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await bookMerchantAppointment(merchantId!, {
        branchId: branchId!,
        productId: selectedProduct!.id,
        productCategoryId: selectedProduct!.categoryId ?? '',
        startTime: buildISODateTime(date, time),
        employeeId: employeeId.trim() || null,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        note: note.trim() || null,
      });

      // Invalidate merchant appointments cache
      void queryClient.invalidateQueries({
        queryKey: ['appointments', 'merchant', merchantId],
      });

      navigation.goBack();
    } catch (e) {
      const key =
        e instanceof Error
          ? e.message
          : 'appointment_book_failed';
      setSubmitError(
        t(key as Parameters<typeof t>[0]) ?? t('appointment_book_failed'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.safeTop, { paddingTop: insets.top }]} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('new_appointment_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.form,
          { paddingBottom: insets.bottom + 80 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {submitError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
            <Text style={styles.errorBannerText}>{submitError}</Text>
          </View>
        ) : null}

        {/* Contact name */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('new_appointment_contact_name')}</Text>
          <TextInput
            style={styles.input}
            value={contactName}
            onChangeText={setContactName}
            placeholder="Jane Doe"
            placeholderTextColor={colors.gray400}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {/* Contact phone */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('new_appointment_contact_phone')}</Text>
          <TextInput
            style={styles.input}
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="+49 123 456789"
            placeholderTextColor={colors.gray400}
            keyboardType="phone-pad"
            returnKeyType="next"
          />
        </View>

        {/* Contact email */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('new_appointment_contact_email')}</Text>
          <TextInput
            style={styles.input}
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="jane@example.com"
            placeholderTextColor={colors.gray400}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>

        {/* Service / Product */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('new_appointment_product')}</Text>
          {productsLoading ? (
            <View style={styles.inputRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.inputRowText}>{t('new_appointment_products_loading')}</Text>
            </View>
          ) : productsError ? (
            <Text style={styles.fieldError}>{t('new_appointment_products_failed')}</Text>
          ) : (
            <TouchableOpacity
              style={[styles.selector, !selectedProduct && styles.selectorEmpty]}
              onPress={() => setShowProductPicker(true)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectorText,
                  !selectedProduct && styles.selectorPlaceholder,
                ]}
                numberOfLines={1}
              >
                {selectedProduct?.name ?? t('new_appointment_select_product')}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.gray500} />
            </TouchableOpacity>
          )}
        </View>

        {/* Employee ID (optional free text) */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('new_appointment_employee')}</Text>
          <TextInput
            style={styles.input}
            value={employeeId}
            onChangeText={setEmployeeId}
            placeholder={t('new_appointment_select_employee')}
            placeholderTextColor={colors.gray400}
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>

        {/* Date */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('new_appointment_date')}</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.gray400}
            keyboardType="numbers-and-punctuation"
            returnKeyType="next"
          />
        </View>

        {/* Time */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('new_appointment_time')}</Text>
          <TextInput
            style={styles.input}
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM"
            placeholderTextColor={colors.gray400}
            keyboardType="numbers-and-punctuation"
            returnKeyType="next"
          />
        </View>

        {/* Note */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('new_appointment_note')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={note}
            onChangeText={setNote}
            placeholder="Additional notes…"
            placeholderTextColor={colors.gray400}
            multiline
            numberOfLines={3}
            returnKeyType="done"
          />
        </View>
      </ScrollView>

      {/* Submit button */}
      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={() => void handleSubmit()}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.black} />
          ) : (
            <Ionicons name="calendar-outline" size={18} color={colors.black} />
          )}
          <Text style={styles.submitBtnText}>
            {submitting ? t('new_appointment_submitting') : t('new_appointment_submit')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Product picker modal */}
      {showProductPicker ? (
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{t('new_appointment_product')}</Text>
              <TouchableOpacity
                onPress={() => setShowProductPicker(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {activeProducts.length === 0 ? (
                <Text style={styles.pickerEmpty}>{t('new_appointment_products_failed')}</Text>
              ) : (
                activeProducts.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={[
                      styles.pickerRow,
                      selectedProduct?.id === product.id && styles.pickerRowSelected,
                    ]}
                    onPress={() => {
                      setSelectedProduct(product);
                      setShowProductPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pickerRowBody}>
                      <Text style={styles.pickerRowName}>{product.name}</Text>
                      {product.categoryName ? (
                        <Text style={styles.pickerRowCategory}>{product.categoryName}</Text>
                      ) : null}
                    </View>
                    {selectedProduct?.id === product.id ? (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  safeTop: { backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  form: { padding: spacing.md, gap: spacing.sm },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: `${colors.error}10`,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: colors.onSurface },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.gray700 },
  fieldError: { fontSize: 13, color: colors.error },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.onSurface,
    ...shadow.sm,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  inputRowText: { fontSize: 14, color: colors.gray600 },
  selector: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadow.sm,
  },
  selectorEmpty: { borderColor: colors.gray200 },
  selectorText: { flex: 1, fontSize: 15, color: colors.onSurface },
  selectorPlaceholder: { color: colors.gray400 },
  footer: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: colors.black },
  // Product picker overlay
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  pickerSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    maxHeight: '75%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  pickerEmpty: { fontSize: 14, color: colors.gray500, textAlign: 'center', paddingVertical: spacing.xl },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  pickerRowSelected: { backgroundColor: `${colors.primary}08` },
  pickerRowBody: { flex: 1 },
  pickerRowName: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  pickerRowCategory: { fontSize: 12, color: colors.gray500, marginTop: 2 },
});
