import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';
import { bookAppointment, rescheduleAppointment } from '../features/appointments/services/appointmentService';

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(iso),
  );
}

export default function BookingConfirmationScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingConfirmation'>>();
  const insets = useSafeAreaInsets();

  const {
    branchId,
    productId,
    productCategoryId,
    productName,
    merchantName,
    branchName,
    startTime,
    endTime,
    employeeId,
    employeeName,
    rescheduleAppointmentId,
  } = route.params;

  const isRescheduling = Boolean(rescheduleAppointmentId);

  const [contactName, setContactName] = useState(user?.name ?? '');
  const [contactEmail, setContactEmail] = useState(user?.email ?? '');
  const [contactPhone, setContactPhone] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleBook = async () => {
    setFieldError(null);
    if (!isRescheduling && !contactName.trim()) {
      setFieldError(t('contact_name_required'));
      return;
    }

    setSubmitting(true);
    try {
      if (isRescheduling && rescheduleAppointmentId) {
        await rescheduleAppointment(rescheduleAppointmentId, {
          newProductId: productId,
          newProductCategoryId: productCategoryId,
          newStartTime: startTime,
          newEmployeeId: employeeId || undefined,
        });
      } else {
        await bookAppointment({
          branchId,
          productId,
          productCategoryId,
          startTime,
          employeeId: employeeId || undefined,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          note: note.trim() || undefined,
        });
      }

      Alert.alert(
        isRescheduling ? t('reschedule_appointment') : t('appointment_booked_title'),
        isRescheduling ? t('appointment_rescheduled_body') : t('appointment_booked_body'),
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('MyAppointments');
            },
          },
        ],
      );
    } catch {
      setFieldError(isRescheduling ? t('appointment_reschedule_failed') : t('appointment_booking_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isRescheduling ? t('reschedule_appointment') : t('confirm_appointment')}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Appointment summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryIconWrap}>
              <Ionicons name="calendar" size={20} color={colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>{t('appointment_product_label')}</Text>
              <Text style={styles.summaryValue}>{productName}</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryIconWrap}>
              <Ionicons name="time-outline" size={20} color={colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>{t('appointment_date_label')}</Text>
              <Text style={styles.summaryValue}>{formatDateTime(startTime)}</Text>
              <Text style={styles.summarySubvalue}>
                {formatTime(startTime)} – {formatTime(endTime)}
              </Text>
            </View>
          </View>

          {employeeName ? (
            <>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <View style={styles.summaryIconWrap}>
                  <Ionicons name="person-outline" size={20} color={colors.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>{t('appointment_employee_label')}</Text>
                  <Text style={styles.summaryValue}>{employeeName}</Text>
                </View>
              </View>
            </>
          ) : null}

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryIconWrap}>
              <Ionicons name="storefront-outline" size={20} color={colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>{t('blitz_verified')}</Text>
              <Text style={styles.summaryValue}>{branchName}</Text>
              <Text style={styles.summarySubvalue}>{merchantName}</Text>
            </View>
          </View>
        </View>

        {/* Contact form — hidden in reschedule mode (contact details already on the appointment) */}
        {!isRescheduling ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('appointment_contact_label')}</Text>

              <View style={styles.fieldGroup}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('appointment_contact_name')}</Text>
                  <TextInput
                    style={styles.input}
                    value={contactName}
                    onChangeText={setContactName}
                    placeholder={t('appointment_contact_name')}
                    placeholderTextColor={colors.gray400}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                <View style={[styles.field, styles.fieldBorder]}>
                  <Text style={styles.fieldLabel}>{t('appointment_contact_email')}</Text>
                  <TextInput
                    style={styles.input}
                    value={contactEmail}
                    onChangeText={setContactEmail}
                    placeholder="name@example.com"
                    placeholderTextColor={colors.gray400}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={[styles.field, styles.fieldBorder]}>
                  <Text style={styles.fieldLabel}>{t('appointment_contact_phone')}</Text>
                  <TextInput
                    style={styles.input}
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    placeholder="+49 123 456789"
                    placeholderTextColor={colors.gray400}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>

            {/* Note */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('appointment_note')}</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder={t('appointment_note_placeholder')}
                placeholderTextColor={colors.gray400}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </>
        ) : null}

        {fieldError ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={styles.errorText}>{fieldError}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.bookBtn, submitting && styles.bookBtnDisabled]}
          onPress={() => void handleBook()}
          activeOpacity={0.85}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.black} />
          ) : (
            <Ionicons name="checkmark-circle" size={18} color={colors.black} />
          )}
          <Text style={styles.bookBtnText}>
            {submitting
              ? t('booking_appointment')
              : isRescheduling
                ? t('reschedule_appointment')
                : t('confirm_appointment')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  backBtn: {},
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  summaryCard: {
    margin: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadow.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: `${colors.secondary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  summarySubvalue: {
    fontSize: 13,
    color: colors.gray600,
    marginTop: 2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginVertical: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray600,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldGroup: {
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
    ...shadow.sm,
  },
  field: {
    padding: spacing.md,
  },
  fieldBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray600,
    marginBottom: 4,
  },
  input: {
    fontSize: 15,
    color: colors.onSurface,
    padding: 0,
  },
  noteInput: {
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: spacing.md,
    fontSize: 15,
    color: colors.onSurface,
    minHeight: 100,
    ...shadow.sm,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: `${colors.error}10`,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    flex: 1,
  },
  bottomBar: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  bookBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  bookBtnDisabled: {
    opacity: 0.6,
  },
  bookBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.black,
  },
});
