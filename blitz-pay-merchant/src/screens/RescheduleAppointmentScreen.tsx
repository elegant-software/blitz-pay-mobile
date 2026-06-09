import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackParamList, RootStackNav } from '../types';
import { rescheduleAppointment } from '../features/appointments/services/appointmentService';
import { fetchEmployees, type EmployeeResponse } from '../features/appointments/services/employeeService';
import { fetchBranchProducts } from '../lib/merchantProducts';
import type { Product } from '../types';

type RouteProps = RouteProp<RootStackParamList, 'RescheduleAppointment'>;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toDateString(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeString(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function buildISODateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export default function RescheduleAppointmentScreen() {
  const { t } = useLanguage();
  const { activeBranchScope } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const {
    appointmentId,
    merchantId,
    currentProductId,
    currentProductCategoryId,
    currentStartTime,
    currentEmployeeId,
  } = route.params;

  const branchId = activeBranchScope?.branchId ?? null;

  // Pre-fill from existing values
  const [date, setDate] = useState(toDateString(currentStartTime));
  const [time, setTime] = useState(toTimeString(currentStartTime));
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeResponse | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey:
      merchantId && branchId ? ['products', merchantId, branchId] : ['products', 'missing'],
    queryFn: () => fetchBranchProducts(merchantId, branchId!),
    enabled: !!merchantId && !!branchId,
    staleTime: 5 * 60_000,
  });

  const { data: allEmployees } = useQuery({
    queryKey: ['employees', merchantId],
    queryFn: () => fetchEmployees(merchantId),
    enabled: !!merchantId,
    staleTime: 60_000,
  });

  const activeEmployees = (allEmployees ?? []).filter((e) => e.active);

  // Pre-select the employee once the list loads
  React.useEffect(() => {
    if (!selectedEmployee && currentEmployeeId && activeEmployees.length > 0) {
      const found = activeEmployees.find((e) => e.id === currentEmployeeId);
      if (found) setSelectedEmployee(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEmployees.length]);

  const activeProducts = (products ?? []).filter((p) => p.active);

  // Once products load, set the initial selection to the current product
  React.useEffect(() => {
    if (!selectedProduct && activeProducts.length > 0) {
      const existing = activeProducts.find((p) => p.id === currentProductId);
      if (existing) setSelectedProduct(existing);
    }
  }, [activeProducts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function validate(): string | null {
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) return t('appointment_validation_failed');
    if (!time.match(/^\d{2}:\d{2}$/)) return t('appointment_validation_failed');
    if (!selectedProduct) return t('appointment_validation_failed');
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
      await rescheduleAppointment(merchantId, appointmentId, {
        newProductId: selectedProduct!.id,
        newProductCategoryId: selectedProduct!.categoryId ?? currentProductCategoryId,
        newStartTime: buildISODateTime(date, time),
        newEmployeeId: selectedEmployee?.id ?? null,
      });

      void queryClient.invalidateQueries({
        queryKey: ['appointment-detail', merchantId, appointmentId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['appointments', 'merchant', merchantId],
      });

      // Pop back to the detail screen
      navigation.goBack();
    } catch (e) {
      const key =
        e instanceof Error ? e.message : 'appointment_reschedule_failed';
      setSubmitError(
        t(key as Parameters<typeof t>[0]) ?? t('appointment_reschedule_failed'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
    >
      <View style={[styles.safeTop, { paddingTop: insets.top }]} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('reschedule_appointment_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 80 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {submitError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
            <Text style={styles.errorBannerText}>{submitError}</Text>
          </View>
        ) : null}

        {/* Service */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('reschedule_appointment_new_product')}</Text>
          {productsLoading ? (
            <View style={styles.inputRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.inputRowText}>{t('new_appointment_products_loading')}</Text>
            </View>
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
                {selectedProduct
                  ? selectedProduct.productCode != null
                    ? `${selectedProduct.name} · #${selectedProduct.productCode}`
                    : selectedProduct.name
                  : t('new_appointment_select_product')}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.gray500} />
            </TouchableOpacity>
          )}
        </View>

        {/* New date */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('reschedule_appointment_new_date')}</Text>
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

        {/* New time */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('reschedule_appointment_new_time')}</Text>
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

        {/* Employee */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('reschedule_appointment_new_employee')}</Text>
          <TouchableOpacity
            style={[styles.selector, !selectedEmployee && styles.selectorEmpty]}
            onPress={() => setShowEmployeePicker(true)}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.selectorText, !selectedEmployee && styles.selectorPlaceholder]}
              numberOfLines={1}
            >
              {selectedEmployee?.name ?? t('new_appointment_any_employee')}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.gray500} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Submit button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
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
            {submitting
              ? t('reschedule_appointment_submitting')
              : t('reschedule_appointment_submit')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Employee picker */}
      {showEmployeePicker ? (
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{t('reschedule_appointment_new_employee')}</Text>
              <TouchableOpacity onPress={() => setShowEmployeePicker(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.pickerRow, !selectedEmployee && styles.pickerRowSelected]}
                onPress={() => { setSelectedEmployee(null); setShowEmployeePicker(false); }}
                activeOpacity={0.7}
              >
                <View style={styles.pickerRowBody}>
                  <Text style={styles.pickerRowName}>{t('new_appointment_any_employee')}</Text>
                </View>
                {!selectedEmployee ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </TouchableOpacity>
              {activeEmployees.map((emp) => (
                <TouchableOpacity
                  key={emp.id}
                  style={[styles.pickerRow, selectedEmployee?.id === emp.id && styles.pickerRowSelected]}
                  onPress={() => { setSelectedEmployee(emp); setShowEmployeePicker(false); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.pickerRowBody}>
                    <Text style={styles.pickerRowName}>{emp.name}</Text>
                  </View>
                  {selectedEmployee?.id === emp.id ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}

      {/* Product picker */}
      {showProductPicker ? (
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{t('reschedule_appointment_new_product')}</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {activeProducts.map((product) => (
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
                    <Text style={styles.pickerRowName}>
                      {product.name}{product.productCode != null ? ` · #${product.productCode}` : ''}
                    </Text>
                    {product.categoryName ? (
                      <Text style={styles.pickerRowCategory}>{product.categoryName}</Text>
                    ) : null}
                  </View>
                  {selectedProduct?.id === product.id ? (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  ) : null}
                </TouchableOpacity>
              ))}
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
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
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
